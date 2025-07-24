# FunASR 集成说明

本项目已根据 `funasr_wss_client.py` 改造了 FunASR 的对接方式，提供了更完整和灵活的 WebSocket 通信支持。

## 主要改进

### 1. 增强的 FunASR 服务类

**文件**: `backend/src/services/funasrService.js`

- **完整的配置支持**: 支持主机、端口、SSL、模式、分块大小等详细配置
- **改进的 WebSocket 协议**: 基于官方 `funasr_wss_client.py` 实现的标准协议
- **多种转录模式**: 支持 offline、online、2pass-online、2pass-offline 模式
- **音频格式支持**: 支持 WAV、MP3、FLAC 等多种音频格式
- **实时音频处理**: 支持音频分块发送和实时转录

### 2. 新增配置文件

**文件**: `funasr_config.json`

提供了 FunASR 服务的默认配置，包括：
- 连接参数（主机、端口、SSL）
- 转录参数（模式、分块大小、热词）
- 音频参数（采样率、支持格式）
- 输出和日志配置

### 3. 独立的 Python 客户端

**文件**: `funasr_client.py`

基于原始 `funasr_wss_client.py` 改造的独立客户端，提供：
- 简化的 API 接口
- 命令行工具支持
- 模块化导入支持

### 4. 增强的管理接口

**文件**: `backend/src/routes/admin.js`

新增了以下管理接口：
- `GET /api/admin/funasr/config` - 获取当前 FunASR 配置
- `POST /api/admin/funasr/config` - 更新 FunASR 配置
- 改进的 `POST /api/admin/test/funasr` - 增强的连接测试

## 使用方法

### 1. 安装依赖

```bash
cd backend
npm install
```

新增的依赖：
- `node-wav`: 用于 WAV 音频文件处理

### 2. 配置 FunASR 服务

#### 环境变量配置

```bash
# 基本配置
export FUNASR_HOST=localhost
export FUNASR_PORT=10095
export FUNASR_SSL=false

# 转录配置
export FUNASR_MODE=2pass-offline
export FUNASR_CHUNK_SIZE=60
export FUNASR_USE_ITN=true
```

#### 通过配置文件

编辑 `funasr_config.json` 文件来调整默认配置。

#### 通过管理接口

使用管理面板或直接调用 API 来动态更新配置：

```bash
curl -X POST http://localhost:3001/api/admin/funasr/config \
  -H "Content-Type: application/json" \
  -d '{
    "host": "your-funasr-host",
    "port": 10095,
    "mode": "2pass-offline",
    "chunkSize": 60
  }'
```

### 3. 转录模式说明

- **offline**: 离线模式，等待完整音频后返回最终结果
- **online**: 在线模式，实时返回部分转录结果
- **2pass-offline**: 两遍离线模式，提供更高精度的转录
- **2pass-online**: 两遍在线模式，兼顾实时性和精度

### 4. API 使用示例

#### WebSocket 转录（推荐）

```javascript
const funasrService = require('./src/services/funasrService');

// 转录音频文件
const result = await funasrService.transcribeAudioWS('/path/to/audio.wav');
console.log('转录结果:', result.text);
console.log('分块结果:', result.chunks);
console.log('时间戳:', result.timestamps);
```

#### HTTP 转录

```javascript
// 传统 HTTP 方式（向后兼容）
const result = await funasrService.transcribeAudio('/path/to/audio.wav');
console.log('转录结果:', result);
```

### 5. Python 客户端使用

#### 作为命令行工具

```bash
# 从麦克风转录
python funasr_client.py --host localhost --port 10095 --mode 2pass-offline

# 从音频文件转录
python funasr_client.py --host localhost --port 10095 --audio_in audio.wav
```

#### 作为 Python 模块

```python
from funasr_client import FunASRClient

# 创建客户端
client = FunASRClient(host='localhost', port=10095)

# 转录音频文件
result = await client.transcribe_file('audio.wav')
print(f"转录结果: {result}")
```

## 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| host | string | localhost | FunASR 服务主机地址 |
| port | number | 10095 | FunASR 服务端口 |
| ssl | boolean | false | 是否使用 SSL 连接 |
| mode | string | 2pass-offline | 转录模式 |
| chunkSize | number | 60 | 音频分块大小（秒） |
| chunkInterval | number | 10 | 分块发送间隔（毫秒） |
| encoderChunkLookBack | number | 4 | 编码器回看分块数 |
| decoderChunkLookBack | number | 1 | 解码器回看分块数 |
| useItn | boolean | true | 是否使用逆文本标准化 |
| audioFs | number | 16000 | 音频采样率 |
| hotwords | string | "" | 热词列表 |

## 故障排除

### 1. WebSocket 连接失败

- 检查 FunASR 服务是否正在运行
- 确认主机和端口配置正确
- 检查防火墙设置
- 验证 SSL 配置是否匹配

### 2. 音频格式不支持

- 确保音频文件格式在支持列表中（WAV、MP3、FLAC）
- 检查音频文件是否损坏
- 验证采样率是否符合要求

### 3. 转录结果为空

- 检查音频文件是否包含有效语音
- 确认转录模式设置正确
- 检查 FunASR 服务日志

### 4. 性能问题

- 调整分块大小和发送间隔
- 检查网络延迟
- 考虑使用更高性能的转录模式

## 兼容性说明

- 保持了与原有 HTTP API 的向后兼容性
- WebSocket 协议完全兼容官方 FunASR 服务
- 支持 Node.js 14+ 版本
- 支持 Python 3.7+ 版本（Python 客户端）

## 更新日志

### v2.0.0
- 基于 `funasr_wss_client.py` 重构 WebSocket 通信协议
- 新增完整的配置管理系统
- 支持多种转录模式和音频格式
- 提供独立的 Python 客户端
- 增强的管理接口和监控功能