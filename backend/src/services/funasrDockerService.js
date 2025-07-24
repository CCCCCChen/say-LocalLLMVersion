const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * FunASR Docker 服务类
 * 基于官方 online-cpu.sh 脚本的 client 模式调用 Docker 中的 FunASR 服务
 */
class FunASRDockerService {
    constructor(options = {}) {
        // 尝试加载配置文件
        this.config = this._loadConfig();
        
        this.host = options.host || this.config.docker?.host || '127.0.0.1';
        this.port = options.port || this.config.docker?.port || 10095;
        this.mode = options.mode || this.config.funasr?.mode || '2pass';
        this.audioFs = options.audioFs || this.config.funasr?.audio_fs || 16000;
        this.timeout = options.timeout || this.config.docker?.timeout || 300000; // 5分钟超时
        
        // 样本客户端路径配置
        this.samplesDir = options.samplesDir || this.config.docker?.samples_dir || path.join(process.cwd(), 'funasr-runtime-resources', 'samples');
        this.pythonClientPath = path.join(this.samplesDir, 'python', 'funasr_wss_client.py');
        this.cppClientPath = path.join(this.samplesDir, 'cpp', 'funasr-wss-client');
        
        // 默认使用Python客户端
        this.clientType = options.clientType || this.config.docker?.client_type || 'python';
        this.autoSetup = options.autoSetup !== undefined ? options.autoSetup : (this.config.docker?.auto_setup !== false);
        
        console.log(`[FUNASR-DOCKER] Service initialized:`);
        console.log(`[FUNASR-DOCKER]   Host: ${this.host}:${this.port}`);
        console.log(`[FUNASR-DOCKER]   Mode: ${this.mode}`);
        console.log(`[FUNASR-DOCKER]   Client Type: ${this.clientType}`);
        console.log(`[FUNASR-DOCKER]   Samples Dir: ${this.samplesDir}`);
        console.log(`[FUNASR-DOCKER]   Auto Setup: ${this.autoSetup}`);
    }

    /**
     * 加载配置文件
     * @returns {Object} 配置对象
     * @private
     */
    _loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'funasr_config.json');
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configData);
                console.log(`[FUNASR-DOCKER] Config loaded from: ${configPath}`);
                return config;
            } else {
                console.log(`[FUNASR-DOCKER] Config file not found, using defaults`);
                return {};
            }
        } catch (error) {
            console.warn(`[FUNASR-DOCKER] Failed to load config:`, error.message);
            return {};
        }
    }

    /**
     * 检查FunASR Docker服务是否可用
     * @returns {Promise<boolean>} 服务是否可用
     */
    async checkHealth() {
        try {
            console.log(`[FUNASR-DOCKER] Checking health at ${this.host}:${this.port}`);
            
            // 使用简单的网络连接测试
            const net = require('net');
            return new Promise((resolve) => {
                const socket = new net.Socket();
                const timeout = setTimeout(() => {
                    socket.destroy();
                    console.log(`[FUNASR-DOCKER] Health check timeout`);
                    resolve(false);
                }, 5000);
                
                socket.connect(this.port, this.host, () => {
                    clearTimeout(timeout);
                    socket.destroy();
                    console.log(`[FUNASR-DOCKER] Health check passed`);
                    resolve(true);
                });
                
                socket.on('error', (error) => {
                    clearTimeout(timeout);
                    console.log(`[FUNASR-DOCKER] Health check failed: ${error.message}`);
                    resolve(false);
                });
            });
        } catch (error) {
            console.error(`[FUNASR-DOCKER] Health check error:`, error.message);
            return false;
        }
    }

    /**
     * 检查客户端文件是否存在
     * @returns {Promise<boolean>} 客户端是否可用
     */
    async checkClientAvailable() {
        try {
            if (this.clientType === 'python') {
                return fs.existsSync(this.pythonClientPath);
            } else if (this.clientType === 'cpp') {
                return fs.existsSync(this.cppClientPath);
            }
            return false;
        } catch (error) {
            console.error('Failed to check client availability:', error.message);
            return false;
        }
    }

    /**
     * 下载并设置FunASR样本客户端
     * @returns {Promise<boolean>} 是否成功设置
     */
    async setupClient() {
        try {
            console.log('Setting up FunASR client...');
            
            // 创建样本目录
            const workspaceDir = path.dirname(this.samplesDir);
            if (!fs.existsSync(workspaceDir)) {
                fs.mkdirSync(workspaceDir, { recursive: true });
            }
            
            // 下载样本文件
            const samplesUrl = 'https://isv-data.oss-cn-hangzhou.aliyuncs.com/ics/MaaS/ASR/sample/funasr_samples.tar.gz';
            const samplesArchive = path.join(workspaceDir, 'funasr_samples.tar.gz');
            
            if (!fs.existsSync(samplesArchive)) {
                console.log('Downloading FunASR samples...');
                await this._downloadFile(samplesUrl, samplesArchive);
            }
            
            // 解压样本文件
            if (!fs.existsSync(this.samplesDir)) {
                console.log('Extracting FunASR samples...');
                await this._extractArchive(samplesArchive, workspaceDir);
            }
            
            // 安装Python依赖
            if (this.clientType === 'python') {
                await this._installPythonDependencies();
            }
            
            console.log('FunASR client setup completed');
            return true;
        } catch (error) {
            console.error('Failed to setup FunASR client:', error.message);
            return false;
        }
    }

    /**
     * 转录音频文件
     * @param {string} audioFilePath - 音频文件路径
     * @param {Object} options - 转录选项
     * @returns {Promise<Object>} 转录结果
     */
    async transcribeAudio(audioFilePath, options = {}) {
        try {
            console.log(`[FUNASR-DOCKER] Starting transcription for: ${audioFilePath}`);
            
            // 检查音频文件是否存在
            if (!fs.existsSync(audioFilePath)) {
                throw new Error(`Audio file not found: ${audioFilePath}`);
            }
            
            // 获取文件信息
            const stats = fs.statSync(audioFilePath);
            console.log(`[FUNASR-DOCKER] Audio file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // 检查客户端是否可用
            const clientAvailable = await this.checkClientAvailable();
            if (!clientAvailable) {
                if (this.autoSetup) {
                    console.log(`[FUNASR-DOCKER] Client not available, setting up...`);
                    const setupSuccess = await this.setupClient();
                    if (!setupSuccess) {
                        throw new Error('Failed to setup FunASR client');
                    }
                } else {
                    throw new Error('FunASR client not available and auto-setup is disabled');
                }
            } else {
                console.log(`[FUNASR-DOCKER] Client is available`);
            }
            
            // 检查服务是否可用
            const serviceAvailable = await this.checkHealth();
            if (!serviceAvailable) {
                throw new Error(`FunASR Docker service not available at ${this.host}:${this.port}`);
            }
            
            // 执行转录
            console.log(`[FUNASR-DOCKER] Executing transcription...`);
            const result = await this._executeTranscription(audioFilePath, options);
            
            console.log(`[FUNASR-DOCKER] Transcription completed successfully`);
            return result;
            
        } catch (error) {
            console.error(`[FUNASR-DOCKER] Transcription failed:`, error.message);
            throw error;
        }
    }

    /**
     * 执行转录命令
     * @param {string} audioFilePath - 音频文件路径
     * @param {Object} options - 转录选项
     * @returns {Promise<Object>} 转录结果
     * @private
     */
    async _executeTranscription(audioFilePath, options = {}) {
        return new Promise((resolve, reject) => {
            let command, args;
            
            if (this.clientType === 'python') {
                command = 'python3';
                args = [
                    this.pythonClientPath,
                    '--host', this.host,
                    '--port', this.port.toString(),
                    '--mode', options.mode || this.mode,
                    '--audio_in', audioFilePath,
                    '--send_without_sleep',
                    '--output_dir', path.join(this.samplesDir, 'python')
                ];
            } else if (this.clientType === 'cpp') {
                command = this.cppClientPath;
                args = [
                    '--server-ip', this.host,
                    '--port', this.port.toString(),
                    '--wav-path', audioFilePath
                ];
            } else {
                reject(new Error(`Unsupported client type: ${this.clientType}`));
                return;
            }
            
            console.log(`Executing command: ${command} ${args.join(' ')}`);
            
            const childProcess = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { 
                    ...process.env,
                    PATH: process.env.PATH,
                    PYTHONPATH: process.env.PYTHONPATH || ''
                }
            });
            
            let stdout = '';
            let stderr = '';
            
            childProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                console.log('FunASR Client Output:', output.trim());
            });
            
            childProcess.stderr.on('data', (data) => {
                const error = data.toString();
                stderr += error;
                console.error('FunASR Client Error:', error.trim());
            });
            
            childProcess.on('close', (code) => {
                console.log(`FunASR client process exited with code: ${code}`);
                
                if (code === 0) {
                    try {
                        const result = this._parseTranscriptionOutput(stdout, stderr);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error(`Failed to parse transcription output: ${parseError.message}`));
                    }
                } else {
                    reject(new Error(`Transcription process failed with code ${code}: ${stderr}`));
                }
            });
            
            childProcess.on('error', (error) => {
                reject(new Error(`Failed to start transcription process: ${error.message}`));
            });
            
            // 设置超时
            setTimeout(() => {
                if (!childProcess.killed) {
                    childProcess.kill('SIGTERM');
                    reject(new Error('Transcription timeout'));
                }
            }, this.timeout);
        });
    }

    /**
     * 解析转录输出结果
     * @param {string} stdout - 标准输出
     * @param {string} stderr - 错误输出
     * @returns {Object} 解析后的结果
     * @private
     */
    _parseTranscriptionOutput(stdout, stderr) {
        try {
            // 尝试从输出中提取JSON结果
            const lines = stdout.split('\n');
            let transcriptionText = '';
            let jsonResult = null;
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                // 尝试解析JSON格式的结果
                if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                    try {
                        jsonResult = JSON.parse(trimmedLine);
                        if (jsonResult.text) {
                            transcriptionText = jsonResult.text;
                        }
                    } catch (e) {
                        // 不是有效的JSON，继续处理
                    }
                }
                
                // 提取包含中文或英文文本的行
                if (/[\u4e00-\u9fa5]|[a-zA-Z]/.test(trimmedLine) && 
                    !trimmedLine.includes('INFO') && 
                    !trimmedLine.includes('DEBUG') &&
                    !trimmedLine.includes('WARNING') &&
                    !trimmedLine.includes('ERROR')) {
                    if (!transcriptionText) {
                        transcriptionText = trimmedLine;
                    }
                }
            }
            
            // 如果没有找到文本，尝试从stderr中提取
            if (!transcriptionText && stderr) {
                const errorLines = stderr.split('\n');
                for (const line of errorLines) {
                    if (/[\u4e00-\u9fa5]|[a-zA-Z]/.test(line.trim()) && 
                        !line.includes('ERROR') && 
                        !line.includes('WARNING')) {
                        transcriptionText = line.trim();
                        break;
                    }
                }
            }
            
            return {
                text: transcriptionText || '',
                raw_output: stdout,
                error_output: stderr,
                json_result: jsonResult,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            throw new Error(`Failed to parse output: ${error.message}`);
        }
    }

    /**
     * 下载文件
     * @param {string} url - 下载URL
     * @param {string} filePath - 保存路径
     * @returns {Promise<void>}
     * @private
     */
    async _downloadFile(url, filePath) {
        const https = require('https');
        const http = require('http');
        
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filePath);
            const client = url.startsWith('https') ? https : http;
            
            client.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Download failed with status: ${response.statusCode}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
                
                file.on('error', (error) => {
                    fs.unlink(filePath, () => {});
                    reject(error);
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * 解压归档文件
     * @param {string} archivePath - 归档文件路径
     * @param {string} extractPath - 解压路径
     * @returns {Promise<void>}
     * @private
     */
    async _extractArchive(archivePath, extractPath) {
        return new Promise((resolve, reject) => {
            const tar = spawn('tar', ['-zxf', archivePath, '-C', extractPath], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            tar.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Archive extraction failed with code: ${code}`));
                }
            });
            
            tar.on('error', (error) => {
                reject(new Error(`Failed to extract archive: ${error.message}`));
            });
        });
    }

    /**
     * 安装Python依赖
     * @returns {Promise<void>}
     * @private
     */
    async _installPythonDependencies() {
        return new Promise((resolve, reject) => {
            console.log('Installing Python dependencies...');
            
            const requirementsPath = path.join(this.samplesDir, 'python', 'requirements_client.txt');
            
            // 安装click
            const pip1 = spawn('pip3', ['install', 'click>=8.0.4'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            pip1.on('close', (code1) => {
                if (code1 !== 0) {
                    reject(new Error('Failed to install click'));
                    return;
                }
                
                // 安装requirements
                if (fs.existsSync(requirementsPath)) {
                    const pip2 = spawn('pip3', ['install', '-r', requirementsPath], {
                        stdio: ['pipe', 'pipe', 'pipe']
                    });
                    
                    pip2.on('close', (code2) => {
                        if (code2 === 0) {
                            console.log('Python dependencies installed successfully');
                            resolve();
                        } else {
                            reject(new Error('Failed to install requirements'));
                        }
                    });
                    
                    pip2.on('error', (error) => {
                        reject(new Error(`Failed to install requirements: ${error.message}`));
                    });
                } else {
                    console.log('Requirements file not found, skipping...');
                    resolve();
                }
            });
            
            pip1.on('error', (error) => {
                reject(new Error(`Failed to install click: ${error.message}`));
            });
        });
    }

    /**
     * 获取支持的音频格式
     * @returns {Array<string>} 支持的格式列表
     */
    getSupportedFormats() {
        return ['.wav', '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.amr', '.3gp', '.mp4', '.pcm'];
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
     * 设置配置
     * @param {Object} config - 配置对象
     */
    setConfig(config) {
        if (config.host) this.host = config.host;
        if (config.port) this.port = config.port;
        if (config.mode) this.mode = config.mode;
        if (config.clientType) this.clientType = config.clientType;
        if (config.samplesDir) this.samplesDir = config.samplesDir;
        if (config.timeout) this.timeout = config.timeout;
        
        console.log('FunASR Docker Service config updated:', {
            host: this.host,
            port: this.port,
            mode: this.mode,
            clientType: this.clientType
        });
    }
}

module.exports = FunASRDockerService;