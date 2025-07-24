const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 按日期创建子目录
        const dateDir = new Date().toISOString().split('T')[0];
        const fullPath = path.join(uploadDir, dateDir);
        
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        
        cb(null, fullPath);
    },
    filename: function (req, file, cb) {
        // 生成唯一文件名
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        const filename = `audio_${Date.now()}_${uniqueSuffix}${ext}`;
        cb(null, filename);
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    // 允许的音频文件类型
    const allowedMimes = [
        'audio/wav',
        'audio/mpeg',
        'audio/mp3',
        'audio/flac',
        'audio/x-flac',
        'audio/mp4',
        'audio/m4a',
        'audio/aac',
        'audio/ogg',
        'audio/webm',
        'audio/3gpp',
        'audio/amr',
        'audio/x-ms-wma',
        'video/mp4', // 某些 m4a 文件可能被识别为 video/mp4
        'application/octet-stream' // 通用二进制类型，需要进一步检查扩展名
    ];
    
    const allowedExtensions = [
        '.wav', '.mp3', '.flac', '.m4a', '.aac',
        '.ogg', '.wma', '.amr', '.3gp', '.mp4'
    ];
    
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`不支持的文件类型: ${file.mimetype}, 扩展名: ${ext}`), false);
    }
};

// 创建 multer 实例
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB 限制
        files: 1 // 一次只允许上传一个文件
    }
});

// 错误处理中间件
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    success: false,
                    error: '文件大小超过限制（最大100MB）'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    success: false,
                    error: '一次只能上传一个文件'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    error: '意外的文件字段'
                });
            default:
                return res.status(400).json({
                    success: false,
                    error: `上传错误: ${error.message}`
                });
        }
    }
    
    if (error.message.includes('不支持的文件类型')) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
    
    next(error);
};

// 文件验证中间件
const validateUploadedFile = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: '没有上传文件'
        });
    }
    
    // 检查文件是否真的存在
    if (!fs.existsSync(req.file.path)) {
        return res.status(500).json({
            success: false,
            error: '文件上传失败'
        });
    }
    
    // 检查文件大小
    const stats = fs.statSync(req.file.path);
    if (stats.size === 0) {
        // 删除空文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
            success: false,
            error: '上传的文件为空'
        });
    }
    
    next();
};

// 清理临时文件的工具函数
const cleanupFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up file: ${filePath}`);
        }
    } catch (error) {
        console.error(`Failed to cleanup file ${filePath}:`, error.message);
    }
};

// 获取文件信息的工具函数
const getFileInfo = (filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            extension: path.extname(filePath).toLowerCase()
        };
    } catch (error) {
        throw new Error(`Failed to get file info: ${error.message}`);
    }
};

module.exports = {
    upload,
    handleUploadError,
    validateUploadedFile,
    cleanupFile,
    getFileInfo,
    uploadDir
};