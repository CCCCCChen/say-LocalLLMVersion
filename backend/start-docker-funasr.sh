#!/bin/bash

# FunASR Docker 模式启动脚本
# 此脚本用于启动使用 Docker FunASR 的后端服务

echo "=== FunASR Docker 模式启动脚本 ==="
echo "当前时间: $(date)"
echo "工作目录: $(pwd)"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在 backend 目录下运行此脚本"
    exit 1
fi

# 设置环境变量
export USE_DOCKER_FUNASR=true
export NODE_ENV=development
export PORT=3001

echo "📋 环境变量设置:"
echo "  USE_DOCKER_FUNASR: $USE_DOCKER_FUNASR"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo ""

# 检查 FunASR Docker 服务是否运行
echo "🔍 检查 FunASR Docker 服务状态..."
if nc -z 127.0.0.1 10095 2>/dev/null; then
    echo "✅ FunASR Docker 服务正在运行 (端口 10095)"
else
    echo "⚠️  警告: FunASR Docker 服务似乎未运行"
    echo "   请确保已通过以下命令启动 FunASR Docker:"
    echo "   sudo bash online-cpu.sh server"
    echo ""
    read -p "是否继续启动后端服务? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 启动已取消"
        exit 1
    fi
fi

echo ""
echo "🚀 启动后端服务..."
echo "   使用 Docker FunASR 模式"
echo "   服务地址: http://localhost:$PORT"
echo "   FunASR 地址: http://127.0.0.1:10095"
echo ""
echo "📝 日志说明:"
echo "   [FUNASR-DOCKER] - Docker FunASR 服务相关日志"
echo "   [TRANSCRIPTION] - 转录处理相关日志"
echo ""
echo "按 Ctrl+C 停止服务"
echo "==========================================="
echo ""

# 启动服务
npm start