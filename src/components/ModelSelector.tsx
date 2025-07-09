import React, { ChangeEvent } from 'react';

interface ModelOption {
    id: string;
    name: string;
    description: string;
    isEnglishOnly: boolean;
    size: 'tiny' | 'small' | 'base' | 'medium' | 'large' | 'large-v2';
    isBeta?: boolean;
}

const modelOptions: ModelOption[] = [
    {
        id: 'Xenova/whisper-tiny.en',
        name: 'Tiny (English)',
        description: 'Fast, lightweight model optimized for English transcription',
        isEnglishOnly: true,
        size: 'tiny'
    },
    {
        id: 'Xenova/whisper-tiny',
        name: 'Tiny (Multilingual)',
        description: 'Fast, lightweight model supporting multiple languages',
        isEnglishOnly: false,
        size: 'tiny'
    },
    {
        id: 'Xenova/whisper-small.en',
        name: 'Small (English)',
        description: 'Balanced performance for English transcription',
        isEnglishOnly: true,
        size: 'small'
    },
    {
        id: 'Xenova/whisper-small',
        name: 'Small (Multilingual)',
        description: 'Balanced performance supporting multiple languages',
        isEnglishOnly: false,
        size: 'small'
    },
    {
        id: 'Xenova/whisper-base.en',
        name: 'Base (English)',
        description: 'Standard model for English transcription',
        isEnglishOnly: true,
        size: 'base'
    },
    {
        id: 'Xenova/whisper-base',
        name: 'Base (Multilingual)',
        description: 'Standard model supporting multiple languages',
        isEnglishOnly: false,
        size: 'base'
    },
    {
        id: 'Xenova/whisper-medium.en',
        name: 'Medium (English)',
        description: 'High accuracy for English transcription',
        isEnglishOnly: true,
        size: 'medium'
    },
    {
        id: 'Xenova/whisper-large',
        name: 'Large',
        description: 'Highest accuracy for multilingual transcription',
        isEnglishOnly: false,
        size: 'large'
    },
    {
        id: 'Xenova/whisper-large-v2',
        name: 'Large V2',
        description: 'Latest version with improved accuracy',
        isEnglishOnly: false,
        size: 'large-v2'
    },
    {
        id: 'Xenova/nb-whisper-tiny-beta',
        name: 'Tiny Beta',
        description: 'Experimental tiny model with new features',
        isEnglishOnly: false,
        size: 'tiny',
        isBeta: true
    },
    {
        id: 'Xenova/nb-whisper-small-beta',
        name: 'Small Beta',
        description: 'Experimental small model with new features',
        isEnglishOnly: false,
        size: 'small',
        isBeta: true
    },
    {
        id: 'Xenova/nb-whisper-base-beta',
        name: 'Base Beta',
        description: 'Experimental base model with new features',
        isEnglishOnly: false,
        size: 'base',
        isBeta: true
    },
    {
        id: 'Xenova/nb-whisper-medium-beta',
        name: 'Medium Beta',
        description: 'Experimental medium model with new features',
        isEnglishOnly: false,
        size: 'medium',
        isBeta: true
    }
];

interface Props {
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    className?: string;
}

export function ModelSelector({ selectedModel, onModelChange, className = '' }: Props): React.ReactElement {
    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        onModelChange(e.target.value);
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <label htmlFor="model-select" className="block text-sm font-medium text-slate-600">
                Transcription Model
            </label>
            <select
                id="model-select"
                value={selectedModel}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700"
            >
                {modelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.name} {option.isBeta ? '(Beta)' : ''} - {option.description}
                    </option>
                ))}
            </select>
            <p className="text-sm text-slate-500">
                {modelOptions.find(m => m.id === selectedModel)?.isEnglishOnly 
                    ? 'This model is optimized for English only.'
                    : 'This model supports multiple languages.'}
            </p>
        </div>
    );
}
