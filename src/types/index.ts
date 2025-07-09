// 全局类型定义文件
// 提供更好的类型安全性和开发体验

// 音频相关类型
export interface AudioData {
  buffer: ArrayBuffer;
  sampleRate: number;
  channels: number;
  duration: number;
  format: AudioFormat;
}

export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'flac' | 'm4a';

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  duration: number;
  bitrate?: number;
  sampleRate: number;
  channels: number;
}

// 转录相关类型
export interface TranscriptionResult {
  text: string;
  confidence: number;
  segments?: TranscriptionSegment[];
  language?: string;
  processingTime: number;
  modelUsed: string;
  timestamp: Date;
}

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

export interface TranscriptionProgress {
  stage: TranscriptionStage;
  progress: number; // 0-100
  message?: string;
  estimatedTimeRemaining?: number;
}

export type TranscriptionStage = 
  | 'initializing'
  | 'loading-model'
  | 'preprocessing'
  | 'transcribing'
  | 'postprocessing'
  | 'completed'
  | 'error';

// 模型相关类型
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  size: ModelSize;
  languages: string[];
  isEnglishOnly: boolean;
  isRemoteService: boolean;
  capabilities: ModelCapability[];
  requirements: ModelRequirements;
}

export type ModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'funasr';

export type ModelCapability = 
  | 'real-time'
  | 'offline'
  | 'multilingual'
  | 'speaker-diarization'
  | 'punctuation'
  | 'timestamps';

export interface ModelRequirements {
  minMemory?: number; // MB
  internetRequired: boolean;
  dockerRequired?: boolean;
  gpuAcceleration?: boolean;
}

// FunASR 特定类型
export interface FunASRResponse {
  code: number;
  message?: string;
  result?: string;
  text?: string;
  segments?: FunASRSegment[];
  timestamp?: number;
}

export interface FunASRSegment {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface FunASRRequest {
  id: string;
  mode: 'offline' | 'online' | '2pass';
  audio_format: string;
  sample_rate: number;
  use_itn: boolean;
  hotwords?: string[];
  audio_data: string; // base64
}

// 错误类型
export class TranscriptionError extends Error {
  constructor(
    message: string,
    public code: TranscriptionErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export type TranscriptionErrorCode =
  | 'MODEL_LOAD_FAILED'
  | 'AUDIO_PROCESSING_FAILED'
  | 'NETWORK_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_AUDIO_FORMAT'
  | 'QUOTA_EXCEEDED'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

// 配置类型
export interface AppConfig {
  audio: AudioConfig;
  transcription: TranscriptionConfig;
  ui: UIConfig;
  performance: PerformanceConfig;
}

export interface AudioConfig {
  maxFileSize: number; // bytes
  supportedFormats: AudioFormat[];
  defaultSampleRate: number;
  maxDuration: number; // seconds
  enableNoiseReduction: boolean;
}

export interface TranscriptionConfig {
  defaultModel: string;
  enableFallback: boolean;
  maxRetries: number;
  timeout: number;
  enableCache: boolean;
  cacheSize: number; // MB
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  enableAnimations: boolean;
  showAdvancedOptions: boolean;
}

export interface PerformanceConfig {
  enableWebWorkers: boolean;
  maxConcurrentTranscriptions: number;
  enableGPUAcceleration: boolean;
  memoryLimit: number; // MB
}

// 事件类型
export interface TranscriptionEvent {
  type: TranscriptionEventType;
  data: any;
  timestamp: Date;
  modelId?: string;
}

export type TranscriptionEventType =
  | 'transcription-started'
  | 'transcription-progress'
  | 'transcription-completed'
  | 'transcription-failed'
  | 'model-loaded'
  | 'model-load-failed'
  | 'audio-uploaded'
  | 'audio-processed';

// Hook 返回类型
export interface UseTranscriberReturn {
  transcribe: (audio: File | ArrayBuffer) => Promise<TranscriptionResult>;
  isLoading: boolean;
  progress: TranscriptionProgress | null;
  error: TranscriptionError | null;
  result: TranscriptionResult | null;
  cancel: () => void;
  reset: () => void;
}

export interface UseModelSelectorReturn {
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  availableModels: ModelInfo[];
  isModelLoading: boolean;
  modelLoadError: Error | null;
  loadModel: (modelId: string) => Promise<void>;
}

// Worker 消息类型
export interface WorkerMessage {
  type: WorkerMessageType;
  data: any;
  id?: string;
}

export type WorkerMessageType =
  | 'transcribe'
  | 'load-model'
  | 'progress'
  | 'result'
  | 'error'
  | 'cancel';

// 存储类型
export interface StoredTranscription {
  id: string;
  filename: string;
  text: string;
  confidence: number;
  modelUsed: string;
  createdAt: Date;
  updatedAt: Date;
  audioMetadata: AudioMetadata;
  tags: string[];
}

export interface StorageQuota {
  used: number;
  available: number;
  total: number;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// 性能监控类型
export interface PerformanceMetrics {
  transcriptionTime: number;
  modelLoadTime: number;
  audioProcessingTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  networkLatency?: number;
}

// 用户偏好类型
export interface UserPreferences {
  defaultModel: string;
  autoSave: boolean;
  enableNotifications: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  audioQuality: 'low' | 'medium' | 'high';
  privacyMode: boolean;
}

// 导出所有类型的联合类型，便于类型检查
export type AllTypes = 
  | AudioData
  | TranscriptionResult
  | ModelInfo
  | FunASRResponse
  | TranscriptionError
  | AppConfig
  | TranscriptionEvent
  | WorkerMessage
  | StoredTranscription
  | PerformanceMetrics
  | UserPreferences;

// 类型守卫函数
export function isTranscriptionResult(obj: any): obj is TranscriptionResult {
  return obj && typeof obj.text === 'string' && typeof obj.confidence === 'number';
}

export function isTranscriptionError(obj: any): obj is TranscriptionError {
  return obj instanceof TranscriptionError;
}

export function isFunASRResponse(obj: any): obj is FunASRResponse {
  return obj && typeof obj.code === 'number';
}

// 常量定义
export const SUPPORTED_AUDIO_FORMATS: AudioFormat[] = ['wav', 'mp3', 'ogg', 'flac', 'm4a'];

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  supportedFormats: SUPPORTED_AUDIO_FORMATS,
  defaultSampleRate: 16000,
  maxDuration: 3600, // 1 hour
  enableNoiseReduction: true
};

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = {
  defaultModel: 'whisper-base',
  enableFallback: true,
  maxRetries: 3,
  timeout: 30000,
  enableCache: true,
  cacheSize: 500 // 500MB
};