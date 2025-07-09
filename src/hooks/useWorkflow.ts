import { useState, useCallback } from 'react';
import { DifyAPIClient, DifyConfig, WorkflowResponse, defaultDifyConfig } from '../utils/DifyAPI';

export interface WorkflowState {
    isProcessing: boolean;
    result: WorkflowResponse | null;
    error: string | null;
    progress: string;
}

export interface UseWorkflowReturn {
    state: WorkflowState;
    processAudio: (audioBlob: Blob, fileName: string, additionalInputs?: Record<string, any>) => Promise<void>;
    reset: () => void;
    updateConfig: (config: Partial<DifyConfig>) => void;
}

export function useWorkflow(initialConfig?: Partial<DifyConfig>): UseWorkflowReturn {
    const [client, setClient] = useState(() => 
        new DifyAPIClient({ ...defaultDifyConfig, ...initialConfig })
    );
    
    const [state, setState] = useState<WorkflowState>({
        isProcessing: false,
        result: null,
        error: null,
        progress: '',
    });

    const updateConfig = useCallback((config: Partial<DifyConfig>) => {
        setClient(new DifyAPIClient({ ...defaultDifyConfig, ...config }));
    }, []);

    const reset = useCallback(() => {
        setState({
            isProcessing: false,
            result: null,
            error: null,
            progress: '',
        });
    }, []);

    const processAudio = useCallback(async (
        audioBlob: Blob,
        fileName: string,
        additionalInputs: Record<string, any> = {}
    ) => {
        setState(prev => ({
            ...prev,
            isProcessing: true,
            error: null,
            progress: 'Uploading audio file...',
        }));

        try {
            console.log('Warning!! Remember to DELETE this line before production! Config checking', client['config'].baseUrl,client['config'].apiKey);
            // Check if API key is configured
            if (!client['config'].apiKey) {
                throw new Error('Dify API key is not configured. Please set VITE_DIFY_API_KEY environment variable.');
            }

            setState(prev => ({ ...prev, progress: 'Starting workflow execution...' }));
            
            const response = await client.processAudioWithWorkflow(
                audioBlob,
                fileName,
                'default-user',
                additionalInputs
            );

            // If response mode is blocking, we should have the result immediately
            if (response.data.status === 'succeeded') {
                setState(prev => ({
                    ...prev,
                    isProcessing: false,
                    result: response,
                    progress: 'Workflow completed successfully!',
                }));
            } else if (response.data.status === 'failed') {
                throw new Error(response.data.error || 'Workflow execution failed');
            } else {
                // If still running, poll for completion
                setState(prev => ({ ...prev, progress: 'Waiting for workflow completion...' }));
                
                const finalResult = await client.pollWorkflowCompletion(
                    response.workflow_run_id,
                    'default-user'
                );

                if (finalResult.status === 'succeeded') {
                    setState(prev => ({
                        ...prev,
                        isProcessing: false,
                        result: { ...response, data: finalResult },
                        progress: 'Workflow completed successfully!',
                    }));
                } else {
                    throw new Error(finalResult.error || 'Workflow execution failed');
                }
            }
        } catch (error) {
            console.error('Workflow processing error:', error);
            setState(prev => ({
                ...prev,
                isProcessing: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                progress: '',
            }));
        }
    }, [client]);

    return {
        state,
        processAudio,
        reset,
        updateConfig,
    };
}