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
        const response = await this.request<{success: boolean, data: User}>('/users', {
            method: 'POST',
            body: JSON.stringify({ name, email }),
        });
        return response.data;
    }

    async getUser(userId: string): Promise<User> {
        const response = await this.request<{success: boolean, data: User}>(`/users/${userId}`);
        return response.data;
    }

    // Note management
    async getNotes(userId: string): Promise<Note[]> {
        const response = await this.request<{success: boolean, data: Note[]}>(`/users/${userId}/notes`);
        return response.data;
    }

    async getNote(noteId: string): Promise<Note> {
        const response = await this.request<{success: boolean, data: Note}>(`/notes/${noteId}`);
        return response.data;
    }

    async createNote(data: CreateNoteRequest): Promise<Note> {
        if (data.audioFile) {
            // Handle file upload
            const formData = new FormData();
            formData.append('title', data.title);
            if (data.content) formData.append('content', data.content);
            if (data.tags) formData.append('tags', JSON.stringify(data.tags));
            formData.append('audio', data.audioFile);

            const response = await fetch(`${this.baseUrl}/users/${data.userId}/notes`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            return result.data;
        } else {
            const response = await this.request<{success: boolean, data: Note}>(`/users/${data.userId}/notes`, {
                method: 'POST',
                body: JSON.stringify({
                    title: data.title,
                    content: data.content,
                    tags: data.tags
                }),
            });
            return response.data;
        }
    }

    async updateNote(data: UpdateNoteRequest): Promise<Note> {
        const response = await this.request<{success: boolean, data: Note}>(`/notes/${data.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: data.title,
                content: data.content,
                tags: data.tags
            }),
        });
        return response.data;
    }

    async deleteNote(noteId: string): Promise<void> {
        await this.request<{success: boolean}>(`/notes/${noteId}`, {
            method: 'DELETE',
        });
    }

    async saveNoteVersion(noteId: string, content: string, versionName?: string): Promise<any> {
        const response = await this.request<{success: boolean, data: any}>(`/notes/${noteId}/versions`, {
            method: 'POST',
            body: JSON.stringify({ content, versionName }),
        });
        return response.data;
    }

    async restoreNoteVersion(noteId: string, versionId: string): Promise<Note> {
        const response = await this.request<{success: boolean, data: Note}>(`/notes/${noteId}/versions/${versionId}/restore`, {
            method: 'POST',
        });
        return response.data;
    }

    // 移除了复杂的转录管理方法，保留基本接口定义
}

export const backendAPI = new BackendAPI();
export type { User, Note, NoteVersion, CreateNoteRequest, UpdateNoteRequest, TranscriptionJob };