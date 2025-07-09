// 增强版转录Hook - 支持FunASR和Whisper

import { useCallback, useEffect, useMemo, useState } from "react";
import { transcriptionService, TranscriptionResult, TranscriptionOptions } from "../utils/TranscriptionService";
import { useWorker } from "./useWorker";
import Constants from "../utils/Constants";

interface ProgressItem {
    file: string;
    loaded: number;
    progress: number;
    total: number;
    name: string;
    status: string;
}

interface TranscriberUpdateData {
    data: [
        string,
        { chunks: { text: string; timestamp: [number, number | null] }[] },
    ];
    text: string;
}

interface TranscriberCompleteData {
    data: {
        text: string;
        chunks: { text: string; timestamp: [number, number | null] }[];
    };
}

export interface TranscriberData {
    isBusy: boolean;
    text: string;
    chunks: { text: string; timestamp: [number, number | null] }[];
    provider?: 'funasr' | 'whisper';
    processingTime?: number;
    confidence?: number;
}

export interface EnhancedTranscriber {
    onInputChange: () => void;
    isBusy: boolean;
    isModelLoading: boolean;
    progressItems: ProgressItem[];
    start: (audioData: AudioBuffer | undefined) => void;
    output?: TranscriberData;
    model: string;
    setModel: (model: string) => void;
    multilingual: boolean;
    setMultilingual: (model: boolean) => void;
    quantized: boolean;
    setQuantized: (model: boolean) => void;
    subtask: string;
    setSubtask: (subtask: string) => void;
    language?: string;
    setLanguage: (language: string) => void;
    // 新增的FunASR相关功能
    availableProviders: Array<'funasr' | 'whisper'>;
    currentProvider: 'funasr' | 'whisper' | null;
    serviceStatus: {
        funasr: boolean;
        whisper: boolean;
    };
    refreshServices: () => Promise<void>;
    hotwords: string[];
    setHotwords: (hotwords: string[]) => void;
}

export function useEnhancedTranscriber(): EnhancedTranscriber {
    const [transcript, setTranscript] = useState<TranscriberData | undefined>(undefined);
    const [isBusy, setIsBusy] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
    const [availableProviders, setAvailableProviders] = useState<Array<'funasr' | 'whisper'>>([]);
    const [currentProvider, setCurrentProvider] = useState<'funasr' | 'whisper' | null>(null);
    const [serviceStatus, setServiceStatus] = useState({ funasr: false, whisper: false });
    const [hotwords, setHotwords] = useState<string[]>([]);

    // Whisper相关状态
    const [model, setModel] = useState<string>(Constants.DEFAULT_MODEL);
    const [subtask, setSubtask] = useState<string>(Constants.DEFAULT_SUBTASK);
    const [quantized, setQuantized] = useState<boolean>(Constants.DEFAULT_QUANTIZED);
    const [multilingual, setMultilingual] = useState<boolean>(Constants.DEFAULT_MULTILINGUAL);
    const [language, setLanguage] = useState<string>(Constants.DEFAULT_LANGUAGE);

    // Whisper Worker (作为备选)
    const webWorker = useWorker((event) => {
        const message = event.data;
        switch (message.status) {
            case "progress":
                setProgressItems((prev) =>
                    prev.map((item) => {
                        if (item.file === message.file) {
                            return { ...item, progress: message.progress };
                        }
                        return item;
                    }),
                );
                break;
            case "update":
                const updateMessage = message as TranscriberUpdateData;
                setTranscript({
                    isBusy: true,
                    text: updateMessage.data[0],
                    chunks: updateMessage.data[1].chunks,
                    provider: 'whisper'
                });
                break;
            case "complete":
                const completeMessage = message as TranscriberCompleteData;
                setTranscript({
                    isBusy: false,
                    text: completeMessage.data.text,
                    chunks: completeMessage.data.chunks,
                    provider: 'whisper'
                });
                setIsBusy(false);
                break;
            case "initiate":
                setIsModelLoading(true);
                setProgressItems((prev) => [...prev, message]);
                break;
            case "ready":
                setIsModelLoading(false);
                break;
            case "error":
                setIsBusy(false);
                console.error('Whisper error:', message.data.message);
                alert(
                    `${message.data.message} This is most likely because you are using Safari on an M1/M2 Mac. Please try again from Chrome, Firefox, or Edge.\n\nIf this is not the case, please file a bug report.`,
                );
                break;
            case "done":
                setProgressItems((prev) =>
                    prev.filter((item) => item.file !== message.file),
                );
                break;
        }
    });

    // 初始化转录服务
    useEffect(() => {
        const initServices = async () => {
            try {
                await transcriptionService.initialize();
                await refreshServices();
            } catch (error) {
                console.error('Failed to initialize transcription services:', error);
            }
        };
        
        initServices();
        
        // 清理函数
        return () => {
            transcriptionService.dispose();
        };
    }, []);

    // 刷新服务状态
    const refreshServices = useCallback(async () => {
        try {
            const status = await transcriptionService.testServices();
            setServiceStatus(status);
            
            const providers = transcriptionService.getAvailableProviders();
            setAvailableProviders(providers);
            
            // 设置当前提供者
            if (providers.includes('funasr')) {
                setCurrentProvider('funasr');
            } else if (providers.includes('whisper')) {
                setCurrentProvider('whisper');
            } else {
                setCurrentProvider(null);
            }
        } catch (error) {
            console.error('Failed to refresh services:', error);
        }
    }, []);

    const onInputChange = useCallback(() => {
        setTranscript(undefined);
    }, []);

    // 统一的转录请求处理
    const postRequest = useCallback(
        async (audioData: AudioBuffer | undefined) => {
            if (!audioData) return;

            setTranscript(undefined);
            setIsBusy(true);

            try {
                // 准备音频数据
                let audio: Float32Array;
                if (audioData.numberOfChannels === 2) {
                    const SCALING_FACTOR = Math.sqrt(2);
                    const left = audioData.getChannelData(0);
                    const right = audioData.getChannelData(1);
                    audio = new Float32Array(left.length);
                    for (let i = 0; i < audioData.length; ++i) {
                        audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2;
                    }
                } else {
                    audio = audioData.getChannelData(0);
                }

                // 转换为ArrayBuffer
                const audioBuffer = audio.buffer.slice(
                    audio.byteOffset,
                    audio.byteOffset + audio.byteLength
                );

                // 准备转录选项
                const options: TranscriptionOptions = {
                    language: multilingual && language !== "auto" ? language : undefined,
                    hotwords: hotwords.length > 0 ? hotwords : undefined,
                    useTimestamps: true,
                    sampleRate: audioData.sampleRate
                };

                // 使用统一转录服务
                const result: TranscriptionResult = await transcriptionService.transcribe(
                    audioBuffer,
                    options
                );

                // 转换结果格式
                const chunks = result.segments?.map(segment => ({
                    text: segment.text,
                    timestamp: [segment.start, segment.end] as [number, number | null]
                })) || [{ text: result.text, timestamp: [0, null] as [number, number | null] }];

                setTranscript({
                    isBusy: false,
                    text: result.text,
                    chunks,
                    provider: result.provider,
                    processingTime: result.processingTime,
                    confidence: result.confidence
                });

                setCurrentProvider(result.provider);
                console.log(`✅ Transcription completed using ${result.provider} in ${result.processingTime}ms`);

            } catch (error) {
                console.error('Transcription failed:', error);
                
                // 如果统一服务失败，尝试使用原始Whisper Worker作为最后备选
                if (currentProvider !== 'whisper') {
                    console.log('🔄 Falling back to original Whisper worker...');
                    webWorker.postMessage({
                        audio,
                        model,
                        multilingual,
                        quantized,
                        subtask: multilingual ? subtask : null,
                        language: multilingual && language !== "auto" ? language : null,
                    });
                    return;
                }
                
                setIsBusy(false);
                alert(`转录失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        },
        [model, multilingual, quantized, subtask, language, hotwords, currentProvider, webWorker]
    );

    const transcriber = useMemo(() => {
        return {
            onInputChange,
            isBusy,
            isModelLoading,
            progressItems,
            start: postRequest,
            output: transcript,
            model,
            setModel,
            multilingual,
            setMultilingual,
            quantized,
            setQuantized,
            subtask,
            setSubtask,
            language,
            setLanguage,
            // 新增功能
            availableProviders,
            currentProvider,
            serviceStatus,
            refreshServices,
            hotwords,
            setHotwords,
        };
    }, [
        isBusy,
        isModelLoading,
        progressItems,
        postRequest,
        transcript,
        model,
        multilingual,
        quantized,
        subtask,
        language,
        availableProviders,
        currentProvider,
        serviceStatus,
        refreshServices,
        hotwords,
    ]);

    return transcriber;
}