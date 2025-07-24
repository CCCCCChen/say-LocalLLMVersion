const express = require('express');
const Database = require('../database/db');
const FunASRService = require('../services/funasrService');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const db = new Database();
const funasrService = new FunASRService();

// 初始化数据库连接
db.connect();

// 简单的认证中间件（开发环境用）
const devAuth = (req, res, next) => {
    const token = req.headers.authorization;
    if (process.env.NODE_ENV === 'production' && token !== 'Bearer dev-admin-token') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// 系统状态概览
router.get('/status', devAuth, async (req, res) => {
    try {
        // 数据库统计
        const users = await db.getAllUsers();
        const allNotes = [];
        for (const user of users) {
            const userNotes = await db.getNotes(user.id);
            allNotes.push(...userNotes);
        }
        
        // 转录任务统计
        const transcriptionJobs = await db.getAllTranscriptionJobs();
        const jobStats = transcriptionJobs.reduce((acc, job) => {
            acc[job.status] = (acc[job.status] || 0) + 1;
            return acc;
        }, {});
        
        // FunASR服务状态
        const funasrHealth = await funasrService.checkHealth();
        
        // 磁盘使用情况
        const uploadsDir = path.join(__dirname, '../../uploads');
        let uploadsDirSize = 0;
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            uploadsDirSize = files.reduce((total, file) => {
                const filePath = path.join(uploadsDir, file);
                if (fs.existsSync(filePath)) {
                    return total + fs.statSync(filePath).size;
                }
                return total;
            }, 0);
        }
        
        res.json({
            success: true,
            data: {
                timestamp: new Date().toISOString(),
                database: {
                    users: users.length,
                    notes: allNotes.length,
                    transcriptionJobs: transcriptionJobs.length
                },
                transcriptionStats: jobStats,
                services: {
                    funasr: funasrHealth ? 'healthy' : 'unavailable'
                },
                storage: {
                    uploadsSize: Math.round(uploadsDirSize / 1024 / 1024 * 100) / 100 + ' MB',
                    uploadsCount: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0
                }
            }
        });
    } catch (error) {
        console.error('Admin status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取所有用户
router.get('/users', devAuth, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        const usersWithStats = [];
        
        for (const user of users) {
            const notes = await db.getNotes(user.id);
            usersWithStats.push({
                ...user,
                notesCount: notes.length,
                lastActivity: notes.length > 0 ? Math.max(...notes.map(n => n.lastEdited)) : user.created
            });
        }
        
        res.json({
            success: true,
            data: usersWithStats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取所有转录任务
router.get('/transcription-jobs', devAuth, async (req, res) => {
    try {
        const jobs = await db.getAllTranscriptionJobs();
        res.json({
            success: true,
            data: jobs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 清理失败的转录任务
router.post('/cleanup/failed-jobs', devAuth, async (req, res) => {
    try {
        const jobs = await db.getAllTranscriptionJobs();
        const failedJobs = jobs.filter(job => job.status === 'failed');
        
        let cleanedCount = 0;
        for (const job of failedJobs) {
            // 清理音频文件
            if (job.audioFilePath && fs.existsSync(job.audioFilePath)) {
                fs.unlinkSync(job.audioFilePath);
            }
            // 删除任务记录
            await db.deleteTranscriptionJob(job.id);
            cleanedCount++;
        }
        
        res.json({
            success: true,
            data: {
                message: `清理了 ${cleanedCount} 个失败的转录任务`,
                cleanedCount
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 测试FunASR连接
router.post('/test/funasr', devAuth, async (req, res) => {
    try {
        const httpHealth = await funasrService.checkHealth();
        
        // 测试WebSocket连接
        let wsHealth = false;
        try {
            const WebSocket = require('ws');
            const wsOptions = {
                subprotocols: ['binary'],
                pingInterval: null
            };
            
            if (funasrService.ssl) {
                wsOptions.rejectUnauthorized = false;
            }
            
            const ws = new WebSocket(funasrService.wsUrl, wsOptions);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('WebSocket connection timeout'));
                }, 5000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    wsHealth = true;
                    ws.close();
                    resolve();
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
        } catch (error) {
            console.log('WebSocket test failed:', error.message);
        }
        
        res.json({
            success: true,
            data: {
                http: httpHealth ? 'healthy' : 'unavailable',
                websocket: wsHealth ? 'healthy' : 'unavailable',
                httpUrl: funasrService.httpUrl,
                wsUrl: funasrService.wsUrl,
                config: {
                    host: funasrService.host,
                    port: funasrService.port,
                    ssl: funasrService.ssl,
                    mode: funasrService.mode,
                    chunkSize: funasrService.chunkSize,
                    useItn: funasrService.useItn
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取FunASR配置
router.get('/funasr/config', devAuth, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                host: funasrService.host,
                port: funasrService.port,
                ssl: funasrService.ssl,
                mode: funasrService.mode,
                chunkSize: funasrService.chunkSize,
                chunkInterval: funasrService.chunkInterval,
                encoderChunkLookBack: funasrService.encoderChunkLookBack,
                decoderChunkLookBack: funasrService.decoderChunkLookBack,
                useItn: funasrService.useItn,
                audioFs: funasrService.audioFs,
                wsUrl: funasrService.wsUrl,
                httpUrl: funasrService.httpUrl
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 更新FunASR配置
router.post('/funasr/config', devAuth, async (req, res) => {
    try {
        const config = req.body;
        funasrService.setConfig(config);
        
        res.json({
            success: true,
            data: {
                message: 'FunASR配置已更新',
                config: {
                    host: funasrService.host,
                    port: funasrService.port,
                    ssl: funasrService.ssl,
                    mode: funasrService.mode,
                    chunkSize: funasrService.chunkSize,
                    useItn: funasrService.useItn
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;