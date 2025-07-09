// FunASR Docker服务配置和客户端

export interface FunASRConfig {
    enabled: boolean;
    host: string;
    port: number;
    ssl: boolean;
    mode: 'offline' | 'online' | '2pass';
    apiKey?: string;
    secret?: string;
    hotwordsEnabled: boolean;
    hotwordsFile?: string;
    useITN: boolean;
    threadNum: number;
    timeout: number;
    fallbackToWhisper: boolean;
}

// 从环境变量加载配置（兼容浏览器环境）
export function loadFunASRConfig(): FunASRConfig {
    // 在浏览器环境中使用 import.meta.env，在 Node.js 环境中使用 process.env
    const env = typeof window !== 'undefined' 
        ? import.meta.env 
        : (typeof globalThis !== 'undefined' && 'process' in globalThis 
            ? (globalThis as any).process.env 
            : {});
    
    return {
        enabled: env.VITE_FUNASR_ENABLED === 'true' || env.FUNASR_ENABLED === 'true',
        host: env.VITE_FUNASR_HOST || env.FUNASR_HOST || '127.0.0.1',
        port: parseInt(env.VITE_FUNASR_PORT || env.FUNASR_PORT || '10095'),
        ssl: env.VITE_FUNASR_SSL === 'true' || env.FUNASR_SSL === 'true',
        mode: (env.VITE_FUNASR_MODE || env.FUNASR_MODE || 'offline') as 'offline' | 'online' | '2pass',
        apiKey: env.VITE_FUNASR_API_KEY || env.FUNASR_API_KEY,
        secret: env.VITE_FUNASR_SECRET || env.FUNASR_SECRET,
        hotwordsEnabled: env.VITE_FUNASR_HOTWORDS_ENABLED === 'true' || env.FUNASR_HOTWORDS_ENABLED === 'true',
        hotwordsFile: env.VITE_FUNASR_HOTWORDS_FILE || env.FUNASR_HOTWORDS_FILE,
        useITN: (env.VITE_FUNASR_USE_ITN || env.FUNASR_USE_ITN) !== 'false',
        threadNum: parseInt(env.VITE_FUNASR_THREAD_NUM || env.FUNASR_THREAD_NUM || '1'),
        timeout: parseInt(env.VITE_FUNASR_TIMEOUT || env.FUNASR_TIMEOUT || '30000'),
        fallbackToWhisper: (env.VITE_FALLBACK_TO_WHISPER || env.FALLBACK_TO_WHISPER) !== 'false'
    };
}

// FunASR WebSocket客户端
export class FunASRClient {
    private config: FunASRConfig;
    private ws: WebSocket | null = null;
    private isConnected = false;
    private messageId = 0;
    private pendingRequests = new Map<string, {
        resolve: (value: any) => void;
        reject: (error: any) => void;
        timeout: number;
    }>();

    constructor(config: FunASRConfig) {
        this.config = config;
    }

    // 连接到FunASR服务
    async connect(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                const protocol = this.config.ssl ? 'wss' : 'ws';
                const url = `${protocol}://${this.config.host}:${this.config.port}`;
                
                this.ws = new WebSocket(url);
                
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.config.timeout);

                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    this.isConnected = true;
                    console.log('FunASR WebSocket connected');
                    resolve(true);
                };

                this.ws.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('FunASR WebSocket error:', error);
                    reject(error);
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    console.log('FunASR WebSocket disconnected');
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    // 处理WebSocket消息
    private handleMessage(data: string) {
        try {
            const message = JSON.parse(data);
            const requestId = message.id || message.request_id;
            
            if (requestId && this.pendingRequests.has(requestId)) {
                const request = this.pendingRequests.get(requestId)!;
                clearTimeout(request.timeout as any);
                this.pendingRequests.delete(requestId);
                
                if (message.code === 0 || message.status === 'success') {
                    request.resolve(message);
                } else {
                    request.reject(new Error(message.message || 'FunASR request failed'));
                }
            }
        } catch (error) {
            console.error('Failed to parse FunASR message:', error);
        }
    }

    // 转录音频
    async transcribe(audioData: ArrayBuffer, options: {
        format?: string;
        sampleRate?: number;
        hotwords?: string[];
    } = {}): Promise<string> {
        if (!this.isConnected) {
            throw new Error('FunASR client not connected');
        }

        return new Promise((resolve, reject) => {
            const requestId = `req_${++this.messageId}_${Date.now()}`;
            
            // 构建请求消息
            const message = {
                id: requestId,
                mode: this.config.mode,
                audio_format: options.format || 'wav',
                sample_rate: options.sampleRate || 16000,
                use_itn: this.config.useITN,
                hotwords: this.config.hotwordsEnabled ? options.hotwords : undefined,
                audio_data: this.arrayBufferToBase64(audioData)
            };

            // 设置超时
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('FunASR transcription timeout'));
            }, this.config.timeout);

            // 存储请求
            this.pendingRequests.set(requestId, {
                resolve: (response) => {
                    const text = response.text || response.result || '';
                    resolve(text);
                },
                reject,
                timeout: timeoutId as any
            });

            // 发送请求
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
            } else {
                clearTimeout(timeoutId);
                this.pendingRequests.delete(requestId);
                reject(new Error('WebSocket not ready'));
            }
        });
    }

    // 将ArrayBuffer转换为Base64
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // 断开连接
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        
        // 清理待处理的请求
        this.pendingRequests.forEach(request => {
            clearTimeout(request.timeout as any);
            request.reject(new Error('Connection closed'));
        });
        this.pendingRequests.clear();
    }

    // 检查连接状态
    isReady(): boolean {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }

    // 测试连接
    static async testConnection(config: FunASRConfig): Promise<boolean> {
        const client = new FunASRClient(config);
        try {
            await client.connect();
            client.disconnect();
            return true;
        } catch (error) {
            console.warn('FunASR connection test failed:', error);
            return false;
        }
    }
}

// 默认配置
export const defaultFunASRConfig: FunASRConfig = {
    enabled: false,
    host: '127.0.0.1',
    port: 10095,
    ssl: false,
    mode: 'offline',
    hotwordsEnabled: false,
    useITN: true,
    threadNum: 1,
    timeout: 30000,
    fallbackToWhisper: true
};