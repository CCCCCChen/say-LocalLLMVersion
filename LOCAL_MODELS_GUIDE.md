# 本地模型使用指南

本应用已配置为**仅使用本地存储的模型**，不会从网络下载模型。这确保了更快的加载速度、更好的隐私保护和离线使用能力。

## 🚀 快速开始

### 第一步：下载模型

我们提供了多种下载方式，请选择适合您的方法：

#### 方法1：使用 Hugging Face CLI（推荐）

```bash
# 1. 安装 Hugging Face CLI
pip install huggingface_hub

# 2. 下载推荐模型 (whisper-base)
huggingface-cli download Xenova/whisper-base --local-dir public/models --local-dir-use-symlinks False

# 3. 可选：下载其他模型
huggingface-cli download Xenova/whisper-tiny --local-dir public/models --local-dir-use-symlinks False
huggingface-cli download Xenova/whisper-small --local-dir public/models --local-dir-use-symlinks False
```

#### 方法2：使用 Python 脚本

```bash
# 1. 安装依赖
pip install huggingface_hub

# 2. 运行下载脚本
python download_models.py

# 3. 按照提示选择要下载的模型
```

#### 方法3：使用 Shell 脚本（macOS/Linux）

```bash
# 1. 给脚本添加执行权限
chmod +x download_models.sh

# 2. 运行脚本
./download_models.sh

# 3. 按照提示选择要下载的模型
```

#### 方法4：使用 curl 手动下载

```bash
# 创建目录
mkdir -p public/models && cd public/models

# 下载 whisper-base 模型文件
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/config.json
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/generation_config.json
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/merges.txt
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/model.safetensors
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/normalizer.json
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/preprocessor_config.json
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/special_tokens_map.json
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/tokenizer.json
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/tokenizer_config.json
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/vocab.json
curl -L -O https://hf-mirror.com/Xenova/whisper-base/resolve/main/added_tokens.json
```

### 第二步：验证模型文件

下载完成后，确保 `public/models/` 目录包含以下文件：

```
public/models/
├── config.json
├── generation_config.json
├── merges.txt
├── model.safetensors
├── normalizer.json
├── preprocessor_config.json
├── special_tokens_map.json
├── tokenizer.json
├── tokenizer_config.json
├── vocab.json
└── added_tokens.json
```

### 第三步：启动应用

```bash
# 安装依赖（如果还没有安装）
npm install

# 启动开发服务器
npm run dev
```

## 📋 支持的模型

| 模型 | 大小 | 描述 | 推荐用途 |
|------|------|------|----------|
| whisper-tiny | 39MB | 最小模型，速度最快 | 快速测试、实时转录 |
| whisper-base | 74MB | **推荐模型**，平衡性能 | 日常使用、平衡速度和精度 |
| whisper-small | 244MB | 更高精度 | 需要更好精度的场景 |
| whisper-medium | 769MB | 高精度 | 专业转录、高质量要求 |
| whisper-large | 1550MB | 最高精度 | 最高质量转录需求 |

## 🔧 配置说明

应用已通过以下配置强制使用本地模型：

### ModelConfig.ts 配置

```typescript
export const defaultModelConfig: ModelConfig = {
    useLocalModels: true,  // 强制启用本地模型
    remoteURL: '',         // 禁用远程URL
    mirrorURLs: [],        // 清空镜像列表
    timeout: 0,            // 禁用网络超时
    retryAttempts: 0       // 禁用重试
};
```

### Worker.js 配置

- 强制本地模型验证
- 禁用网络模型下载
- 添加本地模型路径检查
- 设置 `local_files_only: true`

## 🚨 重要说明

1. **仅本地模型**：应用已配置为仅使用本地模型，不会尝试从网络下载
2. **必须下载**：使用前必须先下载模型文件到 `public/models/` 目录
3. **文件完整性**：确保所有必需的模型文件都已下载
4. **路径检查**：应用会验证模型路径，拒绝网络URL

## 🔍 故障排除

### 问题1：模型加载失败

**症状**：转录按钮点击后出现错误

**解决方案**：
1. 检查 `public/models/` 目录是否存在
2. 确认所有模型文件都已下载
3. 查看浏览器控制台的错误信息

### 问题2："仅允许使用本地模型"错误

**症状**：出现本地模型验证错误

**解决方案**：
1. 确保选择的是本地模型（不包含http链接）
2. 重新下载模型文件
3. 清除浏览器缓存后重试

### 问题3：下载速度慢

**解决方案**：
1. 使用国内镜像：`hf-mirror.com`
2. 尝试不同的下载方法
3. 检查网络连接

### 问题4：磁盘空间不足

**解决方案**：
1. 只下载需要的模型（推荐 whisper-base）
2. 清理不需要的文件
3. 选择更小的模型（whisper-tiny）

## 📝 使用流程

1. **下载模型** → 选择合适的下载方法
2. **验证文件** → 确保所有文件都已下载
3. **启动应用** → `npm run dev`
4. **选择模型** → 在界面中选择已下载的模型
5. **开始转录** → 录制或上传音频文件
6. **查看结果** → 获得转录文本和时间戳

## 🎯 性能优化建议

1. **模型选择**：根据需求选择合适大小的模型
2. **硬件要求**：确保有足够的内存加载模型
3. **浏览器优化**：使用现代浏览器以获得最佳性能
4. **文件管理**：定期清理不需要的模型文件

## 📞 技术支持

如果遇到问题，请：

1. 查看浏览器控制台的错误信息
2. 确认模型文件完整性
3. 检查网络连接（仅下载时需要）
4. 重启应用和浏览器

---

**注意**：本指南适用于已配置为强制本地模型的版本。如需使用网络模型，请参考原始配置文档。