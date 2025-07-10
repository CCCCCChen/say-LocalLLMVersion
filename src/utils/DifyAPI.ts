// Dify Workflow API integration

export interface DifyConfig {
    apiKey: string;
    baseUrl: string;
    workflowId?: string;
}

export interface WorkflowInput {
    inputs: Record<string, any>;
    response_mode: 'blocking' | 'streaming';
    user: string;
    files?: File[];
}

export interface WorkflowResponse {
    workflow_run_id: string;
    task_id: string;
    data: {
        id: string;
        workflow_id: string;
        status: 'running' | 'succeeded' | 'failed' | 'stopped';
        outputs?: Record<string, any>;
        error?: string;
        elapsed_time?: number;
        total_tokens?: number;
        total_steps?: number;
        created_at: number;
        finished_at?: number;
    };
}

export interface FileUploadResponse {
    id: string;
    name: string;
    size: number;
    extension: string;
    mime_type: string;
    created_by: string;
    created_at: number;
}

export class DifyAPIClient {
    private config: DifyConfig;

    constructor(config: DifyConfig) {
        this.config = config;
        console.log('Dify API Client initialized with config:', config.apiKey, config.baseUrl);
    }

    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.config.baseUrl}${endpoint}`;
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Dify API Error (${response.status}): ${errorText}`);
        }

        return response.json();
    }

    private async makeFormRequest<T>(
        endpoint: string,
        formData: FormData
    ): Promise<T> {
        const url = `${this.config.baseUrl}${endpoint}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Dify API Error (${response.status}): ${errorText}`);
        }

        return response.json();
    }

    /**
     * Upload a file to Dify
     */
    async uploadFile(file: File, user: string): Promise<FileUploadResponse> {
        console.log('Uploading file:', file.name,file.type,file.size);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user', user);

        return this.makeFormRequest<FileUploadResponse>('/v1/files/upload', formData);
    }

    /**
     * Execute a workflow
     */
    async runWorkflow(input: WorkflowInput): Promise<WorkflowResponse> {
        console.log('Dify API Client running workflow with input:', input);
        return this.makeRequest<WorkflowResponse>('/v1/workflows/run', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(input),
        });
    }

    /**
     * Get workflow execution status
     */
    async getWorkflowStatus(
        workflowRunId: string,
        user: string
    ): Promise<WorkflowResponse['data']> {
        return this.makeRequest<WorkflowResponse['data']>(
            `/v1/workflows/runs/${workflowRunId}?user=${encodeURIComponent(user)}`
        );
    }

    /**
     * Get workflow execution logs
     */
    async getWorkflowLogs(
        workflowRunId: string,
        user: string
    ): Promise<any> {
        return this.makeRequest(
            `/v1/workflows/runs/${workflowRunId}/logs?user=${encodeURIComponent(user)}`
        );
    }

    /**
     * Process audio file with workflow
     */
    async processAudioWithWorkflow(
        audioBlob: Blob,
        fileName: string,
        user: string = 'default-user',
        additionalInputs: Record<string, any> = {}
    ): Promise<WorkflowResponse> {
        try {
            // Step 1: Upload the audio file with proper MIME type
            // Ensure the file has a proper audio MIME type
            const fileExtension = fileName.split('.').pop()?.toLowerCase();
            let audioMimeType;
            switch (fileExtension) {
                case 'mp3':
                case 'mpeg':
                    audioMimeType = 'audio/mpeg';
                    break;
                case 'wav':
                    audioMimeType = 'audio/wav';
                    break;
                case 'ogg':
                    audioMimeType = 'audio/ogg';
                    break;
                default:
                    audioMimeType = audioBlob.type || 'audio/wav';
            }
            console.log("fileExtension: ", fileExtension, "audioMimeType: ", audioMimeType);
            const audioFile = new File([audioBlob], fileName, { type: audioMimeType });
            const uploadResponse = await this.uploadFile(audioFile, user);
            console.log('Dify API Client uploaded file:', uploadResponse);
            
            // Step 2: Run workflow with the uploaded file
            const workflowInput: WorkflowInput = {
                inputs: {
                    speechFile: {
                        transfer_method: 'local_file',
                        upload_file_id: uploadResponse.id,
                        type: 'audio'
                    }
                },  
                response_mode: 'blocking',
                user,
            };

            return await this.runWorkflow(workflowInput);
        } catch (error) {
            console.error('Error processing audio with workflow:', error);
            throw error;
        }
    }

    /**
     * Poll workflow status until completion
     */
    async pollWorkflowCompletion(
        workflowRunId: string,
        user: string,
        maxAttempts: number = 60,
        intervalMs: number = 2000
    ): Promise<WorkflowResponse['data']> {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const status = await this.getWorkflowStatus(workflowRunId, user);
            
            if (status.status === 'succeeded' || status.status === 'failed' || status.status === 'stopped') {
                return status;
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        throw new Error('Workflow execution timeout');
    }
}

// Default configuration - users should override these values
export const defaultDifyConfig: DifyConfig = {
    apiKey: import.meta.env.VITE_DIFY_API_KEY || '',
    baseUrl: import.meta.env.VITE_DIFY_BASE_URL || 'https://api.dify.ai/v1',
    workflowId: import.meta.env.VITE_DIFY_WORKFLOW_ID || '',
};

// Create a default client instance
export const difyClient = new DifyAPIClient(defaultDifyConfig);