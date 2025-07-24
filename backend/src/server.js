const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-user-id']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务（用于访问上传的音频文件）
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// 请求日志中间件
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    
    // 记录请求体（排除文件上传）
    if (req.method !== 'GET' && !req.is('multipart/form-data')) {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    
    next();
});

// 路由
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// 根路径
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Say Backend API Server',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            users: '/api/users',
            notes: '/api/users/:userId/notes',
            transcription: '/api/transcription/:jobId'
        }
    });
});

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `路径不存在: ${req.originalUrl}`
    });
});

// 全局错误处理中间件
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    // 如果响应已经发送，交给默认错误处理器
    if (res.headersSent) {
        return next(error);
    }
    
    // 处理不同类型的错误
    let statusCode = 500;
    let message = '服务器内部错误';
    
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = '数据验证失败';
    } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        message = '未授权访问';
    } else if (error.code === 'ENOENT') {
        statusCode = 404;
        message = '文件不存在';
    } else if (error.code === 'EACCES') {
        statusCode = 403;
        message = '文件访问权限不足';
    }
    
    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && {
            details: error.message,
            stack: error.stack
        })
    });
});

// 优雅关闭处理
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`\n🚀 Say Backend Server is running!`);
    console.log(`📍 Server URL: http://localhost:${PORT}`);
    console.log(`📋 API Documentation: http://localhost:${PORT}/api/health`);
    console.log(`📁 Uploads Directory: ${uploadsDir}`);
    console.log(`🕐 Started at: ${new Date().toISOString()}`);
    console.log('\n--- Available Endpoints ---');
    console.log('GET  /api/health                     - 健康检查');
    console.log('POST /api/users                      - 创建用户');
    console.log('GET  /api/users/:userId              - 获取用户信息');
    console.log('GET  /api/users/:userId/notes        - 获取用户笔记');
    console.log('POST /api/users/:userId/notes        - 创建笔记（支持音频上传）');
    console.log('GET  /api/notes/:noteId              - 获取单个笔记');
    console.log('PUT  /api/notes/:noteId              - 更新笔记');
    console.log('DELETE /api/notes/:noteId            - 删除笔记');
    console.log('POST /api/notes/:noteId/versions     - 保存笔记版本');
    console.log('GET  /api/notes/:noteId/versions     - 获取笔记版本列表');
    console.log('POST /api/notes/:noteId/versions/:versionId/restore - 恢复笔记版本');
    console.log('GET  /api/transcription/:jobId       - 获取转录任务状态');
    console.log('GET  /api/notes/:noteId/transcription - 获取笔记的转录任务');
    console.log('POST /api/notes/:noteId/transcription/start - 手动启动转录');
    console.log('\n--- Environment ---');
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`FUNASR_URL: ${process.env.FUNASR_URL || 'http://localhost:10095'}`);
    console.log('\n✅ Server ready to accept connections\n');
});

module.exports = app;