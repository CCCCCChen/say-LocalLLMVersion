# Say Backend API Server

基于 Node.js + Express + SQLite 的音频转录笔记后端服务，集成 FunASR 语音识别服务。

## 功能特性

- 🎤 **音频转录**: 集成 FunASR 服务，支持多种音频格式转录
- 📝 **笔记管理**: 完整的 CRUD 操作，支持标签和状态管理
- 👤 **用户系统**: 用户创建和管理
- 📚 **版本控制**: 笔记版本保存和恢复
- 🔄 **异步处理**: 后台音频转录处理
- 📁 **文件上传**: 支持音频文件上传和存储

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 初始化数据库

```bash
node src/scripts/initDatabase.js
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3001` 启动。

## API 端点

### 健康检查
- `GET /api/health` - 检查服务状态

### 用户管理
- `POST /api/users` - 创建用户
- `GET /api/users/:userId` - 获取用户信息

### 笔记管理
- `GET /api/users/:userId/notes` - 获取用户的所有笔记
- `POST /api/users/:userId/notes` - 创建笔记（支持音频上传）
- `GET /api/notes/:noteId` - 获取单个笔记
- `PUT /api/notes/:noteId` - 更新笔记
- `DELETE /api/notes/:noteId` - 删除笔记

### 版本管理
- `POST /api/notes/:noteId/versions` - 保存笔记版本
- `GET /api/notes/:noteId/versions` - 获取笔记版本列表
- `POST /api/notes/:noteId/versions/:versionId/restore` - 恢复笔记版本

### 转录管理
- `GET /api/transcription/:jobId` - 获取转录任务状态
- `GET /api/notes/:noteId/transcription` - 获取笔记的转录任务
- `POST /api/notes/:noteId/transcription/start` - 手动启动转录

## 使用示例

### 创建用户

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "email": "zhangsan@example.com"}'
```

### 创建笔记（带音频）

```bash
curl -X POST http://localhost:3001/api/users/USER_ID/notes \
  -F "title=我的音频笔记" \
  -F "content=这是一个测试笔记" \
  -F "tags=[\"工作\", \"会议\"]" \
  -F "audio=@/path/to/audio.wav"
```

### 获取用户笔记

```bash
curl http://localhost:3001/api/users/USER_ID/notes
```

## 环境配置

### 环境变量

- `PORT`: 服务端口（默认: 3001）
- `NODE_ENV`: 运行环境（development/production）
- `FUNASR_URL`: FunASR 服务地址（默认: http://localhost:10095）

### FunASR 服务

后端需要 FunASR 服务来处理音频转录。请确保 FunASR 服务在 `http://localhost:10095` 运行，或通过 `FUNASR_URL` 环境变量指定其他地址。

## 数据库结构

使用 SQLite 数据库，包含以下表：

- `users`: 用户信息
- `notes`: 笔记数据
- `note_versions`: 笔记版本
- `transcription_jobs`: 转录任务

## 文件存储

- 数据库文件: `backend/data/say.db`
- 上传文件: `backend/uploads/`

## 开发说明

### 项目结构

```
backend/
├── src/
│   ├── database/
│   │   └── db.js              # 数据库操作类
│   ├── middleware/
│   │   └── upload.js          # 文件上传中间件
│   ├── routes/
│   │   └── api.js             # API 路由
│   ├── services/
│   │   └── funasrService.js   # FunASR 服务集成
│   ├── scripts/
│   │   └── initDatabase.js    # 数据库初始化脚本
│   └── server.js              # 主服务器文件
├── data/                      # 数据库文件目录
├── uploads/                   # 上传文件目录
└── package.json
```

### 支持的音频格式

- WAV (.wav)
- MP3 (.mp3)
- FLAC (.flac)
- M4A (.m4a)
- AAC (.aac)
- OGG (.ogg)
- WMA (.wma)
- AMR (.amr)
- 3GP (.3gp)
- MP4 (.mp4)

## 故障排除

### 常见问题

1. **FunASR 服务不可用**
   - 检查 FunASR 服务是否正在运行
   - 验证 `FUNASR_URL` 配置是否正确

2. **文件上传失败**
   - 检查文件大小是否超过 100MB 限制
   - 验证文件格式是否支持
   - 确保 `uploads` 目录有写入权限

3. **数据库连接失败**
   - 确保 `data` 目录存在且有写入权限
   - 重新运行数据库初始化脚本

### 日志查看

服务运行时会输出详细的请求日志，包括：
- HTTP 请求信息
- 转录任务状态
- 错误信息

## 许可证

MIT License