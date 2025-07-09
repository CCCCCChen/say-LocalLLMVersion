// Model configuration - FORCED LOCAL MODELS ONLY
// 模型配置 - 强制仅使用本地模型
//
// 本应用已配置为仅使用本地存储的模型，不会从网络下载模型。
// 请确保已将模型文件下载到 public/models/ 目录中。
//
// === 模型下载方法 ===
//
// 方法1: 使用 Hugging Face CLI (推荐)
// 1. 安装 Hugging Face CLI:
//    pip install huggingface_hub
//
// 2. 下载模型到本地:
//    huggingface-cli download Xenova/whisper-base --local-dir public/models --local-dir-use-symlinks False
//    huggingface-cli download Xenova/whisper-tiny --local-dir public/models --local-dir-use-symlinks False
//    huggingface-cli download Xenova/whisper-small --local-dir public/models --local-dir-use-symlinks False
//
// 方法2: 使用 curl (macOS/Linux)
// mkdir -p public/models && cd public/models
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/config.json
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/generation_config.json
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/merges.txt
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/model.safetensors
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/normalizer.json
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/preprocessor_config.json
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/special_tokens_map.json
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/tokenizer.json
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/tokenizer_config.json
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/vocab.json
// curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/added_tokens.json
//
// 方法3: 使用 Python 脚本
// 创建 download_models.py:
// from huggingface_hub import snapshot_download
// snapshot_download(repo_id="Xenova/whisper-base", local_dir="public/models", local_dir_use_symlinks=False)
// 然后运行: python download_models.py
//
// 方法4: 手动下载
// 访问 https://hf-mirror.com/Xenova/whisper-base/tree/main
// 手动下载所有文件到 public/models/ 目录
//
// === 支持的模型 ===
// - whisper-tiny: 最小模型，速度最快 (39MB)
// - whisper-base: 推荐模型，平衡性能 (74MB)
// - whisper-small: 更高精度 (244MB)
// - whisper-medium: 高精度 (769MB)
// - whisper-large: 最高精度 (1550MB)

export interface ModelConfig {
    useLocalModels: boolean;
    remoteURL: string;
    mirrorURLs: string[];
    timeout: number;
    retryAttempts: number;
}

// 强制使用本地模型配置 - 禁用网络下载
export const defaultModelConfig: ModelConfig = {
    useLocalModels: true,  // 强制启用本地模型
    remoteURL: '',         // 禁用远程URL
    mirrorURLs: [],        // 清空镜像列表
    timeout: 0,            // 禁用网络超时
    retryAttempts: 0       // 禁用重试
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