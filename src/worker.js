/* eslint-disable camelcase */
import { pipeline, env } from "@xenova/transformers";
import { defaultModelConfig, configureTransformersEnv } from "./utils/ModelConfig.ts";

// === 强制本地模型配置 ===
// 此Worker已配置为仅使用本地存储的模型，不会尝试从网络下载模型
// 请确保模型文件已下载到 public/models/ 目录

// 初始化本地模型配置
let modelConfig = { ...defaultModelConfig };
let isConfigured = false;

// 强制使用本地模型的初始化函数
async function initializeConfig() {
    if (!isConfigured) {
        // 强制配置为本地模式，禁用所有网络请求
        modelConfig.useLocalModels = true;
        modelConfig.remoteURL = '';
        modelConfig.mirrorURLs = [];
        
        // 配置transformers环境为本地模式
        configureTransformersEnv(env, modelConfig);
        
        // 设置本地模型路径
        env.localModelPath = '/models/';
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        
        isConfigured = true;
        console.log('本地模型配置已初始化 - 仅使用本地存储的模型');
    }
}

// Define model factories
// Ensures only one model is created of each type
class PipelineFactory {
    static task = null;
    static model = null;
    static quantized = null;
    static instance = null;

    constructor(tokenizer, model, quantized) {
        this.tokenizer = tokenizer;
        this.model = model;
        this.quantized = quantized;
    }

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            // 强制初始化本地模型配置
            await initializeConfig();
            
            // 验证模型是否为本地模型路径
            if (!this.model || this.model.includes('http')) {
                throw new Error('仅允许使用本地模型！请确保模型已下载到 public/models/ 目录');
            }
            
            console.log(`正在加载本地模型: ${this.model}`);
            
            this.instance = pipeline(this.task, this.model, {
                quantized: this.quantized,
                progress_callback,
                
                // 强制使用本地模型
                local_files_only: true,
                
                // For medium models, we need to load the `no_attentions` revision to avoid running out of memory
                revision: this.model.includes("/whisper-medium") ? "no_attentions" : "main"
            });
        }

        return this.instance;
    }
}

self.addEventListener("message", async (event) => {
    const message = event.data;

    // Do some work...
    // TODO use message data
    let transcript = await transcribe(
        message.audio,
        message.model,
        message.multilingual,
        message.quantized,
        message.subtask,
        message.language,
    );
    if (transcript === null) return;

    // Send the result back to the main thread
    self.postMessage({
        status: "complete",
        task: "automatic-speech-recognition",
        data: transcript,
    });
});

class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
    static task = "automatic-speech-recognition";
    static model = null;
    static quantized = null;
}

const transcribe = async (
    audio,
    model,
    multilingual,
    quantized,
    subtask,
    language,
) => {
    // === 本地模型验证 ===
    // 确保只使用本地存储的模型，拒绝任何网络模型请求
    if (!model || model.includes('http') || model.includes('huggingface.co') || model.includes('hf-mirror.com')) {
        const errorMsg = '错误：仅允许使用本地模型！请确保模型已下载到 public/models/ 目录';
        console.error(errorMsg);
        self.postMessage({
            status: "error",
            task: "automatic-speech-recognition",
            data: new Error(errorMsg),
        });
        return null;
    }
    
    console.log(`开始使用本地模型进行转录: ${model}`);

    const isDistilWhisper = model.startsWith("distil-whisper/");

    // 使用本地模型名称
    const modelName = model;

    const p = AutomaticSpeechRecognitionPipelineFactory;
    if (p.model !== modelName || p.quantized !== quantized) {
        // Invalidate model if different
        p.model = modelName;
        p.quantized = quantized;

        if (p.instance !== null) {
            (await p.getInstance()).dispose();
            p.instance = null;
        }
    }

    // Load transcriber model
    let transcriber = await p.getInstance((data) => {
        self.postMessage(data);
    });

    const time_precision =
        transcriber.processor.feature_extractor.config.chunk_length /
        transcriber.model.config.max_source_positions;

    // Storage for chunks to be processed. Initialise with an empty chunk.
    let chunks_to_process = [
        {
            tokens: [],
            finalised: false,
        },
    ];

    // TODO: Storage for fully-processed and merged chunks
    // let decoded_chunks = [];

    function chunk_callback(chunk) {
        let last = chunks_to_process[chunks_to_process.length - 1];

        // Overwrite last chunk with new info
        Object.assign(last, chunk);
        last.finalised = true;

        // Create an empty chunk after, if it not the last chunk
        if (!chunk.is_last) {
            chunks_to_process.push({
                tokens: [],
                finalised: false,
            });
        }
    }

    // Inject custom callback function to handle merging of chunks
    function callback_function(item) {
        let last = chunks_to_process[chunks_to_process.length - 1];

        // Update tokens of last chunk
        last.tokens = [...item[0].output_token_ids];

        // Merge text chunks
        // TODO optimise so we don't have to decode all chunks every time
        let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
            time_precision: time_precision,
            return_timestamps: true,
            force_full_sequences: false,
        });

        self.postMessage({
            status: "update",
            task: "automatic-speech-recognition",
            data: data,
        });
    }

    // Actually run transcription
    let output = await transcriber(audio, {
        // Greedy
        top_k: 0,
        do_sample: false,

        // Sliding window
        chunk_length_s: isDistilWhisper ? 20 : 30,
        stride_length_s: isDistilWhisper ? 3 : 5,

        // Language and task
        language: language,
        task: subtask,

        // Return timestamps
        return_timestamps: true,
        force_full_sequences: false,

        // Callback functions
        callback_function: callback_function, // after each generation step
        chunk_callback: chunk_callback, // after each chunk is processed
    }).catch((error) => {
        self.postMessage({
            status: "error",
            task: "automatic-speech-recognition",
            data: error,
        });
        return null;
    });

    return output;
};
