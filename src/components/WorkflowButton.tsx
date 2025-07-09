import React from 'react';
import { Spinner } from './TranscribeButton';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isProcessing: boolean;
}

export function WorkflowButton(props: Props): JSX.Element {
    const { isProcessing, onClick, ...buttonProps } = props;
    
    return (
        <button
            {...buttonProps}
            onClick={(event) => {
                if (onClick && !isProcessing) {
                    onClick(event);
                }
            }}
            disabled={isProcessing}
            className='flex-1 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-lg font-semibold flex items-center justify-center gap-3 disabled:bg-purple-400 disabled:cursor-not-allowed'
        >
            {isProcessing ? (
                <Spinner text={"Processing workflow..."} />
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Transcribe with Workflow
                </>
            )}
        </button>
    );
}