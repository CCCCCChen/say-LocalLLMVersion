# 网络连接问题排查指南

## 问题描述

如果您遇到以下错误：
```
TypeError: Failed to fetch
at getFile (hub.js:206)
at getModelFile
at getModelJSON
```

这通常表示无法从 Hugging Face 下载转录模型。

## 解决方案

### 1. 自动镜像切换（推荐）

应用已配置自动检测最佳可用镜像源：
- 优先使用国内镜像：`https://hf-mirror.com/`
- 备用官方源：`https://huggingface.co/`

### 2. 手动配置代理

如果您使用代理，请在启动应用前设置环境变量：

```bash
# macOS/Linux
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port

# Windows
set HTTP_PROXY=http://your-proxy:port
set HTTPS_PROXY=http://your-proxy:port
```

### 3. 使用本地模型

您可以下载模型到本地使用：

1. 创建 `public/models` 目录
2. 从以下地址下载模型文件：
   - 官方：`https://huggingface.co/Xenova/whisper-tiny`
   - 镜像：`https://hf-mirror.com/Xenova/whisper-tiny`
3. 将模型文件放入对应目录

### 4. 修改配置

您可以在 `src/utils/ModelConfig.ts` 中修改配置：

```typescript
export const defaultModelConfig: ModelConfig = {
    useLocalModels: true,  // 启用本地模型
    remoteURL: 'https://hf-mirror.com/',  // 使用镜像
    mirrorURLs: [
        'https://your-custom-mirror.com/',  // 添加自定义镜像
        'https://hf-mirror.com/',
        'https://huggingface.co/',
    ],
    timeout: 60000,  // 增加超时时间
    retryAttempts: 5  // 增加重试次数
};
```

## 支持的模型

应用支持以下 Whisper 模型：
- `whisper-tiny` (39MB) - 最快，准确度较低
- `whisper-base` (74MB) - 平衡选择
- `whisper-small` (244MB) - 较好准确度
- `whisper-medium` (769MB) - 高准确度
- `whisper-large` (1550MB) - 最高准确度

## 网络测试

您可以通过以下命令测试网络连接：

```bash
# 测试官方源
curl -I https://huggingface.co/Xenova/whisper-tiny/resolve/main/config.json

# 测试镜像源
curl -I https://hf-mirror.com/Xenova/whisper-tiny/resolve/main/config.json
```

## 常见问题

### Q: 模型下载很慢怎么办？
A: 尝试使用国内镜像源或下载到本地使用。

### Q: 如何知道当前使用的是哪个镜像？
A: 查看浏览器控制台，会显示 "Using mirror: xxx" 信息。

### Q: 可以完全离线使用吗？
A: 可以，将模型下载到本地并设置 `useLocalModels: true`。

## 技术支持

如果问题仍然存在，请检查：
1. 网络连接是否正常
2. 防火墙设置
3. 代理配置
4. DNS 解析是否正常