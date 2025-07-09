#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地模型下载脚本
用于下载 Whisper 模型到 public/models/ 目录

使用方法:
1. 安装依赖: pip install huggingface_hub
2. 运行脚本: python download_models.py
3. 选择要下载的模型

支持的模型:
- whisper-tiny: 最小模型，速度最快 (39MB)
- whisper-base: 推荐模型，平衡性能 (74MB) 
- whisper-small: 更高精度 (244MB)
- whisper-medium: 高精度 (769MB)
- whisper-large: 最高精度 (1550MB)
"""

import os
import sys
from pathlib import Path

try:
    from huggingface_hub import snapshot_download
except ImportError:
    print("错误: 请先安装 huggingface_hub")
    print("运行: pip install huggingface_hub")
    sys.exit(1)

# 支持的模型列表
MODELS = {
    '1': {
        'name': 'whisper-tiny',
        'repo_id': 'Xenova/whisper-tiny',
        'size': '39MB',
        'description': '最小模型，速度最快'
    },
    '2': {
        'name': 'whisper-base', 
        'repo_id': 'Xenova/whisper-base',
        'size': '74MB',
        'description': '推荐模型，平衡性能'
    },
    '3': {
        'name': 'whisper-small',
        'repo_id': 'Xenova/whisper-small', 
        'size': '244MB',
        'description': '更高精度'
    },
    '4': {
        'name': 'whisper-medium',
        'repo_id': 'Xenova/whisper-medium',
        'size': '769MB', 
        'description': '高精度'
    },
    '5': {
        'name': 'whisper-large',
        'repo_id': 'Xenova/whisper-large',
        'size': '1550MB',
        'description': '最高精度'
    }
}

def show_menu():
    """显示模型选择菜单"""
    print("\n=== Whisper 模型下载工具 ===")
    print("请选择要下载的模型:")
    print()
    
    for key, model in MODELS.items():
        print(f"{key}. {model['name']} ({model['size']}) - {model['description']}")
    
    print("\n0. 退出")
    print("a. 下载所有模型")
    print()

def download_model(repo_id, model_name, target_dir):
    """下载指定模型"""
    print(f"\n正在下载 {model_name}...")
    print(f"源: {repo_id}")
    print(f"目标目录: {target_dir}")
    
    try:
        snapshot_download(
            repo_id=repo_id,
            local_dir=target_dir,
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print(f"✅ {model_name} 下载完成!")
        return True
    except Exception as e:
        print(f"❌ {model_name} 下载失败: {e}")
        return False

def main():
    """主函数"""
    # 确保 public/models 目录存在
    models_dir = Path("public/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"模型将下载到: {models_dir.absolute()}")
    
    while True:
        show_menu()
        choice = input("请输入选择: ").strip().lower()
        
        if choice == '0':
            print("退出程序")
            break
        elif choice == 'a':
            print("\n开始下载所有模型...")
            success_count = 0
            for model in MODELS.values():
                if download_model(model['repo_id'], model['name'], models_dir):
                    success_count += 1
            print(f"\n下载完成! 成功: {success_count}/{len(MODELS)}")
        elif choice in MODELS:
            model = MODELS[choice]
            download_model(model['repo_id'], model['name'], models_dir)
        else:
            print("无效选择，请重试")
    
    print("\n=== 使用说明 ===")
    print("1. 模型已下载到 public/models/ 目录")
    print("2. 启动应用: npm run dev")
    print("3. 在应用中选择对应的模型进行转录")
    print("4. 应用已配置为仅使用本地模型，不会从网络下载")

if __name__ == "__main__":
    main()