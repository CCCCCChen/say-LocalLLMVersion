// 转录设置组件 - 支持FunASR和Whisper配置

import React, { useState, useEffect } from 'react';
import { transcriptionService } from '../utils/TranscriptionService';
import { loadFunASRConfig } from '../utils/FunASRConfig';

interface TranscriptionSettingsProps {
    // Whisper设置
    model: string;
    setModel: (model: string) => void;
    multilingual: boolean;
    setMultilingual: (multilingual: boolean) => void;
    quantized: boolean;
    setQuantized: (quantized: boolean) => void;
    subtask: string;
    setSubtask: (subtask: string) => void;
    language?: string;
    setLanguage: (language: string) => void;
    
    // 增强功能
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

const WHISPER_MODELS = [
    'whisper-tiny',
    'whisper-tiny.en',
    'whisper-base',
    'whisper-base.en',
    'whisper-small',
    'whisper-small.en',
    'whisper-medium',
    'whisper-medium.en',
    'whisper-large',
    'whisper-large-v2',
    'whisper-large-v3'
];

const LANGUAGES = [
    { code: 'auto', name: '自动检测' },
    { code: 'zh', name: '中文' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ru', name: 'Русский' },
    { code: 'ar', name: 'العربية' }
];

const SUBTASKS = [
    { value: 'transcribe', label: '转录' },
    { value: 'translate', label: '翻译为英文' }
];

export const TranscriptionSettings: React.FC<TranscriptionSettingsProps> = ({
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
    availableProviders,
    currentProvider,
    serviceStatus,
    refreshServices,
    hotwords,
    setHotwords
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hotwordInput, setHotwordInput] = useState('');
    const [funasrConfig, setFunasrConfig] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 加载FunASR配置
    useEffect(() => {
        const config = loadFunASRConfig();
        setFunasrConfig(config);
    }, []);

    // 刷新服务状态
    const handleRefreshServices = async () => {
        setIsRefreshing(true);
        try {
            await refreshServices();
        } catch (error) {
            console.error('Failed to refresh services:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    // 添加热词
    const addHotword = () => {
        if (hotwordInput.trim() && !hotwords.includes(hotwordInput.trim())) {
            setHotwords([...hotwords, hotwordInput.trim()]);
            setHotwordInput('');
        }
    };

    // 删除热词
    const removeHotword = (index: number) => {
        setHotwords(hotwords.filter((_, i) => i !== index));
    };

    // 处理回车键添加热词
    const handleHotwordKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addHotword();
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            {/* 标题和展开按钮 */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">转录设置</h3>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                >
                    {isExpanded ? '收起' : '展开'}
                </button>
            </div>

            {/* 服务状态概览 */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">服务状态</span>
                    <button
                        onClick={handleRefreshServices}
                        disabled={isRefreshing}
                        className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded disabled:opacity-50"
                    >
                        {isRefreshing ? '刷新中...' : '刷新'}
                    </button>
                </div>
                <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                            serviceStatus.funasr ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span>FunASR {serviceStatus.funasr ? '可用' : '不可用'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                            serviceStatus.whisper ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span>Whisper {serviceStatus.whisper ? '可用' : '不可用'}</span>
                    </div>
                </div>
                {currentProvider && (
                    <div className="mt-2 text-sm text-blue-600">
                        当前使用: {currentProvider === 'funasr' ? 'FunASR' : 'Whisper'}
                    </div>
                )}
            </div>

            {/* 详细设置 */}
            {isExpanded && (
                <div className="space-y-6">
                    {/* FunASR 设置 */}
                    {funasrConfig?.enabled && (
                        <div className="border-t pt-4">
                            <h4 className="text-md font-medium text-gray-800 mb-3">FunASR 设置</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        服务地址
                                    </label>
                                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                        {funasrConfig.host}:{funasrConfig.port}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        模式
                                    </label>
                                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                        {funasrConfig.mode}
                                    </div>
                                </div>
                            </div>

                            {/* 热词设置 */}
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    热词 (提高特定词汇识别准确率)
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={hotwordInput}
                                        onChange={(e) => setHotwordInput(e.target.value)}
                                        onKeyPress={handleHotwordKeyPress}
                                        placeholder="输入热词，按回车添加"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={addHotword}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        添加
                                    </button>
                                </div>
                                {hotwords.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {hotwords.map((word, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                                            >
                                                {word}
                                                <button
                                                    onClick={() => removeHotword(index)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Whisper 设置 */}
                    <div className="border-t pt-4">
                        <h4 className="text-md font-medium text-gray-800 mb-3">Whisper 设置</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    模型
                                </label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {WHISPER_MODELS.map((modelName) => (
                                        <option key={modelName} value={modelName}>
                                            {modelName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    任务类型
                                </label>
                                <select
                                    value={subtask}
                                    onChange={(e) => setSubtask(e.target.value)}
                                    disabled={!multilingual}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                >
                                    {SUBTASKS.map((task) => (
                                        <option key={task.value} value={task.value}>
                                            {task.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {multilingual && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        语言
                                    </label>
                                    <select
                                        value={language || 'auto'}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {LANGUAGES.map((lang) => (
                                            <option key={lang.code} value={lang.code}>
                                                {lang.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* 开关选项 */}
                        <div className="mt-4 space-y-3">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={multilingual}
                                    onChange={(e) => setMultilingual(e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-sm text-gray-700">多语言模式</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={quantized}
                                    onChange={(e) => setQuantized(e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-sm text-gray-700">量化模型 (更快，但精度略低)</span>
                            </label>
                        </div>
                    </div>

                    {/* 环境配置提示 */}
                    {!funasrConfig?.enabled && (
                        <div className="border-t pt-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                <h5 className="text-sm font-medium text-yellow-800 mb-1">配置 FunASR 服务</h5>
                                <p className="text-sm text-yellow-700 mb-2">
                                    要使用 FunASR 服务，请在项目根目录创建 .env 文件并配置以下参数：
                                </p>
                                <pre className="text-xs bg-yellow-100 p-2 rounded overflow-x-auto">
{`FUNASR_ENABLED=true
FUNASR_HOST=localhost
FUNASR_PORT=10095
FUNASR_MODE=offline`}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TranscriptionSettings;