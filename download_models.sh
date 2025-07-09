#!/bin/bash
# Whisper 模型下载脚本 (使用 curl)
# 适用于 macOS/Linux 系统

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 curl 是否可用
check_curl() {
    if ! command -v curl &> /dev/null; then
        print_error "curl 未安装，请先安装 curl"
        exit 1
    fi
}

# 创建模型目录
setup_directory() {
    print_info "创建模型目录..."
    mkdir -p public/models
    cd public/models
    print_success "目录创建完成: $(pwd)"
}

# 下载单个文件
download_file() {
    local url="$1"
    local filename="$2"
    
    print_info "下载: $filename"
    if curl -L -f -o "$filename" "$url"; then
        print_success "✅ $filename 下载完成"
        return 0
    else
        print_error "❌ $filename 下载失败"
        return 1
    fi
}

# 下载 whisper-base 模型
download_whisper_base() {
    print_info "开始下载 whisper-base 模型 (推荐)..."
    
    local base_url="https://hf-mirror.com/Xenova/whisper-base/resolve/main"
    local files=(
        "config.json"
        "generation_config.json"
        "merges.txt"
        "model.safetensors"
        "normalizer.json"
        "preprocessor_config.json"
        "special_tokens_map.json"
        "tokenizer.json"
        "tokenizer_config.json"
        "vocab.json"
        "added_tokens.json"
    )
    
    local success_count=0
    local total_files=${#files[@]}
    
    for file in "${files[@]}"; do
        if download_file "$base_url/$file" "$file"; then
            ((success_count++))
        fi
    done
    
    print_info "下载完成: $success_count/$total_files 文件成功"
    
    if [ $success_count -eq $total_files ]; then
        print_success "🎉 whisper-base 模型下载完成!"
        return 0
    else
        print_warning "部分文件下载失败，请检查网络连接"
        return 1
    fi
}

# 下载 whisper-tiny 模型
download_whisper_tiny() {
    print_info "开始下载 whisper-tiny 模型 (最小)..."
    
    local base_url="https://hf-mirror.com/Xenova/whisper-tiny/resolve/main"
    local files=(
        "config.json"
        "generation_config.json"
        "merges.txt"
        "model.safetensors"
        "normalizer.json"
        "preprocessor_config.json"
        "special_tokens_map.json"
        "tokenizer.json"
        "tokenizer_config.json"
        "vocab.json"
        "added_tokens.json"
    )
    
    local success_count=0
    local total_files=${#files[@]}
    
    for file in "${files[@]}"; do
        if download_file "$base_url/$file" "$file"; then
            ((success_count++))
        fi
    done
    
    if [ $success_count -eq $total_files ]; then
        print_success "🎉 whisper-tiny 模型下载完成!"
        return 0
    else
        print_warning "部分文件下载失败"
        return 1
    fi
}

# 显示菜单
show_menu() {
    echo
    echo "=== Whisper 模型下载工具 (curl 版本) ==="
    echo "请选择要下载的模型:"
    echo
    echo "1. whisper-tiny (39MB) - 最小模型，速度最快"
    echo "2. whisper-base (74MB) - 推荐模型，平衡性能"
    echo "3. 下载两个模型"
    echo "0. 退出"
    echo
}

# 主函数
main() {
    print_info "Whisper 本地模型下载工具"
    
    # 检查依赖
    check_curl
    
    # 设置目录
    setup_directory
    
    while true; do
        show_menu
        read -p "请输入选择 (0-3): " choice
        
        case $choice in
            1)
                download_whisper_tiny
                ;;
            2)
                download_whisper_base
                ;;
            3)
                print_info "下载所有模型..."
                download_whisper_tiny
                download_whisper_base
                ;;
            0)
                print_info "退出程序"
                break
                ;;
            *)
                print_warning "无效选择，请重试"
                ;;
        esac
        
        echo
        read -p "按 Enter 继续..."
    done
    
    echo
    print_success "=== 使用说明 ==="
    echo "1. 模型已下载到 public/models/ 目录"
    echo "2. 启动应用: npm run dev"
    echo "3. 在应用中选择对应的模型进行转录"
    echo "4. 应用已配置为仅使用本地模型"
}

# 运行主函数
main "$@"