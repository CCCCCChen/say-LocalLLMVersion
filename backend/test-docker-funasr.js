#!/usr/bin/env node

/**
 * FunASR Docker 集成测试脚本
 * 用于测试 Docker 版本的 FunASR 服务是否正常工作
 */

const FunASRDockerService = require('./src/services/funasrDockerService');
const path = require('path');
const fs = require('fs');

// 设置环境变量
process.env.USE_DOCKER_FUNASR = 'true';

async function testDockerFunASR() {
    console.log('=== FunASR Docker 集成测试 ===\n');
    
    try {
        // 初始化服务
        console.log('1. 初始化 FunASR Docker 服务...');
        const funasrService = new FunASRDockerService();
        console.log('✅ 服务初始化成功\n');
        
        // 健康检查
        console.log('2. 执行健康检查...');
        const isHealthy = await funasrService.checkHealth();
        if (isHealthy) {
            console.log('✅ FunASR Docker 服务健康检查通过\n');
        } else {
            console.log('❌ FunASR Docker 服务健康检查失败');
            console.log('请确保 FunASR Docker 服务正在运行：');
            console.log('sudo bash online-cpu.sh server\n');
            return;
        }
        
        // 检查客户端可用性
        console.log('3. 检查客户端可用性...');
        const clientAvailable = await funasrService.checkClientAvailable();
        if (clientAvailable) {
            console.log('✅ FunASR 客户端可用\n');
        } else {
            console.log('⚠️  FunASR 客户端不可用，尝试自动设置...');
            const setupSuccess = await funasrService.setupClient();
            if (setupSuccess) {
                console.log('✅ 客户端设置成功\n');
            } else {
                console.log('❌ 客户端设置失败\n');
                return;
            }
        }
        
        // 检查测试音频文件
        console.log('4. 检查测试音频文件...');
        const testAudioPath = path.join(__dirname, '../test-audio.wav');
        
        if (!fs.existsSync(testAudioPath)) {
            console.log('⚠️  测试音频文件不存在，跳过转录测试');
            console.log(`请将测试音频文件放置在: ${testAudioPath}`);
            console.log('支持的格式: .wav, .mp3, .flac, .m4a, .aac 等\n');
        } else {
            console.log('✅ 找到测试音频文件\n');
            
            // 执行转录测试
            console.log('5. 执行转录测试...');
            try {
                const result = await funasrService.transcribeAudio(testAudioPath, {
                    mode: '2pass'
                });
                
                console.log('✅ 转录测试成功');
                console.log('转录结果:');
                console.log('---');
                if (typeof result === 'string') {
                    console.log(result);
                } else if (result && result.text) {
                    console.log(result.text);
                } else {
                    console.log('结果格式:', JSON.stringify(result, null, 2));
                }
                console.log('---\n');
            } catch (transcriptionError) {
                console.log('❌ 转录测试失败:', transcriptionError.message);
                console.log('详细错误:', transcriptionError.stack);
            }
        }
        
        // 测试配置
        console.log('6. 测试配置管理...');
        const supportedFormats = funasrService.getSupportedFormats();
        console.log('支持的音频格式:', supportedFormats.join(', '));
        
        const isWavSupported = funasrService.isSupportedFormat('test.wav');
        console.log('WAV 格式支持:', isWavSupported ? '✅' : '❌');
        
        console.log('\n=== 测试完成 ===');
        console.log('\n如果所有测试都通过，说明 Docker FunASR 集成正常工作。');
        console.log('现在可以启动后端服务：');
        console.log('npm run start:docker-funasr');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
        console.error('详细错误:', error.stack);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testDockerFunASR().catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = testDockerFunASR;