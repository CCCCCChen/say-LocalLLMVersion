const axios = require('axios');
const FormData = require('form-data');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

class FunASRService {
    constructor(baseUrl = 'http://localhost:10096') {
        this.baseUrl = baseUrl;
        this.wsUrl = baseUrl.replace('http://', 'ws://').replace(':10095', ':10096');
        this.client = axios.create({
            baseURL: baseUrl,
            timeout: 300000, // 5分钟超时
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
     * 使用WebSocket转录音频文件（推荐方式）
     * @param {string} audioFilePath - 音频文件路径
     * @param {Object} options - 转录选项
     * @returns {Promise<string>} 转录结果文本
     */
    async transcribeAudioWS(audioFilePath, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // 检查文件是否存在
                if (!fs.existsSync(audioFilePath)) {
                    throw new Error(`Audio file not found: ${audioFilePath}`);
                }

                // 创建WebSocket连接
                const ws = new WebSocket(this.wsUrl);
                let responseReceived = false;

                ws.on('open', () => {
                    console.log('WebSocket connected to FunASR');
                    
                    // 发送转录请求
                    const request = {
                        mode: "online",
                        audio_in: audioFilePath,
                        ...options
                    };
                    
                    ws.send(JSON.stringify(request));
                });

                ws.on('message', (data) => {
                    try {
                        const response = JSON.parse(data.toString());
                        responseReceived = true;
                        
                        if (response.text) {
                            resolve(response.text);
                        } else if (response.error) {
                            reject(new Error(response.error));
                        } else {
                            reject(new Error('Invalid response format'));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    } finally {
                        ws.close();
                    }
                });

                ws.on('error', (error) => {
                    reject(new Error(`WebSocket error: ${error.message}`));
                });

                ws.on('close', () => {
                    if (!responseReceived) {
                        reject(new Error('WebSocket closed without response'));
                    }
                });

                // 设置超时
                setTimeout(() => {
                    if (!responseReceived) {
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
}

module.exports = FunASRService;