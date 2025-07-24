const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

class Database {
    constructor() {
        const dbDir = path.join(__dirname, '../../data');
        fs.ensureDirSync(dbDir);
        this.dbPath = path.join(dbDir, 'say.db');
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database.');
                    resolve();
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database connection closed.');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // 用户操作
    async createUser(name, email = null) {
        const id = uuidv4();
        const now = Date.now();
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO users (id, name, email, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run([id, name, email, now, now], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id, name, email });
                }
            });
            
            stmt.finalize();
        });
    }

    async getUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, name, email FROM users WHERE id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row || null);
                    }
                }
            );
        });
    }

    // 笔记操作
    async createNote(userId, title, content = '', tags = []) {
        const id = uuidv4();
        const now = Date.now();
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO notes (id, user_id, title, content, tags, created, last_edited)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([id, userId, title, content, JSON.stringify(tags), now, now], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id,
                        userId,
                        title,
                        content,
                        tags,
                        versions: [],
                        created: now,
                        lastEdited: now,
                        status: 'draft'
                    });
                }
            });
            
            stmt.finalize();
        });
    }

    async getNotes(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM notes WHERE user_id = ? ORDER BY last_edited DESC',
                [userId],
                async (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const notes = [];
                        for (const row of rows) {
                            const versions = await this.getNoteVersions(row.id);
                            notes.push({
                                id: row.id,
                                userId: row.user_id,
                                title: row.title,
                                content: row.content,
                                tags: JSON.parse(row.tags || '[]'),
                                versions,
                                created: row.created,
                                lastEdited: row.last_edited,
                                status: row.status,
                                audioUrl: row.audio_url,
                                transcriptionProgress: row.transcription_progress,
                                errorMessage: row.error_message
                            });
                        }
                        resolve(notes);
                    }
                }
            );
        });
    }

    async getNote(noteId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM notes WHERE id = ?',
                [noteId],
                async (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        const versions = await this.getNoteVersions(row.id);
                        resolve({
                            id: row.id,
                            userId: row.user_id,
                            title: row.title,
                            content: row.content,
                            tags: JSON.parse(row.tags || '[]'),
                            versions,
                            created: row.created,
                            lastEdited: row.last_edited,
                            status: row.status,
                            audioUrl: row.audio_url,
                            transcriptionProgress: row.transcription_progress,
                            errorMessage: row.error_message
                        });
                    }
                }
            );
        });
    }

    async updateNote(noteId, updates) {
        const now = Date.now();
        const fields = [];
        const values = [];
        
        if (updates.title !== undefined) {
            fields.push('title = ?');
            values.push(updates.title);
        }
        if (updates.content !== undefined) {
            fields.push('content = ?');
            values.push(updates.content);
        }
        if (updates.tags !== undefined) {
            fields.push('tags = ?');
            values.push(JSON.stringify(updates.tags));
        }
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.audioUrl !== undefined) {
            fields.push('audio_url = ?');
            values.push(updates.audioUrl);
        }
        if (updates.transcriptionProgress !== undefined) {
            fields.push('transcription_progress = ?');
            values.push(updates.transcriptionProgress);
        }
        if (updates.errorMessage !== undefined) {
            fields.push('error_message = ?');
            values.push(updates.errorMessage);
        }
        
        fields.push('last_edited = ?');
        values.push(now);
        values.push(noteId);
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE notes SET ${fields.join(', ')} WHERE id = ?
            `);
            
            stmt.run(values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    }

    async deleteNote(noteId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM notes WHERE id = ?',
                [noteId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // 管理员方法
    async getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM users ORDER BY created_at DESC',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => ({
                            id: row.id,
                            name: row.name,
                            email: row.email,
                            created: row.created_at
                        })));
                    }
                }
            );
        });
    }

    async getAllTranscriptionJobs() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM transcription_jobs ORDER BY created_at DESC',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => ({
                            id: row.id,
                            noteId: row.note_id,
                            status: row.status,
                            progress: row.progress,
                            result: row.result,
                            error: row.error,
                            createdAt: row.created_at,
                            completedAt: row.completed_at,
                            audioFilePath: row.audio_file_path
                        })));
                    }
                }
            );
        });
    }

    async deleteTranscriptionJob(jobId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM transcription_jobs WHERE id = ?',
                [jobId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // 笔记版本操作
    async saveNoteVersion(noteId, description) {
        const note = await this.getNote(noteId);
        if (!note) {
            throw new Error('Note not found');
        }
        
        const timestamp = Date.now();
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO note_versions (note_id, content, timestamp, description)
                VALUES (?, ?, ?, ?)
            `);
            
            stmt.run([noteId, note.content, timestamp, description], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    }

    async getNoteVersions(noteId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT content, timestamp, description FROM note_versions WHERE note_id = ? ORDER BY timestamp DESC',
                [noteId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    async restoreNoteVersion(noteId, versionIndex) {
        const versions = await this.getNoteVersions(noteId);
        if (versionIndex < 0 || versionIndex >= versions.length) {
            throw new Error('Invalid version index');
        }
        
        const version = versions[versionIndex];
        await this.updateNote(noteId, { content: version.content });
        return await this.getNote(noteId);
    }

    // 转录任务操作
    async createTranscriptionJob(noteId, audioFilePath) {
        const id = uuidv4();
        const now = Date.now();
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO transcription_jobs (id, note_id, status, progress, created_at, audio_file_path)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([id, noteId, 'pending', 0, now, audioFilePath], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id,
                        noteId,
                        status: 'pending',
                        progress: 0,
                        createdAt: now,
                        audioFilePath
                    });
                }
            });
            
            stmt.finalize();
        });
    }

    async getTranscriptionJob(jobId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM transcription_jobs WHERE id = ?',
                [jobId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        resolve({
                            id: row.id,
                            noteId: row.note_id,
                            status: row.status,
                            progress: row.progress,
                            result: row.result,
                            error: row.error,
                            createdAt: row.created_at,
                            completedAt: row.completed_at
                        });
                    }
                }
            );
        });
    }

    async getTranscriptionJobByNoteId(noteId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM transcription_jobs WHERE note_id = ?',
                [noteId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        resolve({
                            id: row.id,
                            noteId: row.note_id,
                            status: row.status,
                            progress: row.progress,
                            result: row.result,
                            error: row.error,
                            createdAt: row.created_at,
                            completedAt: row.completed_at
                        });
                    }
                }
            );
        });
    }

    async getTranscriptionJobsByNoteId(noteId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM transcription_jobs WHERE note_id = ? ORDER BY created_at DESC',
                [noteId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => ({
                            id: row.id,
                            noteId: row.note_id,
                            status: row.status,
                            progress: row.progress,
                            result: row.result,
                            error: row.error,
                            createdAt: row.created_at,
                            completedAt: row.completed_at,
                            audioFilePath: row.audio_file_path
                        })));
                    }
                }
            );
        });
    }

    async updateTranscriptionJob(jobId, updates) {
        const fields = [];
        const values = [];
        
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.progress !== undefined) {
            fields.push('progress = ?');
            values.push(updates.progress);
        }
        if (updates.result !== undefined) {
            fields.push('result = ?');
            values.push(updates.result);
        }
        if (updates.error !== undefined) {
            fields.push('error = ?');
            values.push(updates.error);
        }
        if (updates.completedAt !== undefined) {
            fields.push('completed_at = ?');
            values.push(updates.completedAt);
        }
        
        values.push(jobId);
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE transcription_jobs SET ${fields.join(', ')} WHERE id = ?
            `);
            
            stmt.run(values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    }

    async updateTranscriptionJobStatus(jobId, status, result = null) {
        const updates = { status };
        if (result !== null) {
            updates.result = result;
        }
        if (status === 'completed' || status === 'failed') {
            updates.completedAt = Date.now();
        }
        return this.updateTranscriptionJob(jobId, updates);
    }

    async updateNoteStatus(noteId, status) {
        return this.updateNote(noteId, { status });
    }
}

module.exports = Database;