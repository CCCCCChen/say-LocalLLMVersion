# FunASR Docker 部署指南

本指南将帮助您快速部署 FunASR 转录服务，并将其集成到 Say 应用中。

## 📋 前置要求

- Docker 和 Docker Compose
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间（用于模型存储）

## 🚀 快速开始

### 1. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# FunASR 服务配置
FUNASR_ENABLED=true
FUNASR_HOST=localhost
FUNASR_PORT=10095
FUNASR_MODE=offline

# 可选配置
FUNASR_USERNAME=
FUNASR_PASSWORD=
FUNASR_HOTWORDS=
FUNASR_ITN_ENABLED=true
FUNASR_MAX_CONCURRENT=10
FUNASR_TIMEOUT=30000

# 回退配置
FUNASR_FALLBACK_TO_WHISPER=true
```

### 2. 启动 FunASR 服务

#### 启动离线转录服务（推荐）
```bash
docker-compose -f docker-compose.funasr.yml up -d
```

#### 启动实时转录服务
```bash
docker-compose -f docker-compose.funasr.yml --profile realtime up -d
```

#### 同时启动两个服务
```bash
docker-compose -f docker-compose.funasr.yml --profile realtime up -d
```

### 3. 验证服务状态

```bash
# 检查服务状态
docker-compose -f docker-compose.funasr.yml ps

# 查看服务日志
docker-compose -f docker-compose.funasr.yml logs -f

# 测试服务连接
curl http://localhost:10095/health
```

### 4. 启动 Say 应用

```bash
npm run dev
```

现在您可以在 Say 应用的转录设置中看到 FunASR 服务状态。

## 🔧 高级配置

### 热词配置

创建 `hotwords.txt` 文件来提高特定词汇的识别准确率：

```
人工智能
机器学习
深度学习
自然语言处理
```

### 模型目录结构

```
funasr_models/
├── speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/
├── speech_fsmn_vad_zh-cn-16k-common-pytorch/
├── punc_ct-transformer_zh-cn-common-vocab272727-pytorch/
├── speech_transformer_lm_zh-cn-common-vocab8404-pytorch/
├── fst_itn_zh/
└── hotwords.txt
```

### 性能优化

#### CPU 优化
```yaml
# 在 docker-compose.funasr.yml 中调整
environment:
  - WORKERS=8  # 根据 CPU 核心数调整
  - OMP_NUM_THREADS=4
```

#### 内存优化
```yaml
deploy:
  resources:
    limits:
      memory: 8G
    reservations:
      memory: 4G
```

## 🐛 故障排除

### 常见问题

#### 1. 服务启动失败
```bash
# 检查日志
docker-compose -f docker-compose.funasr.yml logs funasr-offline

# 重启服务
docker-compose -f docker-compose.funasr.yml restart
```

#### 2. 模型下载缓慢
```bash
# 使用国内镜像
export DOCKER_REGISTRY=registry.cn-hangzhou.aliyuncs.com
```

#### 3. 内存不足
```bash
# 减少工作进程数
environment:
  - WORKERS=2
```

#### 4. 端口冲突
```yaml
# 修改端口映射
ports:
  - "10097:10095"  # 使用不同的主机端口
```

### 健康检查

```bash
# 检查服务健康状态
curl -f http://localhost:10095/health

# 测试转录功能
wscat -c ws://localhost:10095
```

## 📊 监控和日志

### 查看实时日志
```bash
# 所有服务日志
docker-compose -f docker-compose.funasr.yml logs -f

# 特定服务日志
docker-compose -f docker-compose.funasr.yml logs -f funasr-offline
```

### 性能监控
```bash
# 容器资源使用情况
docker stats funasr-offline-server

# 系统资源监控
htop
```

## 🔄 服务管理

### 启动/停止服务
```bash
# 启动
docker-compose -f docker-compose.funasr.yml up -d

# 停止
docker-compose -f docker-compose.funasr.yml down

# 重启
docker-compose -f docker-compose.funasr.yml restart

# 强制重新创建
docker-compose -f docker-compose.funasr.yml up -d --force-recreate
```

### 更新服务
```bash
# 拉取最新镜像
docker-compose -f docker-compose.funasr.yml pull

# 重新部署
docker-compose -f docker-compose.funasr.yml up -d
```

### 清理资源
```bash
# 停止并删除容器
docker-compose -f docker-compose.funasr.yml down

# 删除未使用的镜像
docker image prune

# 删除未使用的卷
docker volume prune
```

## 🌐 网络配置

### 防火墙设置
```bash
# Ubuntu/Debian
sudo ufw allow 10095
sudo ufw allow 10096

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=10095/tcp
sudo firewall-cmd --permanent --add-port=10096/tcp
sudo firewall-cmd --reload
```

### 反向代理（Nginx）
```nginx
server {
    listen 80;
    server_name funasr.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:10095;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📈 性能基准

### 硬件要求

| 配置 | CPU | 内存 | 磁盘 | 并发数 |
|------|-----|------|------|--------|
| 最小 | 2核 | 4GB | 10GB | 1-2 |
| 推荐 | 4核 | 8GB | 20GB | 5-10 |
| 高性能 | 8核+ | 16GB+ | 50GB+ | 20+ |

### 转录性能

- **离线模式**: 通常比实时快 2-5 倍
- **实时模式**: 接近实时处理
- **准确率**: 中文识别准确率 > 95%

## 🔗 相关链接

- [FunASR 官方文档](https://github.com/modelscope/FunASR)
- [FunASR Docker Hub](https://hub.docker.com/r/funasr/funasr)
- [ModelScope 社区](https://modelscope.cn/)
- [Say 项目文档](./README.md)

## 💡 最佳实践

1. **生产环境部署**
   - 使用专用服务器
   - 配置负载均衡
   - 设置监控告警
   - 定期备份模型

2. **安全考虑**
   - 限制网络访问
   - 使用 HTTPS
   - 定期更新镜像
   - 监控异常访问

3. **性能优化**
   - 根据硬件调整并发数
   - 使用 SSD 存储模型
   - 优化网络带宽
   - 监控资源使用

---

如有问题，请查看 [故障排除指南](./NETWORK_TROUBLESHOOTING.md) 或提交 Issue。