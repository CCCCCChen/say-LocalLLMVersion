const axios = require('axios');
const FormData = require('form-data');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const wave = require('node-wav');

class FunASRService {
    constructor(options = {}) {
        this.host = options.host || 'localhost';
        this.port = options.port || 10095;
        this.ssl = options.ssl !== undefined ? options.ssl : false;
        this.mode = options.mode || '2pass'; // offline, online, 2pass
        this.chunkSize = options.chunkSize || [5, 10, 5];
        this.chunkInterval = options.chunkInterval || 10;
        this.encoderChunkLookBack = options.encoderChunkLookBack || 4;
        this.decoderChunkLookBack = options.decoderChunkLookBack || 0;
        this.useItn = options.useItn !== undefined ? options.useItn : true;
        this.audioFs = options.audioFs || 16000;
        
        // 构建WebSocket URL
        const protocol = this.ssl ? 'wss' : 'ws';
        this.wsUrl = `${protocol}://${this.host}:${this.port}`;
        
        // HTTP客户端（备用）
        this.httpUrl = `http${this.ssl ? 's' : ''}://${this.host}:${this.port}`;
        this.client = axios.create({
            baseURL: this.httpUrl,
            timeout: 300000,
        });
    }

    /**
     * 检查FunASR服务是否可用
     */
    async checkHealth() {
        try {
            const response = await this.client.get('/health');
            return response.status === 200;
        } catch (error) {
            console.error('FunASR service health check failed:', error.message);
            return false;
        }
    }

    /**
     * 使用WebSocket转录音频文件（基于funasr_wss_client.py协议）
     * @param {string} audioFilePath - 音频文件路径
     * @param {Object} options - 转录选项
     * @returns {Promise<Object>} 转录结果对象
     */
    async transcribeAudioWS(audioFilePath, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // 检查文件是否存在
                if (!fs.existsSync(audioFilePath)) {
                    throw new Error(`Audio file not found: ${audioFilePath}`);
                }

                // 读取音频文件
                const audioData = this._readAudioFile(audioFilePath);
                if (!audioData) {
                    throw new Error('Failed to read audio file');
                }

                // 创建WebSocket连接
                const wsOptions = {
                    subprotocols: ['binary'],
                    pingInterval: null
                };
                
                if (this.ssl) {
                    wsOptions.rejectUnauthorized = false;
                }
                
                const ws = new WebSocket(this.wsUrl, wsOptions);
                let transcriptionResult = {
                    text: '',
                    chunks: [],
                    timestamp: null,
                    isComplete: false
                };
                let offlineMsgDone = false;

                ws.on('open', async () => {
                    console.log('WebSocket connected to FunASR');
                    
                    try {
                        await this._sendAudioData(ws, audioData, audioFilePath, options);
                    } catch (error) {
                        reject(new Error(`Failed to send audio data: ${error.message}`));
                    }
                });

                ws.on('message', (data) => {
                    try {
                        const response = JSON.parse(data.toString());
                        const text = response.text || '';
                        const timestamp = response.timestamp || null;
                        const mode = response.mode;
                        const isFinal = response.is_final || false;
                        
                        // 根据模式处理响应
                        if (mode === 'offline') {
                            transcriptionResult.text += text;
                            if (timestamp) {
                                transcriptionResult.timestamp = timestamp;
                            }
                            offlineMsgDone = isFinal;
                            
                            if (offlineMsgDone) {
                                transcriptionResult.isComplete = true;
                                ws.close();
                                resolve(transcriptionResult);
                            }
                        } else if (mode === 'online') {
                            transcriptionResult.text += text;
                            transcriptionResult.chunks.push({
                                text: text,
                                timestamp: timestamp
                            });
                        } else if (mode === '2pass-online' || mode === '2pass-offline') {
                            if (mode === '2pass-offline') {
                                transcriptionResult.text = text; // 最终结果
                                transcriptionResult.isComplete = true;
                                ws.close();
                                resolve(transcriptionResult);
                            } else {
                                // 在线部分结果
                                transcriptionResult.chunks.push({
                                    text: text,
                                    timestamp: timestamp,
                                    type: 'online'
                                });
                            }
                        }
                        
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });

                ws.on('error', (error) => {
                    reject(new Error(`WebSocket error: ${error.message}`));
                });

                ws.on('close', () => {
                    if (!transcriptionResult.isComplete && this.mode !== 'online') {
                        reject(new Error('WebSocket closed without complete response'));
                    } else if (this.mode === 'online') {
                        transcriptionResult.isComplete = true;
                        resolve(transcriptionResult);
                    }
                });

                // 设置超时
                setTimeout(() => {
                    if (!transcriptionResult.isComplete) {
                        ws.close();
                        reject(new Error('Transcription timeout'));
                    }
                }, 300000); // 5分钟超时

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 转录音频文件（HTTP方式，备用）
     * @param {string} audioFilePath - 音频文件路径
     * @param {Object} options - 转录选项
     * @returns {Promise<string>} 转录结果文本
     */
    async transcribeAudio(audioFilePath, options = {}) {
        try {
            // 检查文件是否存在
            if (!fs.existsSync(audioFilePath)) {
                throw new Error(`Audio file not found: ${audioFilePath}`);
            }

            // 创建表单数据
            const formData = new FormData();
            formData.append('audio', fs.createReadStream(audioFilePath));
            
            // 添加转录选项
            if (options.language) {
                formData.append('language', options.language);
            }
            if (options.hotwords) {
                formData.append('hotwords', options.hotwords);
            }
            if (options.use_itn !== undefined) {
                formData.append('use_itn', options.use_itn.toString());
            }

            // 发送转录请求
            const response = await this.client.post('/transcribe', formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });

            if (response.data && response.data.text) {
                return response.data.text;
            } else {
                throw new Error('Invalid response from FunASR service');
            }
        } catch (error) {
            console.error('FunASR transcription failed:', error.message);
            throw new Error(`Transcription failed: ${error.message}`);
        }
    }

    /**
     * 批量转录音频文件
     * @param {Array<string>} audioFilePaths - 音频文件路径数组
     * @param {Object} options - 转录选项
     * @returns {Promise<Array<string>>} 转录结果文本数组
     */
    async transcribeAudioBatch(audioFilePaths, options = {}) {
        const results = [];
        
        for (const filePath of audioFilePaths) {
            try {
                const result = await this.transcribeAudio(filePath, options);
                results.push(result);
            } catch (error) {
                console.error(`Failed to transcribe ${filePath}:`, error.message);
                results.push('');
            }
        }
        
        return results;
    }

    /**
     * 获取支持的音频格式
     */
    getSupportedFormats() {
        return [
            '.wav', '.mp3', '.flac', '.m4a', '.aac', 
            '.ogg', '.wma', '.amr', '.3gp', '.mp4'
        ];
    }

    /**
     * 检查音频文件格式是否支持
     * @param {string} filePath - 文件路径
     * @returns {boolean} 是否支持
     */
    isSupportedFormat(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.getSupportedFormats().includes(ext);
    }

    /**
     * 获取音频文件信息
     * @param {string} audioFilePath - 音频文件路径
     * @returns {Promise<Object>} 音频文件信息
     */
    async getAudioInfo(audioFilePath) {
        try {
            if (!fs.existsSync(audioFilePath)) {
                throw new Error(`Audio file not found: ${audioFilePath}`);
            }

            const stats = fs.statSync(audioFilePath);
            const ext = path.extname(audioFilePath).toLowerCase();
            
            return {
                path: audioFilePath,
                size: stats.size,
                format: ext,
                supported: this.isSupportedFormat(audioFilePath),
                created: stats.birthtime,
                modified: stats.mtime
            };
        } catch (error) {
            throw new Error(`Failed to get audio info: ${error.message}`);
        }
    }

    /**
     * 清理临时音频文件
     * @param {string} audioFilePath - 音频文件路径
     */
    async cleanupAudioFile(audioFilePath) {
        try {
            if (fs.existsSync(audioFilePath)) {
                fs.unlinkSync(audioFilePath);
                console.log(`Cleaned up audio file: ${audioFilePath}`);
            }
        } catch (error) {
            console.error(`Failed to cleanup audio file ${audioFilePath}:`, error.message);
        }
    }

    /**
     * 读取音频文件数据
     * @param {string} audioFilePath - 音频文件路径
     * @returns {Object} 音频数据对象
     * @private
     */
    _readAudioFile(audioFilePath) {
        try {
            const ext = path.extname(audioFilePath).toLowerCase();
            let audioBytes;
            let sampleRate = this.audioFs;
            let wavFormat = 'pcm';

            if (ext === '.pcm') {
                audioBytes = fs.readFileSync(audioFilePath);
            } else if (ext === '.wav') {
                try {
                    const wavData = wave.decode(fs.readFileSync(audioFilePath));
                    sampleRate = wavData.sampleRate;
                    audioBytes = Buffer.from(wavData.channelData[0].buffer);
                } catch (error) {
                    // 如果wave解析失败，直接读取原始数据
                    audioBytes = fs.readFileSync(audioFilePath);
                    wavFormat = 'others';
                }
            } else {
                audioBytes = fs.readFileSync(audioFilePath);
                wavFormat = 'others';
            }

            return {
                audioBytes,
                sampleRate,
                wavFormat,
                fileName: path.basename(audioFilePath, ext)
            };
        } catch (error) {
            console.error('Failed to read audio file:', error.message);
            return null;
        }
    }

    /**
     * 发送音频数据到WebSocket
     * @param {WebSocket} ws - WebSocket连接
     * @param {Object} audioData - 音频数据
     * @param {string} audioFilePath - 音频文件路径
     * @param {Object} options - 选项
     * @private
     */
    async _sendAudioData(ws, audioData, audioFilePath, options = {}) {
        const { audioBytes, sampleRate, wavFormat, fileName } = audioData;
        
        // 处理热词
        let hotwordMsg = '';
        if (options.hotwords) {
            if (typeof options.hotwords === 'string') {
                hotwordMsg = options.hotwords;
            } else if (typeof options.hotwords === 'object') {
                hotwordMsg = JSON.stringify(options.hotwords);
            }
        }

        // 发送初始配置消息
        const configMessage = {
            mode: options.mode || this.mode,
            chunk_size: options.chunkSize || this.chunkSize,
            chunk_interval: options.chunkInterval || this.chunkInterval,
            encoder_chunk_look_back: options.encoderChunkLookBack || this.encoderChunkLookBack,
            decoder_chunk_look_back: options.decoderChunkLookBack || this.decoderChunkLookBack,
            audio_fs: sampleRate,
            wav_name: fileName,
            wav_format: wavFormat,
            is_speaking: true,
            hotwords: hotwordMsg,
            itn: options.useItn !== undefined ? options.useItn : this.useItn
        };

        ws.send(JSON.stringify(configMessage));

        // 计算分块参数
        const stride = Math.floor(60 * this.chunkSize[1] / this.chunkInterval / 1000 * sampleRate * 2);
        const chunkNum = Math.floor((audioBytes.length - 1) / stride) + 1;

        // 分块发送音频数据
        for (let i = 0; i < chunkNum; i++) {
            const beg = i * stride;
            const end = Math.min(beg + stride, audioBytes.length);
            const chunk = audioBytes.slice(beg, end);
            
            ws.send(chunk);
            
            // 如果是最后一块，发送结束标志
            if (i === chunkNum - 1) {
                const endMessage = { is_speaking: false };
                ws.send(JSON.stringify(endMessage));
            }
            
            // 控制发送速度
            const sleepDuration = this.mode === 'offline' ? 1 : 
                (60 * this.chunkSize[1] / this.chunkInterval);
            
            if (i < chunkNum - 1) {
                await this._sleep(sleepDuration);
            }
        }
    }

    /**
     * 异步睡眠函数
     * @param {number} ms - 毫秒数
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 设置FunASR配置
     * @param {Object} config - 配置对象
     */
    setConfig(config) {
        if (config.host) this.host = config.host;
        if (config.port) this.port = config.port;
        if (config.ssl !== undefined) this.ssl = config.ssl;
        if (config.mode) this.mode = config.mode;
        if (config.chunkSize) this.chunkSize = config.chunkSize;
        if (config.chunkInterval) this.chunkInterval = config.chunkInterval;
        if (config.useItn !== undefined) this.useItn = config.useItn;
        
        // 重新构建URL
        const protocol = this.ssl ? 'wss' : 'ws';
        this.wsUrl = `${protocol}://${this.host}:${this.port}`;
        this.httpUrl = `http${this.ssl ? 's' : ''}://${this.host}:${this.port}`;
        this.client.defaults.baseURL = this.httpUrl;
    }
}

module.exports = FunASRService;