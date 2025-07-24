const express = require('express');
const Database = require('../database/db');
const FunASRService = require('../services/funasrService');
const FunASRDockerService = require('../services/funasrDockerService');
const { upload, handleUploadError, validateUploadedFile, cleanupFile } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const db = new Database();

// 根据环境变量选择FunASR服务类型
const USE_DOCKER_FUNASR = process.env.USE_DOCKER_FUNASR === 'true';
const funasrService = USE_DOCKER_FUNASR ? new FunASRDockerService() : new FunASRService();

console.log(`FunASR Service Type: ${USE_DOCKER_FUNASR ? 'Docker' : 'Direct'}`);

// 初始化数据库连接
db.connect();

// 用户相关API

// 创建用户
router.post('/users', async (req, res) => {
    try {
        const { name, email } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                error: '用户名不能为空'
            });
        }
        
        const user = await db.createUser(name, email);
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取用户信息
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await db.getUser(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 笔记相关API

// 获取用户的所有笔记
router.get('/users/:userId/notes', async (req, res) => {
    try {
        const { userId } = req.params;
        const notes = await db.getNotes(userId);
        
        res.json({
            success: true,
            data: notes
        });
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取单个笔记
router.get('/notes/:noteId', async (req, res) => {
    try {
        const { noteId } = req.params;
        const note = await db.getNote(noteId);
        
        if (!note) {
            return res.status(404).json({
                success: false,
                error: '笔记不存在'
            });
        }
        
        res.json({
            success: true,
            data: note
        });
    } catch (error) {
        console.error('Get note error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 创建笔记（支持音频文件上传）
router.post('/users/:userId/notes', upload.single('audio'), handleUploadError, async (req, res) => {
    try {
        const { userId } = req.params;
        const { title, content, tags } = req.body;
        
        // 解析tags（如果是字符串）
        let parsedTags = [];
        if (tags) {
            try {
                parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
            } catch (e) {
                parsedTags = typeof tags === 'string' ? [tags] : tags;
            }
        }
        
        // 创建笔记
        const note = await db.createNote(
            userId, 
            title || '新笔记',
            content || '',
            parsedTags
        );
        
        // 如果有音频文件，更新笔记状态和音频URL
        if (req.file) {
            await db.updateNote(note.id, { 
                status: 'transcribing',
                audioUrl: `/uploads/${path.basename(req.file.path)}`
            });
            note.status = 'transcribing';
            note.audioUrl = `/uploads/${path.basename(req.file.path)}`;
        }
        
        // 如果有音频文件，尝试启动转录任务
        if (req.file) {
            try {
                // 检查是否已存在转录任务
                let transcriptionJob = await db.getTranscriptionJobByNoteId(note.id);
                
                if (transcriptionJob) {
                    // 如果已存在，更新音频文件路径和状态
                    await db.updateTranscriptionJob(transcriptionJob.id, {
                        status: 'pending',
                        progress: 0,
                        result: null,
                        error: null
                    });
                    transcriptionJob.status = 'pending';
                } else {
                    // 创建新的转录任务
                    transcriptionJob = await db.createTranscriptionJob(note.id, req.file.path);
                }
                
                // 异步处理转录（不阻塞响应）
                processTranscription(note.id, req.file.path, transcriptionJob.id)
                    .catch(error => {
                        console.error('Transcription processing error:', error);
                        // 转录失败时更新状态但不影响笔记创建
                        db.updateTranscriptionJobStatus(transcriptionJob.id, 'failed', error.message).catch(console.error);
                    });
                
                res.json({
                    success: true,
                    data: {
                        ...note,
                        transcriptionJobId: transcriptionJob.id
                    }
                });
            } catch (transcriptionError) {
                console.error('Failed to create transcription job:', transcriptionError);
                // 转录任务创建失败，但笔记创建成功，不清理音频文件
                res.json({
                    success: true,
                    data: note,
                    warning: '音频上传成功，但转录服务暂时不可用'
                });
            }
        } else {
            res.json({
                success: true,
                data: note
            });
        }
    } catch (error) {
        console.error('Create note error:', error);
        
        // 清理上传的文件（如果有）
        if (req.file) {
            cleanupFile(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 更新笔记
router.put('/notes/:noteId', async (req, res) => {
    try {
        const { noteId } = req.params;
        const updates = req.body;
        
        await db.updateNote(noteId, updates);
        
        // 获取更新后的完整笔记数据
        const updatedNote = await db.getNote(noteId);
        
        if (!updatedNote) {
            return res.status(404).json({
                success: false,
                error: '笔记不存在'
            });
        }
        
        res.json({
            success: true,
            data: updatedNote
        });
    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 删除笔记
router.delete('/notes/:noteId', async (req, res) => {
    try {
        const { noteId } = req.params;
        
        // 获取笔记信息以清理相关文件
        const note = await db.getNote(noteId);
        if (note) {
            // 获取相关的转录任务
            const transcriptionJob = await db.getTranscriptionJobByNoteId(noteId);
            
            // 清理音频文件
            if (transcriptionJob && transcriptionJob.audioFilePath && fs.existsSync(transcriptionJob.audioFilePath)) {
                cleanupFile(transcriptionJob.audioFilePath);
            }
        }
        
        const success = await db.deleteNote(noteId);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '笔记不存在'
            });
        }
        
        res.json({
            success: true,
            message: '笔记删除成功'
        });
    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 版本管理API

// 保存笔记版本
router.post('/notes/:noteId/versions', async (req, res) => {
    try {
        const { noteId } = req.params;
        const { content, versionName } = req.body;
        
        const version = await db.saveNoteVersion(noteId, content, versionName);
        
        res.json({
            success: true,
            data: version
        });
    } catch (error) {
        console.error('Save note version error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取笔记版本列表
router.get('/notes/:noteId/versions', async (req, res) => {
    try {
        const { noteId } = req.params;
        const versions = await db.getNoteVersions(noteId);
        
        res.json({
            success: true,
            data: versions
        });
    } catch (error) {
        console.error('Get note versions error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 恢复笔记版本
router.post('/notes/:noteId/versions/:versionId/restore', async (req, res) => {
    try {
        const { noteId, versionId } = req.params;
        
        const restoredNote = await db.restoreNoteVersion(noteId, versionId);
        
        if (!restoredNote) {
            return res.status(404).json({
                success: false,
                error: '版本不存在或恢复失败'
            });
        }
        
        res.json({
            success: true,
            data: restoredNote
        });
    } catch (error) {
        console.error('Restore note version error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 转录相关API

// 获取转录任务状态
router.get('/transcription/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await db.getTranscriptionJob(jobId);
        
        if (!job) {
            return res.status(404).json({
                success: false,
                error: '转录任务不存在'
            });
        }
        
        res.json({
            success: true,
            data: job
        });
    } catch (error) {
        console.error('Get transcription job error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 根据笔记ID获取转录任务
router.get('/notes/:noteId/transcription', async (req, res) => {
    try {
        const { noteId } = req.params;
        const jobs = await db.getTranscriptionJobsByNoteId(noteId);
        
        res.json({
            success: true,
            data: jobs
        });
    } catch (error) {
        console.error('Get transcription jobs by note error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 手动启动转录（用于重试）
router.post('/notes/:noteId/transcription/start', async (req, res) => {
    try {
        const { noteId } = req.params;
        
        // 获取笔记的转录任务
        const jobs = await db.getTranscriptionJobsByNoteId(noteId);
        const pendingJob = jobs.find(job => job.status === 'pending' || job.status === 'failed');
        
        if (!pendingJob) {
            return res.status(400).json({
                success: false,
                error: '没有可重试的转录任务'
            });
        }
        
        // 重置任务状态
        await db.updateTranscriptionJob(pendingJob.id, {
            status: 'pending',
            error: null,
            updatedAt: new Date().toISOString()
        });
        
        // 异步处理转录
        processTranscription(noteId, pendingJob.audioFilePath, pendingJob.id)
            .catch(error => {
                console.error('Transcription processing error:', error);
            });
        
        res.json({
            success: true,
            data: {
                jobId: pendingJob.id,
                status: 'pending'
            }
        });
    } catch (error) {
        console.error('Start transcription error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 健康检查API
router.get('/health', async (req, res) => {
    try {
        const funasrHealth = await funasrService.checkHealth();
        
        res.json({
            success: true,
            data: {
                api: 'healthy',
                database: 'connected',
                funasr: funasrHealth ? 'healthy' : 'unavailable'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 转录处理函数
async function processTranscription(noteId, audioFilePath, jobId) {
    try {
        console.log(`[TRANSCRIPTION] Starting transcription for note ${noteId}, job ${jobId}`);
        console.log(`[TRANSCRIPTION] Audio file: ${audioFilePath}`);
        console.log(`[TRANSCRIPTION] Service type: ${USE_DOCKER_FUNASR ? 'Docker' : 'Direct'}`);
        
        // 更新任务状态为处理中
        await db.updateTranscriptionJobStatus(jobId, 'processing');
        
        // 检查音频文件是否存在
        if (!fs.existsSync(audioFilePath)) {
            throw new Error('音频文件不存在');
        }
        
        // 检查音频文件大小
        const stats = fs.statSync(audioFilePath);
        console.log(`[TRANSCRIPTION] Audio file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        let transcriptionText;
        let transcriptionMethod = 'unknown';
        let transcriptionResult;
        
        if (USE_DOCKER_FUNASR) {
            // 使用Docker版本的FunASR
            console.log(`[TRANSCRIPTION] Using Docker FunASR service`);
            
            try {
                // 检查Docker服务健康状态
                console.log(`[TRANSCRIPTION] Checking Docker FunASR health...`);
                const isHealthy = await funasrService.checkHealth();
                if (!isHealthy) {
                    throw new Error('FunASR Docker服务不可用');
                }
                console.log(`[TRANSCRIPTION] Docker FunASR service is healthy`);
                
                // 使用Docker客户端进行转录
                transcriptionResult = await funasrService.transcribeAudio(audioFilePath, {
                    mode: '2pass'
                });
                transcriptionMethod = 'docker-client';
                console.log(`[TRANSCRIPTION] Docker transcription completed`);
                
            } catch (dockerError) {
                console.error(`[TRANSCRIPTION] Docker FunASR failed:`, dockerError.message);
                throw new Error(`Docker FunASR转录失败: ${dockerError.message}`);
            }
        } else {
            // 使用原有的直接连接方式
            console.log(`[TRANSCRIPTION] Using direct FunASR service`);
            
            try {
                // 优先尝试WebSocket方式
                console.log(`[TRANSCRIPTION] Trying WebSocket method...`);
                transcriptionResult = await funasrService.transcribeAudioWS(audioFilePath, {
                    language: 'zh',
                    use_itn: true
                });
                transcriptionMethod = 'websocket';
                console.log(`[TRANSCRIPTION] WebSocket transcription completed`);
            } catch (wsError) {
                console.log(`[TRANSCRIPTION] WebSocket转录失败，尝试HTTP方式:`, wsError.message);
                
                try {
                    // 检查HTTP服务健康状态
                    const isHealthy = await funasrService.checkHealth();
                    if (!isHealthy) {
                        throw new Error('FunASR HTTP服务不可用');
                    }
                    
                    // 使用HTTP方式
                    console.log(`[TRANSCRIPTION] Trying HTTP method...`);
                    transcriptionResult = await funasrService.transcribeAudio(audioFilePath, {
                        language: 'zh',
                        use_itn: true
                    });
                    transcriptionMethod = 'http';
                    console.log(`[TRANSCRIPTION] HTTP transcription completed`);
                } catch (httpError) {
                    throw new Error(`所有转录方式都失败: WebSocket(${wsError.message}), HTTP(${httpError.message})`);
                }
            }
        }
        
        // 处理转录结果
        console.log(`[TRANSCRIPTION] Processing transcription result...`);
        console.log(`[TRANSCRIPTION] Raw result type: ${typeof transcriptionResult}`);
        
        if (typeof transcriptionResult === 'string') {
            transcriptionText = transcriptionResult;
        } else if (transcriptionResult && transcriptionResult.text) {
            transcriptionText = transcriptionResult.text;
        } else {
            console.error(`[TRANSCRIPTION] Invalid result format:`, transcriptionResult);
            throw new Error('转录结果格式错误');
        }
        
        if (!transcriptionText) {
            console.error(`[TRANSCRIPTION] Empty transcription result`);
            throw new Error('转录结果为空');
        }
        
        console.log(`[TRANSCRIPTION] Transcription text length: ${transcriptionText.length} characters`);
        console.log(`[TRANSCRIPTION] Transcription preview: ${transcriptionText.substring(0, 100)}...`);
        
        // 获取当前笔记内容
        const note = await db.getNote(noteId);
        if (!note) {
            throw new Error('笔记不存在');
        }
        
        // 合并转录结果到笔记内容
        const timestamp = new Date().toLocaleString('zh-CN');
        const transcriptionSection = `\n\n--- 转录内容 (${transcriptionMethod}, ${timestamp}) ---\n${transcriptionText}`;
        const newContent = note.content ? note.content + transcriptionSection : transcriptionText;
        
        console.log(`[TRANSCRIPTION] Updating note content...`);
        
        // 更新笔记内容和状态
        await db.updateNote(noteId, {
            content: newContent,
            status: 'completed',
            updatedAt: new Date().toISOString()
        });
        
        // 更新转录任务状态
        await db.updateTranscriptionJobStatus(jobId, 'completed', transcriptionText);
        
        console.log(`[TRANSCRIPTION] 转录完成: job ${jobId}, method: ${transcriptionMethod}`);
        console.log(`[TRANSCRIPTION] Final content length: ${newContent.length} characters`);
        
        // 清理音频文件（可选）
        try {
            if (funasrService.cleanupAudioFile) {
                funasrService.cleanupAudioFile(audioFilePath);
                console.log(`[TRANSCRIPTION] Audio file cleaned up: ${audioFilePath}`);
            }
        } catch (cleanupError) {
            console.warn(`[TRANSCRIPTION] 清理音频文件失败:`, cleanupError.message);
        }
        
    } catch (error) {
        console.error(`[TRANSCRIPTION] 转录失败 job ${jobId}:`, error.message);
        console.error(`[TRANSCRIPTION] Error stack:`, error.stack);
        
        // 更新任务状态为失败
        try {
            await db.updateTranscriptionJobStatus(jobId, 'failed', error.message);
            console.log(`[TRANSCRIPTION] Job ${jobId} status updated to failed`);
        } catch (updateError) {
            console.error(`[TRANSCRIPTION] Failed to update job status:`, updateError.message);
        }
        
        // 更新笔记状态为错误
        try {
            await db.updateNote(noteId, {
                status: 'error',
                errorMessage: error.message
            });
            console.log(`[TRANSCRIPTION] Note ${noteId} status updated to error`);
        } catch (updateError) {
            console.error(`[TRANSCRIPTION] Failed to update note status:`, updateError.message);
        }
    }
}

module.exports = router;