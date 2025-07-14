interface User {
    id: string;
    name: string;
    email?: string;
}

interface Note {
    id: string;
    userId: string;
    title: string;
    content: string;
    tags: string[];
    versions: NoteVersion[];
    created: number;
    lastEdited: number;
    status: 'draft' | 'transcribing' | 'completed' | 'error';
    audioUrl?: string;
    transcriptionProgress?: number;
    errorMessage?: string;
}

interface NoteVersion {
    content: string;
    timestamp: number;
    description: string;
}

interface CreateNoteRequest {
    userId: string;
    title: string;
    content?: string;
    tags?: string[];
    audioFile?: File;
}

interface UpdateNoteRequest {
    id: string;
    title?: string;
    content?: string;
    tags?: string[];
}

interface TranscriptionJob {
    id: string;
    noteId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: string;
    error?: string;
    createdAt: number;
    completedAt?: number;
}

class BackendAPI {
    private baseUrl: string;
    private currentUserId: string | null = null;

    constructor(baseUrl: string = 'http://localhost:3001/api') {
        this.baseUrl = baseUrl;
    }

    setUserId(userId: string) {
        this.currentUserId = userId;
    }

    getCurrentUserId(): string | null {
        return this.currentUserId;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const config: RequestInit = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.currentUserId && { 'X-User-ID': this.currentUserId }),
                ...options.headers,
            },
            ...options,
        };

        const response = await fetch(url, config);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // User management
    async createUser(name: string, email?: string): Promise<User> {
        return this.request<User>('/users', {
            method: 'POST',
            body: JSON.stringify({ name, email }),
        });
    }

    async getUser(userId: string): Promise<User> {
        return this.request<User>(`/users/${userId}`);
    }

    // Note management
    async getNotes(userId: string): Promise<Note[]> {
        return this.request<Note[]>(`/notes?userId=${userId}`);
    }

    async getNote(noteId: string): Promise<Note> {
        return this.request<Note>(`/notes/${noteId}`);
    }

    async createNote(data: CreateNoteRequest): Promise<Note> {
        if (data.audioFile) {
            // Handle file upload
            const formData = new FormData();
            formData.append('userId', data.userId);
            formData.append('title', data.title);
            if (data.content) formData.append('content', data.content);
            if (data.tags) formData.append('tags', JSON.stringify(data.tags));
            formData.append('audioFile', data.audioFile);

            const response = await fetch(`${this.baseUrl}/notes/with-audio`, {
                method: 'POST',
                headers: {
                    ...(this.currentUserId && { 'X-User-ID': this.currentUserId }),
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            return response.json();
        } else {
            return this.request<Note>('/notes', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        }
    }

    async updateNote(data: UpdateNoteRequest): Promise<Note> {
        return this.request<Note>(`/notes/${data.id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteNote(noteId: string): Promise<void> {
        await this.request(`/notes/${noteId}`, {
            method: 'DELETE',
        });
    }

    async saveNoteVersion(noteId: string, description: string): Promise<Note> {
        return this.request<Note>(`/notes/${noteId}/versions`, {
            method: 'POST',
            body: JSON.stringify({ description }),
        });
    }

    async restoreNoteVersion(noteId: string, versionIndex: number): Promise<Note> {
        return this.request<Note>(`/notes/${noteId}/versions/${versionIndex}/restore`, {
            method: 'POST',
        });
    }

    // Transcription management
    async getTranscriptionJob(jobId: string): Promise<TranscriptionJob> {
        return this.request<TranscriptionJob>(`/transcription/jobs/${jobId}`);
    }

    async getTranscriptionJobByNoteId(noteId: string): Promise<TranscriptionJob | null> {
        try {
            return await this.request<TranscriptionJob>(`/transcription/jobs/note/${noteId}`);
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }

    async startTranscription(noteId: string, audioFile: File): Promise<TranscriptionJob> {
        const formData = new FormData();
        formData.append('noteId', noteId);
        formData.append('audioFile', audioFile);

        const response = await fetch(`${this.baseUrl}/transcription/start`, {
            method: 'POST',
            headers: {
                ...(this.currentUserId && { 'X-User-ID': this.currentUserId }),
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        return response.json();
    }



    // Polling for transcription updates
    async pollTranscriptionStatus(noteId: string, onUpdate: (job: TranscriptionJob) => void): Promise<TranscriptionJob> {
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const job = await this.getTranscriptionJobByNoteId(noteId);
                    if (!job) {
                        reject(new Error('Transcription job not found'));
                        return;
                    }

                    onUpdate(job);

                    if (job.status === 'completed' || job.status === 'failed') {
                        resolve(job);
                    } else {
                        setTimeout(poll, 2000); // Poll every 2 seconds
                    }
                } catch (error) {
                    reject(error);
                }
            };

            poll();
        });
    }
}

export const backendAPI = new BackendAPI();
export type { User, Note, NoteVersion, CreateNoteRequest, UpdateNoteRequest, TranscriptionJob };