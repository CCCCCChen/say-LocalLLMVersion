# FunASR 集成指南

本文档介绍如何在转录应用中集成 FunASR Docker 服务。

## 什么是 FunASR？

FunASR 是阿里巴巴达摩院开源的语音识别工具包，专为中文语音识别优化，具有以下特点：

- **高精度**：针对中文语音识别进行了深度优化
- **高性能**：支持实时和离线转录
- **易部署**：提供 Docker 镜像，一键部署
- **多模式**：支持离线文件转录、实时语音识别、2pass 模式

## 快速开始

### 1. 启动 FunASR Docker 服务

#### 方法一：使用 Docker 命令

```bash
# 启动 FunASR 服务
docker run -p 10095:10095 -it --rm funasr/funasr:funasr-runtime-sdk-online-cpu
```

#### 方法二：使用 Docker Compose（推荐）

```bash
# 启动服务
docker-compose -f docker-compose.funasr.yml up -d

# 查看服务状态
docker-compose -f docker-compose.funasr.yml ps

# 查看日志
docker-compose -f docker-compose.funasr.yml logs -f

# 停止服务
docker-compose -f docker-compose.funasr.yml down
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 启用 FunASR 服务
FUNASR_ENABLED=true
FUNASR_HOST=127.0.0.1
FUNASR_PORT=10095
FUNASR_SSL=false
FUNASR_MODE=offline

# 启用备用机制
FALLBACK_TO_WHISPER=true
```

### 3. 启动应用

```bash
npm run dev
```

### 4. 选择 FunASR 模型

在应用界面中，从模型选择器中选择 "FunASR (Docker Service)"。

## 配置选项详解

### 基础配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `FUNASR_ENABLED` | `false` | 是否启用 FunASR 服务 |
| `FUNASR_HOST` | `127.0.0.1` | FunASR 服务主机地址 |
| `FUNASR_PORT` | `10095` | FunASR 服务端口 |
| `FUNASR_SSL` | `false` | 是否使用 SSL 连接 |
| `FUNASR_MODE` | `offline` | 转录模式 |

### 转录模式

- **offline**：离线文件转录，适合处理音频文件
- **online**：实时语音识别，适合流式音频
- **2pass**：两遍处理，先实时识别再离线纠错

### 高级配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `FUNASR_API_KEY` | - | API 密钥（如果需要） |
| `FUNASR_SECRET` | - | API 密钥（如果需要） |
| `FUNASR_HOTWORDS_ENABLED` | `false` | 是否启用热词 |
| `FUNASR_HOTWORDS_FILE` | - | 热词文件路径 |
| `FUNASR_USE_ITN` | `true` | 是否使用逆文本标准化 |
| `FUNASR_THREAD_NUM` | `1` | 处理线程数 |
| `FUNASR_TIMEOUT` | `30000` | 请求超时时间（毫秒） |
| `FALLBACK_TO_WHISPER` | `true` | FunASR 失败时是否回退到 Whisper |

## 故障排除

### 1. 连接失败

**问题**：无法连接到 FunASR 服务

**解决方案**：
- 确认 Docker 服务正在运行：`docker ps`
- 检查端口是否被占用：`lsof -i :10095`
- 验证网络连接：`curl http://localhost:10095/health`

### 2. 转录失败

**问题**：转录请求失败或返回空结果

**解决方案**：
- 检查音频格式是否支持（推荐 WAV, 16kHz）
- 查看 FunASR 服务日志：`docker logs funasr-service`
- 确认 `FALLBACK_TO_WHISPER=true` 以启用备用机制

### 3. 性能问题

**问题**：转录速度慢

**解决方案**：
- 增加处理线程数：`FUNASR_THREAD_NUM=4`
- 使用 GPU 版本：`funasr/funasr:funasr-runtime-sdk-online-gpu`
- 调整音频采样率和格式

## 与 Whisper 的对比

| 特性 | FunASR | Whisper |
|------|--------|----------|
| 中文识别 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 英文识别 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 部署复杂度 | 中等（需要 Docker） | 简单（浏览器内） |
| 资源消耗 | 中等 | 低 |
| 离线支持 | 需要本地服务 | 完全离线 |
| 实时性能 | 优秀 | 良好 |

## 最佳实践

1. **生产环境**：使用 Docker Compose 部署，配置健康检查和重启策略
2. **开发环境**：启用 `FALLBACK_TO_WHISPER=true` 确保服务可用性
3. **性能优化**：根据硬件配置调整 `FUNASR_THREAD_NUM`
4. **监控**：定期检查服务状态和日志
5. **备份**：为重要的转录任务保留音频文件

## 技术架构

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Web 应用      │ ──────────────► │  FunASR Docker  │
│                 │                 │     服务        │
│ - ModelSelector │                 │                 │
│ - Worker.js     │                 │ - ASR 模型      │
│ - FunASRClient  │                 │ - WebSocket API │
└─────────────────┘                 └─────────────────┘
        │
        │ 备用机制
        ▼
┌─────────────────┐
│ Whisper 本地模型 │
│                 │
│ - 浏览器内运行   │
│ - 完全离线      │
└─────────────────┘
```

## 更多资源

- [FunASR GitHub](https://github.com/modelscope/FunASR)
- [FunASR 文档](https://github.com/modelscope/FunASR/blob/main/README_zh.md)
- [Docker Hub](https://hub.docker.com/r/funasr/funasr)
- [ModelScope](https://modelscope.cn/models?page=1&tasks=auto-speech-recognition)