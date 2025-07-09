// Model configuration for handling network connectivity issues

export interface ModelConfig {
    useLocalModels: boolean;
    remoteURL: string;
    mirrorURLs: string[];
    timeout: number;
    retryAttempts: number;
}

// Default configuration
export const defaultModelConfig: ModelConfig = {
    useLocalModels: false,
    remoteURL: 'https://huggingface.co/',
    mirrorURLs: [
        'https://hf-mirror.com/',  // 国内镜像
        'https://huggingface.co/', // 原始地址
    ],
    timeout: 30000, // 30秒超时
    retryAttempts: 3
};

// Function to test connectivity to different mirrors
export async function testConnectivity(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${url}Xenova/whisper-tiny/resolve/main/config.json`, {
            method: 'HEAD',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.warn(`Failed to connect to ${url}:`, error);
        return false;
    }
}

// Function to find the best available mirror
export async function findBestMirror(mirrors: string[]): Promise<string> {
    for (const mirror of mirrors) {
        const isAvailable = await testConnectivity(mirror);
        if (isAvailable) {
            console.log(`Using mirror: ${mirror}`);
            return mirror;
        }
    }
    
    console.warn('No mirrors available, using default');
    return mirrors[mirrors.length - 1]; // 返回最后一个作为默认值
}

// Function to configure transformers.js environment
export function configureTransformersEnv(env: any, config: ModelConfig) {
    env.allowLocalModels = config.useLocalModels;
    env.remoteURL = config.remoteURL;
    env.remotePathTemplate = '{model}/resolve/{revision}/{file}';
    
    // Configure ONNX runtime paths
    if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
    }
}