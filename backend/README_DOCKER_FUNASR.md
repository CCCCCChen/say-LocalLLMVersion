# Docker FunASR 集成快速开始

这是 Say 应用后端集成 Docker 版本 FunASR 语音识别服务的快速开始指南。

## 🚀 快速开始

### 1. 启动 FunASR Docker 服务

首先确保 FunASR Docker 服务正在运行：

```bash
# 在 online-cpu.sh 所在目录执行
sudo bash online-cpu.sh server
```

### 2. 验证服务状态

```bash
# 检查服务是否运行在 10095 端口
nc -zv localhost 10095
```

### 3. 运行集成测试

```bash
# 进入后端目录
cd backend

# 运行测试脚本
npm run test:docker-funasr
```

### 4. 启动后端服务

```bash
# 使用 Docker FunASR 启动
npm run start:docker-funasr

# 或者开发模式
npm run dev:docker-funasr
```

## 📁 新增文件

- `src/services/funasrDockerService.js` - Docker FunASR 服务类
- `start-docker-funasr.sh` - 启动脚本
- `test-docker-funasr.js` - 集成测试脚本
- `FUNASR_DOCKER_INTEGRATION.md` - 详细集成文档

## 🔧 配置文件

- `funasr_config.json` - 新增 `docker` 配置项
- `package.json` - 新增相关 npm 脚本

## 📝 主要修改

1. **API 路由** (`src/routes/api.js`)
   - 根据 `USE_DOCKER_FUNASR` 环境变量动态选择服务
   - 增强日志输出和错误处理

2. **配置管理**
   - 支持从 `funasr_config.json` 加载 Docker 配置
   - 自动客户端下载和设置

3. **启动脚本**
   - 自动检查 Docker 服务状态
   - 设置环境变量并启动后端

## 🔍 日志监控

启动后端时，注意观察以下日志：

```
[FUNASR-DOCKER] 服务初始化成功
[FUNASR-DOCKER] 健康检查通过
[FUNASR-DOCKER] 客户端可用
[FUNASR-DOCKER] 转录开始: /path/to/audio.wav
[FUNASR-DOCKER] 转录完成，结果长度: 123
```

## 🐛 故障排除

### 常见问题

1. **端口 10095 连接失败**
   - 确保 FunASR Docker 服务正在运行
   - 检查防火墙设置

2. **客户端下载失败**
   - 检查网络连接
   - 手动下载客户端到 `samples` 目录

3. **转录失败**
   - 检查音频文件格式是否支持
   - 查看详细错误日志

### 调试模式

```bash
# 启用详细日志
DEBUG=* npm run dev:docker-funasr
```

## 📚 更多信息

详细的集成文档请参考：[FUNASR_DOCKER_INTEGRATION.md](../FUNASR_DOCKER_INTEGRATION.md)

## 🎯 API 端点

启动后，以下 API 端点支持 Docker FunASR：

- `POST /api/notes` - 创建笔记（支持音频上传和转录）
- `GET /api/transcription/:taskId/status` - 获取转录状态
- `POST /api/transcription/:noteId/retry` - 重试转录

## 🔄 切换模式

在不同的 FunASR 模式之间切换：

```bash
# 使用 Docker FunASR
export USE_DOCKER_FUNASR=true
npm start

# 使用原有 FunASR（WebSocket/HTTP）
unset USE_DOCKER_FUNASR
npm start
```