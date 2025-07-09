import React, { useState, useEffect } from 'react';
import { DifyConfig } from '../utils/DifyAPI';

interface Props {
    config: DifyConfig;
    onConfigChange: (config: Partial<DifyConfig>) => void;
    className?: string;
}

export function WorkflowConfig({ config, onConfigChange, className = '' }: Props): React.ReactElement {
    const [localConfig, setLocalConfig] = useState(config);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleInputChange = (field: keyof DifyConfig, value: string) => {
        const newConfig = { ...localConfig, [field]: value };
        setLocalConfig(newConfig);
        onConfigChange({ [field]: value });
    };

    const handleSaveToEnv = () => {
        const envContent = `# Dify Workflow Configuration
VITE_DIFY_API_KEY=${localConfig.apiKey}
VITE_DIFY_BASE_URL=${localConfig.baseUrl}
VITE_DIFY_WORKFLOW_ID=${localConfig.workflowId || ''}`;
        
        const blob = new Blob([envContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '.env.local';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`bg-slate-50 rounded-lg p-4 ${className}`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between text-left text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Workflow Configuration
                </span>
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isExpanded && (
                <div className="mt-4 space-y-4">
                    <div>
                        <label htmlFor="api-key" className="block text-xs font-medium text-slate-600 mb-1">
                            API Key *
                        </label>
                        <input
                            id="api-key"
                            type="password"
                            value={localConfig.apiKey}
                            onChange={(e) => handleInputChange('apiKey', e.target.value)}
                            placeholder="Enter your Dify API key"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label htmlFor="base-url" className="block text-xs font-medium text-slate-600 mb-1">
                            Base URL
                        </label>
                        <input
                            id="base-url"
                            type="url"
                            value={localConfig.baseUrl}
                            onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                            placeholder="https://api.dify.ai/v1"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label htmlFor="workflow-id" className="block text-xs font-medium text-slate-600 mb-1">
                            Workflow ID (Optional)
                        </label>
                        <input
                            id="workflow-id"
                            type="text"
                            value={localConfig.workflowId || ''}
                            onChange={(e) => handleInputChange('workflowId', e.target.value)}
                            placeholder="Enter workflow ID if needed"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleSaveToEnv}
                            className="flex-1 px-3 py-2 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors flex items-center justify-center gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download .env
                        </button>
                        
                        <div className="flex-1 text-xs text-slate-500 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Settings are saved locally
                        </div>
                    </div>

                    {!localConfig.apiKey && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <div className="flex items-start gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <div className="text-xs text-yellow-800">
                                    <p className="font-medium mb-1">API Key Required</p>
                                    <p>You need to configure your Dify API key to use the workflow feature. Get your API key from your Dify dashboard.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}