// 通用工具函数库
// 提供常用的辅助函数，提高代码复用性和可维护性

import { AudioFormat, TranscriptionError, TranscriptionErrorCode } from '../types';

// 音频处理工具
export class AudioUtils {
  /**
   * 检测音频文件格式
   */
  static detectFormat(file: File): AudioFormat {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type.toLowerCase();
    
    if (mimeType.includes('wav') || extension === 'wav') return 'wav';
    if (mimeType.includes('mp3') || extension === 'mp3') return 'mp3';
    if (mimeType.includes('ogg') || extension === 'ogg') return 'ogg';
    if (mimeType.includes('flac') || extension === 'flac') return 'flac';
    if (mimeType.includes('m4a') || extension === 'm4a') return 'm4a';
    
    throw new TranscriptionError(
      `Unsupported audio format: ${extension || mimeType}`,
      'INVALID_AUDIO_FORMAT'
    );
  }

  /**
   * 验证音频文件
   */
  static validateAudioFile(file: File, maxSize = 100 * 1024 * 1024): void {
    if (!file) {
      throw new TranscriptionError('No file provided', 'INVALID_AUDIO_FORMAT');
    }

    if (file.size > maxSize) {
      throw new TranscriptionError(
        `File size ${this.formatFileSize(file.size)} exceeds maximum ${this.formatFileSize(maxSize)}`,
        'INVALID_AUDIO_FORMAT'
      );
    }

    try {
      this.detectFormat(file);
    } catch (error) {
      throw new TranscriptionError(
        `Invalid audio format: ${file.type}`,
        'INVALID_AUDIO_FORMAT'
      );
    }
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 格式化音频时长
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 将 ArrayBuffer 转换为 Base64
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 将 Base64 转换为 ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// 性能监控工具
export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  private static metrics = new Map<string, number[]>();

  /**
   * 开始计时
   */
  static startTimer(label: string): void {
    this.timers.set(label, performance.now());
  }

  /**
   * 结束计时并返回耗时
   */
  static endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`Timer '${label}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);
    
    // 记录到指标中
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);

    return duration;
  }

  /**
   * 获取性能统计
   */
  static getStats(label: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) return null;

    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max, count: values.length };
  }

  /**
   * 清除所有指标
   */
  static clearMetrics(): void {
    this.timers.clear();
    this.metrics.clear();
  }
}

// 重试工具
export class RetryHelper {
  /**
   * 执行带重试的异步操作
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      backoffFactor?: number;
      shouldRetry?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2,
      shouldRetry = () => true
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }

        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
        
        console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * 延迟函数
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 缓存工具
export class CacheManager {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  /**
   * 设置缓存
   */
  static set(key: string, data: any, ttl = 300000): void { // 默认5分钟
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * 获取缓存
   */
  static get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * 删除缓存
   */
  static delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清除所有缓存
   */
  static clear(): void {
    this.cache.clear();
  }

  /**
   * 清除过期缓存
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// 事件发射器
export class EventEmitter {
  private events = new Map<string, Function[]>();

  /**
   * 监听事件
   */
  on(event: string, callback: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  /**
   * 监听事件（一次性）
   */
  once(event: string, callback: Function): void {
    const onceCallback = (...args: any[]) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  /**
   * 移除事件监听
   */
  off(event: string, callback: Function): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event callback for '${event}':`, error);
        }
      });
    }
  }

  /**
   * 移除所有事件监听
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

// 环境检测工具
export class EnvironmentDetector {
  /**
   * 检测是否在浏览器环境
   */
  static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * 检测是否在 Web Worker 环境
   */
  static isWebWorker(): boolean {
    return typeof self !== 'undefined' && 'importScripts' in self && typeof (self as any).importScripts === 'function';
  }

  /**
   * 检测是否支持 WebAssembly
   */
  static supportsWebAssembly(): boolean {
    return typeof WebAssembly !== 'undefined';
  }

  /**
   * 检测是否支持 Web Workers
   */
  static supportsWebWorkers(): boolean {
    return typeof Worker !== 'undefined';
  }

  /**
   * 检测是否支持 WebSocket
   */
  static supportsWebSocket(): boolean {
    return typeof WebSocket !== 'undefined';
  }

  /**
   * 获取浏览器信息
   */
  static getBrowserInfo(): { name: string; version: string } {
    if (!this.isBrowser()) {
      return { name: 'unknown', version: 'unknown' };
    }

    const userAgent = navigator.userAgent;
    let name = 'unknown';
    let version = 'unknown';

    if (userAgent.includes('Chrome')) {
      name = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'unknown';
    } else if (userAgent.includes('Firefox')) {
      name = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? match[1] : 'unknown';
    } else if (userAgent.includes('Safari')) {
      name = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      version = match ? match[1] : 'unknown';
    }

    return { name, version };
  }
}

// 日志工具
export class Logger {
  private static context: Record<string, any> = {};
  private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  /**
   * 设置日志级别
   */
  static setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  /**
   * 设置上下文
   */
  static setContext(key: string, value: any): void {
    this.context[key] = value;
  }

  /**
   * 清除上下文
   */
  static clearContext(): void {
    this.context = {};
  }

  /**
   * 记录日志
   */
  private static log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[this.logLevel]) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data: this.sanitizeData(data)
    };

    const consoleMethod = level === 'debug' ? 'log' : level;
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, logEntry);
  }

  /**
   * 清理敏感数据
   */
  private static sanitizeData(data: any): any {
    if (!data) return data;
    
    const sensitive = ['password', 'token', 'apiKey', 'secret', 'key'];
    const sanitized = JSON.parse(JSON.stringify(data));
    
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      for (const key in obj) {
        if (sensitive.some(s => key.toLowerCase().includes(s))) {
          obj[key] = '***';
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
      return obj;
    };
    
    return sanitizeObject(sanitized);
  }

  static debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  static info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  static warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  static error(message: string, data?: any): void {
    this.log('error', message, data);
  }
}

// 工具函数导出
export const utils = {
  AudioUtils,
  PerformanceMonitor,
  RetryHelper,
  CacheManager,
  EventEmitter,
  EnvironmentDetector,
  Logger
};

export default utils;