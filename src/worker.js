/* eslint-disable camelcase */
import { pipeline, env } from "@xenova/transformers";
import { defaultModelConfig, findBestMirror, configureTransformersEnv } from "./utils/ModelConfig.ts";
import { loadFunASRConfig, FunASRClient, defaultFunASRConfig } from "./utils/FunASRConfig.ts";

// Initialize model configuration
let modelConfig = { ...defaultModelConfig };
let isConfigured = false;

// Initialize FunASR configuration
let funasrConfig = { ...defaultFunASRConfig };
let funasrClient = null;
let isFunASRReady = false;

// Load FunASR config from environment variables
try {
    funasrConfig = loadFunASRConfig();
    if (funasrConfig.enabled) {
        funasrClient = new FunASRClient(funasrConfig);
    }
} catch (error) {
    console.warn('Failed to load FunASR config:', error);
}

// Function to initialize configuration with best available mirror
async function initializeConfig() {
    if (!isConfigured) {
        try {
            const bestMirror = await findBestMirror(modelConfig.mirrorURLs);
            modelConfig.remoteURL = bestMirror;
            configureTransformersEnv(env, modelConfig);
            isConfigured = true;
            console.log('Model configuration initialized with mirror:', bestMirror);
        } catch (error) {
            console.warn('Failed to initialize model config, using defaults:', error);
            configureTransformersEnv(env, modelConfig);
            isConfigured = true;
        }
    }
}

// Function to initialize FunASR connection
async function initializeFunASR() {
    if (funasrClient && !isFunASRReady) {
        try {
            await funasrClient.connect();
            isFunASRReady = true;
            console.log('FunASR client connected successfully');
            return true;
        } catch (error) {
            console.warn('Failed to connect to FunASR service:', error);
            isFunASRReady = false;
            return false;
        }
    }
    return isFunASRReady;
}

// Function to transcribe with FunASR
async function transcribeWithFunASR(audio, options = {}) {
    try {
        // Initialize FunASR if not ready
        const isReady = await initializeFunASR();
        if (!isReady) {
            throw new Error('FunASR service not available');
        }

        // Convert audio to ArrayBuffer if needed
        let audioBuffer;
        if (audio instanceof ArrayBuffer) {
            audioBuffer = audio;
        } else if (audio.buffer) {
            audioBuffer = audio.buffer;
        } else {
            throw new Error('Invalid audio format for FunASR');
        }

        // Send progress update
        self.postMessage({
            status: 'progress',
            task: 'automatic-speech-recognition',
            model: 'funasr-runtime-sdk-online-cpu',
            progress: 0.1,
            loaded: 1,
            total: 10,
            file: 'funasr-model',
            name: 'FunASR Model'
        });

        // Perform transcription
        const text = await funasrClient.transcribe(audioBuffer, options);

        // Send completion message
        const result = {
            text: text,
            chunks: [{
                text: text,
                timestamp: [0, null]
            }]
        };

        self.postMessage({
            status: 'complete',
            task: 'automatic-speech-recognition',
            data: result
        });

        return result;

    } catch (error) {
        console.error('FunASR transcription failed:', error);
        
        // Send error message
        self.postMessage({
            status: 'error',
            task: 'automatic-speech-recognition',
            error: error.message
        });

        // Fallback to Whisper if enabled
        if (funasrConfig.fallbackToWhisper) {
            console.log('Falling back to Whisper model...');
            throw error; // Let the main transcribe function handle Whisper fallback
        } else {
            throw error;
        }
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
            // Initialize configuration before creating pipeline
            await initializeConfig();
            
            this.instance = pipeline(this.task, this.model, {
                quantized: this.quantized,
                progress_callback,

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
    // Check if this is a FunASR model
    if (model === 'funasr-runtime-sdk-online-cpu') {
        return await transcribeWithFunASR(audio, {
            format: 'wav',
            sampleRate: 16000
        });
    }

    const isDistilWhisper = model.startsWith("distil-whisper/");

    // Use the model name directly since it's already properly formatted in ModelSelector.tsx
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
