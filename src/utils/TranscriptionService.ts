// 统一转录服务管理器 - 支持FunASR和Whisper

import { FunASRClient, FunASRConfig, loadFunASRConfig } from './FunASRConfig';
import { defaultModelConfig } from './ModelConfig';

export interface TranscriptionResult {
    text: string;
    confidence?: number;
    segments?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    language?: string;
    provider: 'funasr' | 'whisper';
    processingTime: number;
}

export interface TranscriptionOptions {
    language?: string;
    hotwords?: string[];
    format?: string;
    sampleRate?: number;
    useTimestamps?: boolean;
    maxRetries?: number;
}

export class TranscriptionService {
    private funasrClient: FunASRClient | null = null;
    private funasrConfig: FunASRConfig;
    private whisperWorker: Worker | null = null;
    private isInitialized = false;

    constructor() {
        this.funasrConfig = loadFunASRConfig();
    }

    // 初始化转录服务
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('Initializing transcription service...');
        
        // 如果启用了FunASR，尝试连接
        if (this.funasrConfig.enabled) {
            try {
                console.log('Attempting to connect to FunASR service...');
                this.funasrClient = new FunASRClient(this.funasrConfig);
                await this.funasrClient.connect();
                console.log('✅ FunASR service connected successfully');
            } catch (error) {
                console.warn('❌ FunASR connection failed:', error);
                if (!this.funasrConfig.fallbackToWhisper) {
                    throw new Error('FunASR connection failed and fallback is disabled');
                }
                console.log('🔄 Falling back to Whisper...');
                this.funasrClient = null;
            }
        }

        // 如果FunASR不可用或未启用，初始化Whisper
        if (!this.funasrClient) {
            await this.initializeWhisper();
        }

        this.isInitialized = true;
    }

    // 初始化Whisper Worker
    private async initializeWhisper(): Promise<void> {
        try {
            console.log('Initializing Whisper worker...');
            this.whisperWorker = new Worker('/src/worker.js', { type: 'module' });
            console.log('✅ Whisper worker initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Whisper worker:', error);
            throw error;
        }
    }

    // 转录音频
    async transcribe(
        audioData: ArrayBuffer,
        options: TranscriptionOptions = {}
    ): Promise<TranscriptionResult> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        let result: TranscriptionResult;

        // 优先使用FunASR
        if (this.funasrClient && this.funasrClient.isReady()) {
            try {
                result = await this.transcribeWithFunASR(audioData, options);
                result.processingTime = Date.now() - startTime;
                return result;
            } catch (error) {
                console.warn('FunASR transcription failed, falling back to Whisper:', error);
                if (!this.funasrConfig.fallbackToWhisper) {
                    throw error;
                }
            }
        }

        // 使用Whisper作为备选
        if (this.whisperWorker) {
            result = await this.transcribeWithWhisper(audioData, options);
            result.processingTime = Date.now() - startTime;
            return result;
        }

        throw new Error('No transcription service available');
    }

    // 使用FunASR转录
    private async transcribeWithFunASR(
        audioData: ArrayBuffer,
        options: TranscriptionOptions
    ): Promise<TranscriptionResult> {
        if (!this.funasrClient) {
            throw new Error('FunASR client not available');
        }

        const text = await this.funasrClient.transcribe(audioData, {
            format: options.format,
            sampleRate: options.sampleRate,
            hotwords: options.hotwords
        });

        return {
            text,
            provider: 'funasr',
            processingTime: 0 // 将在调用方设置
        };
    }

    // 使用Whisper转录
    private async transcribeWithWhisper(
        audioData: ArrayBuffer,
        options: TranscriptionOptions
    ): Promise<TranscriptionResult> {
        if (!this.whisperWorker) {
            throw new Error('Whisper worker not available');
        }

        return new Promise((resolve, reject) => {
            const messageId = `whisper_${Date.now()}_${Math.random()}`;
            
            const timeout = setTimeout(() => {
                reject(new Error('Whisper transcription timeout'));
            }, this.funasrConfig.timeout);

            const handleMessage = (event: MessageEvent) => {
                const { type, data } = event.data;
                
                if (data?.messageId === messageId) {
                    clearTimeout(timeout);
                    this.whisperWorker!.removeEventListener('message', handleMessage);
                    
                    if (type === 'complete') {
                        resolve({
                            text: data.text || '',
                            confidence: data.confidence,
                            segments: data.segments,
                            language: data.language,
                            provider: 'whisper',
                            processingTime: 0
                        });
                    } else if (type === 'error') {
                        reject(new Error(data.error || 'Whisper transcription failed'));
                    }
                }
            };

            this.whisperWorker.addEventListener('message', handleMessage);
            
            // 发送转录请求
            this.whisperWorker.postMessage({
                type: 'transcribe',
                messageId,
                audioData,
                options: {
                    language: options.language,
                    task: 'transcribe',
                    return_timestamps: options.useTimestamps
                }
            });
        });
    }

    // 获取可用的转录提供者
    getAvailableProviders(): Array<'funasr' | 'whisper'> {
        const providers: Array<'funasr' | 'whisper'> = [];
        
        if (this.funasrClient && this.funasrClient.isReady()) {
            providers.push('funasr');
        }
        
        if (this.whisperWorker) {
            providers.push('whisper');
        }
        
        return providers;
    }

    // 获取当前配置
    getConfig() {
        return {
            funasr: this.funasrConfig,
            whisper: defaultModelConfig
        };
    }

    // 测试服务可用性
    async testServices(): Promise<{
        funasr: boolean;
        whisper: boolean;
    }> {
        const results = {
            funasr: false,
            whisper: false
        };

        // 测试FunASR
        if (this.funasrConfig.enabled) {
            try {
                results.funasr = await FunASRClient.testConnection(this.funasrConfig);
            } catch (error) {
                console.warn('FunASR test failed:', error);
            }
        }

        // 测试Whisper
        try {
            if (!this.whisperWorker) {
                await this.initializeWhisper();
            }
            results.whisper = !!this.whisperWorker;
        } catch (error) {
            console.warn('Whisper test failed:', error);
        }

        return results;
    }

    // 重新连接FunASR
    async reconnectFunASR(): Promise<boolean> {
        if (this.funasrClient) {
            this.funasrClient.disconnect();
        }

        if (this.funasrConfig.enabled) {
            try {
                this.funasrClient = new FunASRClient(this.funasrConfig);
                await this.funasrClient.connect();
                return true;
            } catch (error) {
                console.error('FunASR reconnection failed:', error);
                this.funasrClient = null;
            }
        }
        
        return false;
    }

    // 清理资源
    dispose(): void {
        if (this.funasrClient) {
            this.funasrClient.disconnect();
            this.funasrClient = null;
        }

        if (this.whisperWorker) {
            this.whisperWorker.terminate();
            this.whisperWorker = null;
        }

        this.isInitialized = false;
    }
}

// 单例实例
export const transcriptionService = new TranscriptionService();