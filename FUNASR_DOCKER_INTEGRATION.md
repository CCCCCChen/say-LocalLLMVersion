# FunASR Docker 集成指南

本文档说明如何在 Say 应用中集成和使用 Docker 版本的 FunASR 语音识别服务。

## 概述

基于官方 `online-cpu.sh` 脚本的 client 模式，我们实现了对 Docker 中运行的 FunASR 服务的调用。这种方式具有以下优势：

- 🐳 **容器化部署**: 使用 Docker 容器运行 FunASR，环境隔离更好
- 🔧 **官方支持**: 基于官方提供的客户端调用方式
- 📊 **详细日志**: 提供完整的调试和监控日志
- ⚙️ **灵活配置**: 支持多种配置选项和客户端类型

## 前置条件

### 1. 启动 FunASR Docker 服务

首先需要使用官方脚本启动 FunASR Docker 服务：

```bash
# 下载官方脚本（如果还没有）
wget https://isv-data.oss-cn-hangzhou.aliyuncs.com/ics/MaaS/ASR/shell/online-cpu.sh

# 启动 FunASR Docker 服务
sudo bash online-cpu.sh server
```

服务启动后会监听在 `127.0.0.1:10095` 端口。

### 2. 验证服务状态

可以通过以下方式验证 FunASR Docker 服务是否正常运行：

```bash
# 检查端口是否开放
nc -z 127.0.0.1 10095

# 或者使用官方客户端测试
sudo bash online-cpu.sh client
```

## 配置说明

### 环境变量配置

在 `backend` 目录下设置以下环境变量：

```bash
# 启用 Docker FunASR 模式
export USE_DOCKER_FUNASR=true

# 其他可选环境变量
export NODE_ENV=development
export PORT=3001
```

### 配置文件

在 `funasr_config.json` 中的 `docker` 部分进行详细配置：

```json
{
  "docker": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 10095,
    "client_type": "python",
    "samples_dir": "./funasr-runtime-resources/samples",
    "timeout": 300000,
    "auto_setup": true,
    "python_client": {
      "install_dependencies": true,
      "requirements_file": "requirements_client.txt"
    },
    "cpp_client": {
      "executable_path": "./funasr-runtime-resources/samples/cpp/funasr-wss-client"
    }
  }
}
```

#### 配置参数说明

- `enabled`: 是否启用 Docker 模式
- `host`: FunASR Docker 服务主机地址
- `port`: FunASR Docker 服务端口
- `client_type`: 客户端类型 (`python` 或 `cpp`)
- `samples_dir`: 客户端示例文件目录
- `timeout`: 转录超时时间（毫秒）
- `auto_setup`: 是否自动下载和设置客户端

## 启动方式

### 方式一：使用启动脚本（推荐）

```bash
# 进入后端目录
cd backend

# 使用启动脚本
./start-docker-funasr.sh

# 或者使用 npm 脚本
npm run start:docker-funasr
```

启动脚本会自动：
- 设置必要的环境变量
- 检查 FunASR Docker 服务状态
- 启动后端服务
- 显示详细的日志信息

### 方式二：手动启动

```bash
# 设置环境变量并启动
USE_DOCKER_FUNASR=true node src/server.js

# 或者开发模式
USE_DOCKER_FUNASR=true npm run dev

# 或者使用 npm 脚本开发模式
npm run dev:docker-funasr
```

## 测试验证

在启动服务之前，建议先运行测试脚本验证 Docker FunASR 集成是否正常：

```bash
# 运行集成测试
npm run test:docker-funasr

# 或者直接运行
node test-docker-funasr.js
```

测试脚本会执行以下检查：
1. 服务初始化
2. 健康检查（验证 FunASR Docker 服务是否运行）
3. 客户端可用性检查（自动下载和设置客户端）
4. 转录功能测试（如果有测试音频文件）
5. 配置管理测试

### 准备测试音频文件（可选）

如果要测试转录功能，请将测试音频文件放置在项目根目录：

```bash
# 将音频文件复制到项目根目录
cp /path/to/your/audio.wav /Users/minichen/Downloads/Models/say/test-audio.wav
```

支持的音频格式：`.wav`, `.mp3`, `.flac`, `.m4a`, `.aac` 等

## 工作流程

### 1. 服务初始化

当后端服务启动时：

1. 根据 `USE_DOCKER_FUNASR` 环境变量选择服务类型
2. 加载 `funasr_config.json` 配置文件
3. 初始化 `FunASRDockerService` 实例
4. 输出配置信息到日志

### 2. 转录处理流程

当收到音频转录请求时：

1. **健康检查**: 检查 FunASR Docker 服务是否可用
2. **客户端检查**: 验证客户端文件是否存在
3. **自动设置**: 如果启用，自动下载和设置客户端
4. **执行转录**: 调用 Python/C++ 客户端进行转录
5. **结果处理**: 解析转录结果并更新数据库
6. **清理工作**: 清理临时文件

### 3. 客户端调用

系统支持两种客户端类型：

#### Python 客户端
```bash
python3 funasr_wss_client.py \
  --host 127.0.0.1 \
  --port 10095 \
  --mode 2pass \
  --audio_in /path/to/audio.wav \
  --send_without_sleep \
  --output_dir ./output
```

#### C++ 客户端
```bash
./funasr-wss-client \
  --server-ip 127.0.0.1 \
  --port 10095 \
  --wav-path /path/to/audio.wav
```

## 日志监控

### 日志标识

系统使用以下日志标识便于监控和调试：

- `[FUNASR-DOCKER]`: Docker FunASR 服务相关日志
- `[TRANSCRIPTION]`: 转录处理流程日志

### 关键日志示例

```
[FUNASR-DOCKER] Service initialized:
[FUNASR-DOCKER]   Host: 127.0.0.1:10095
[FUNASR-DOCKER]   Mode: 2pass
[FUNASR-DOCKER]   Client Type: python
[FUNASR-DOCKER]   Auto Setup: true

[TRANSCRIPTION] Starting transcription for note 123, job 456
[TRANSCRIPTION] Service type: Docker
[TRANSCRIPTION] Audio file size: 2.34 MB
[FUNASR-DOCKER] Checking health at 127.0.0.1:10095
[FUNASR-DOCKER] Health check passed
[FUNASR-DOCKER] Client is available
[FUNASR-DOCKER] Executing transcription...
[TRANSCRIPTION] Docker transcription completed
[TRANSCRIPTION] Transcription text length: 156 characters
[TRANSCRIPTION] 转录完成: job 456, method: docker-client
```

## 故障排除

### 常见问题

#### 1. FunASR Docker 服务不可用

**错误信息**: `FunASR Docker service not available at 127.0.0.1:10095`

**解决方案**:
```bash
# 检查 Docker 服务状态
sudo docker ps | grep funasr

# 重新启动 FunASR Docker
sudo bash online-cpu.sh server
```

#### 2. 客户端文件不存在

**错误信息**: `FunASR client not available and auto-setup is disabled`

**解决方案**:
1. 启用自动设置: 在配置中设置 `"auto_setup": true`
2. 手动下载客户端文件
3. 检查 `samples_dir` 路径配置

#### 3. Python 依赖安装失败

**错误信息**: `Failed to install requirements`

**解决方案**:
```bash
# 手动安装依赖
pip3 install click>=8.0.4
pip3 install -r funasr-runtime-resources/samples/python/requirements_client.txt
```

#### 4. 转录结果为空

**错误信息**: `Empty transcription result`

**解决方案**:
1. 检查音频文件格式和质量
2. 查看客户端输出日志
3. 验证 FunASR 模型是否正确加载

### 调试技巧

1. **启用详细日志**: 设置 `NODE_ENV=development`
2. **检查网络连接**: 使用 `nc -z 127.0.0.1 10095`
3. **手动测试客户端**: 直接运行官方客户端命令
4. **查看 Docker 日志**: `sudo docker logs <container_id>`

## 性能优化

### 1. 客户端选择

- **Python 客户端**: 功能完整，支持更多参数
- **C++ 客户端**: 性能更好，资源占用更少

### 2. 配置优化

```json
{
  "docker": {
    "timeout": 180000,  // 根据音频长度调整
    "auto_setup": false  // 生产环境建议关闭
  },
  "funasr": {
    "mode": "2pass",  // 平衡准确性和速度
    "chunk_size": [5, 10, 5]  // 优化实时性
  }
}
```

### 3. 资源管理

- 定期清理临时音频文件
- 监控 Docker 容器资源使用
- 设置合理的超时时间

## API 接口

### 健康检查

```bash
GET /api/health
```

响应示例：
```json
{
  "success": true,
  "data": {
    "api": "healthy",
    "database": "connected",
    "funasr": "healthy"
  }
}
```

### 转录任务

```bash
POST /api/users/:userId/notes
Content-Type: multipart/form-data

# 包含音频文件的表单数据
```

## 总结

Docker 版本的 FunASR 集成提供了一个稳定、可扩展的语音识别解决方案。通过详细的日志记录和灵活的配置选项，可以满足不同场景的需求。

如有问题，请查看日志输出或参考故障排除部分。