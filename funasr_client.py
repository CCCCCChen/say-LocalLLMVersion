#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FunASR WebSocket客户端
基于funasr_wss_client.py改造，提供更简洁的API接口

使用方法:
1. 直接调用: python funasr_client.py --audio_in audio.wav
2. 作为模块导入使用
"""

import os
import time
import websockets
import ssl
import asyncio
import argparse
import json
import wave
import logging
from pathlib import Path
from typing import Optional, Dict, List, Union

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FunASRClient:
    """
    FunASR WebSocket客户端类
    """
    
    def __init__(self, 
                 host: str = "localhost",
                 port: int = 10095,
                 use_ssl: bool = False,
                 mode: str = "2pass",
                 chunk_size: List[int] = [5, 10, 5],
                 chunk_interval: int = 10,
                 encoder_chunk_look_back: int = 4,
                 decoder_chunk_look_back: int = 0,
                 use_itn: bool = True,
                 audio_fs: int = 16000):
        """
        初始化FunASR客户端
        
        Args:
            host: FunASR服务器地址
            port: FunASR服务器端口
            use_ssl: 是否使用SSL连接
            mode: 识别模式 (offline, online, 2pass)
            chunk_size: 分块大小
            chunk_interval: 分块间隔
            encoder_chunk_look_back: 编码器回看块数
            decoder_chunk_look_back: 解码器回看块数
            use_itn: 是否使用ITN
            audio_fs: 音频采样率
        """
        self.host = host
        self.port = port
        self.use_ssl = use_ssl
        self.mode = mode
        self.chunk_size = chunk_size
        self.chunk_interval = chunk_interval
        self.encoder_chunk_look_back = encoder_chunk_look_back
        self.decoder_chunk_look_back = decoder_chunk_look_back
        self.use_itn = use_itn
        self.audio_fs = audio_fs
        
        # 构建WebSocket URI
        protocol = "wss" if use_ssl else "ws"
        self.uri = f"{protocol}://{host}:{port}"
        
        # SSL上下文
        if use_ssl:
            self.ssl_context = ssl.SSLContext()
            self.ssl_context.check_hostname = False
            self.ssl_context.verify_mode = ssl.CERT_NONE
        else:
            self.ssl_context = None
    
    def _read_audio_file(self, audio_path: str) -> Dict:
        """
        读取音频文件
        
        Args:
            audio_path: 音频文件路径
            
        Returns:
            包含音频数据的字典
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        audio_path = Path(audio_path)
        wav_name = audio_path.stem
        sample_rate = self.audio_fs
        wav_format = "pcm"
        
        if audio_path.suffix.lower() == ".pcm":
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
        elif audio_path.suffix.lower() == ".wav":
            try:
                with wave.open(str(audio_path), "rb") as wav_file:
                    sample_rate = wav_file.getframerate()
                    frames = wav_file.readframes(wav_file.getnframes())
                    audio_bytes = bytes(frames)
            except Exception as e:
                logger.warning(f"Failed to parse WAV file, reading as raw: {e}")
                with open(audio_path, "rb") as f:
                    audio_bytes = f.read()
                wav_format = "others"
        else:
            wav_format = "others"
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
        
        return {
            "audio_bytes": audio_bytes,
            "sample_rate": sample_rate,
            "wav_format": wav_format,
            "wav_name": wav_name
        }
    
    def _parse_hotwords(self, hotwords: Union[str, Dict, None]) -> str:
        """
        解析热词
        
        Args:
            hotwords: 热词文件路径、热词字典或热词字符串
            
        Returns:
            热词JSON字符串
        """
        if not hotwords:
            return ""
        
        if isinstance(hotwords, dict):
            return json.dumps(hotwords)
        
        if isinstance(hotwords, str):
            # 如果是文件路径
            if os.path.exists(hotwords):
                fst_dict = {}
                try:
                    with open(hotwords, "r", encoding="utf-8") as f:
                        for line in f:
                            words = line.strip().split()
                            if len(words) >= 2:
                                try:
                                    fst_dict[" ".join(words[:-1])] = int(words[-1])
                                except ValueError:
                                    logger.warning(f"Invalid hotword format: {line.strip()}")
                    return json.dumps(fst_dict)
                except Exception as e:
                    logger.error(f"Failed to read hotwords file: {e}")
                    return ""
            else:
                # 直接返回字符串
                return hotwords
        
        return ""
    
    async def transcribe_audio(self, 
                              audio_path: str, 
                              hotwords: Union[str, Dict, None] = None,
                              output_file: Optional[str] = None) -> Dict:
        """
        转录音频文件
        
        Args:
            audio_path: 音频文件路径
            hotwords: 热词（文件路径、字典或字符串）
            output_file: 输出文件路径（可选）
            
        Returns:
            转录结果字典
        """
        # 读取音频文件
        audio_data = self._read_audio_file(audio_path)
        
        # 解析热词
        hotword_msg = self._parse_hotwords(hotwords)
        
        # 转录结果
        result = {
            "text": "",
            "chunks": [],
            "timestamp": None,
            "wav_name": audio_data["wav_name"],
            "mode": self.mode,
            "is_complete": False
        }
        
        # 输出文件
        output_writer = None
        if output_file:
            output_writer = open(output_file, "w", encoding="utf-8")
        
        try:
            # 建立WebSocket连接
            async with websockets.connect(
                self.uri, 
                subprotocols=["binary"], 
                ping_interval=None, 
                ssl=self.ssl_context
            ) as websocket:
                
                logger.info(f"Connected to {self.uri}")
                
                # 发送配置消息
                config_message = {
                    "mode": self.mode,
                    "chunk_size": self.chunk_size,
                    "chunk_interval": self.chunk_interval,
                    "encoder_chunk_look_back": self.encoder_chunk_look_back,
                    "decoder_chunk_look_back": self.decoder_chunk_look_back,
                    "audio_fs": audio_data["sample_rate"],
                    "wav_name": audio_data["wav_name"],
                    "wav_format": audio_data["wav_format"],
                    "is_speaking": True,
                    "hotwords": hotword_msg,
                    "itn": self.use_itn
                }
                
                await websocket.send(json.dumps(config_message))
                
                # 计算分块参数
                stride = int(60 * self.chunk_size[1] / self.chunk_interval / 1000 * audio_data["sample_rate"] * 2)
                chunk_num = (len(audio_data["audio_bytes"]) - 1) // stride + 1
                
                # 创建发送和接收任务
                send_task = asyncio.create_task(
                    self._send_audio_chunks(websocket, audio_data["audio_bytes"], stride, chunk_num)
                )
                receive_task = asyncio.create_task(
                    self._receive_messages(websocket, result, output_writer)
                )
                
                # 等待任务完成
                await asyncio.gather(send_task, receive_task)
                
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise
        finally:
            if output_writer:
                output_writer.close()
        
        return result
    
    async def _send_audio_chunks(self, websocket, audio_bytes: bytes, stride: int, chunk_num: int):
        """
        发送音频分块数据
        """
        for i in range(chunk_num):
            beg = i * stride
            data = audio_bytes[beg:beg + stride]
            await websocket.send(data)
            
            # 最后一块发送结束标志
            if i == chunk_num - 1:
                end_message = {"is_speaking": False}
                await websocket.send(json.dumps(end_message))
            
            # 控制发送速度
            sleep_duration = (
                0.001 if self.mode == "offline" 
                else 60 * self.chunk_size[1] / self.chunk_interval / 1000
            )
            await asyncio.sleep(sleep_duration)
    
    async def _receive_messages(self, websocket, result: Dict, output_writer):
        """
        接收转录消息
        """
        offline_msg_done = False
        text_print_2pass_online = ""
        text_print_2pass_offline = ""
        
        try:
            while True:
                message = await websocket.recv()
                response = json.loads(message)
                
                wav_name = response.get("wav_name", "demo")
                text = response.get("text", "")
                timestamp = response.get("timestamp", "")
                mode = response.get("mode", "")
                is_final = response.get("is_final", False)
                
                # 写入输出文件
                if output_writer and text:
                    if timestamp:
                        output_writer.write(f"{wav_name}\t{text}\t{timestamp}\n")
                    else:
                        output_writer.write(f"{wav_name}\t{text}\n")
                    output_writer.flush()
                
                # 处理不同模式的响应
                if mode == "offline":
                    result["text"] += text
                    if timestamp:
                        result["timestamp"] = timestamp
                    
                    logger.info(f"Offline result: {text}")
                    
                    if is_final:
                        result["is_complete"] = True
                        break
                        
                elif mode == "online":
                    result["text"] += text
                    result["chunks"].append({
                        "text": text,
                        "timestamp": timestamp
                    })
                    logger.info(f"Online result: {text}")
                    
                elif mode in ["2pass-online", "2pass-offline"]:
                    if mode == "2pass-online":
                        text_print_2pass_online += text
                        result["chunks"].append({
                            "text": text,
                            "timestamp": timestamp,
                            "type": "online"
                        })
                        logger.info(f"2pass online: {text}")
                    else:
                        text_print_2pass_online = ""
                        text_print_2pass_offline += text
                        result["text"] = text_print_2pass_offline
                        result["is_complete"] = True
                        logger.info(f"2pass offline: {text}")
                        break
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
            if self.mode == "online":
                result["is_complete"] = True
        except Exception as e:
            logger.error(f"Error receiving messages: {e}")
            raise


def main():
    """
    命令行入口
    """
    parser = argparse.ArgumentParser(description="FunASR WebSocket Client")
    parser.add_argument("--host", type=str, default="localhost", help="FunASR server host")
    parser.add_argument("--port", type=int, default=10095, help="FunASR server port")
    parser.add_argument("--ssl", type=int, default=0, help="Use SSL (1) or not (0)")
    parser.add_argument("--mode", type=str, default="2pass", choices=["offline", "online", "2pass"], help="Recognition mode")
    parser.add_argument("--chunk_size", type=str, default="5,10,5", help="Chunk size")
    parser.add_argument("--chunk_interval", type=int, default=10, help="Chunk interval")
    parser.add_argument("--encoder_chunk_look_back", type=int, default=4, help="Encoder chunk look back")
    parser.add_argument("--decoder_chunk_look_back", type=int, default=0, help="Decoder chunk look back")
    parser.add_argument("--use_itn", type=int, default=1, help="Use ITN (1) or not (0)")
    parser.add_argument("--audio_fs", type=int, default=16000, help="Audio sample rate")
    parser.add_argument("--audio_in", type=str, required=True, help="Input audio file path")
    parser.add_argument("--hotwords", type=str, default="", help="Hotwords file path or string")
    parser.add_argument("--output", type=str, help="Output file path")
    
    args = parser.parse_args()
    
    # 解析chunk_size
    chunk_size = [int(x) for x in args.chunk_size.split(",")]
    
    # 创建客户端
    client = FunASRClient(
        host=args.host,
        port=args.port,
        use_ssl=bool(args.ssl),
        mode=args.mode,
        chunk_size=chunk_size,
        chunk_interval=args.chunk_interval,
        encoder_chunk_look_back=args.encoder_chunk_look_back,
        decoder_chunk_look_back=args.decoder_chunk_look_back,
        use_itn=bool(args.use_itn),
        audio_fs=args.audio_fs
    )
    
    # 执行转录
    async def run_transcription():
        try:
            result = await client.transcribe_audio(
                audio_path=args.audio_in,
                hotwords=args.hotwords if args.hotwords else None,
                output_file=args.output
            )
            
            print("\n=== Transcription Result ===")
            print(f"File: {result['wav_name']}")
            print(f"Mode: {result['mode']}")
            print(f"Text: {result['text']}")
            if result['timestamp']:
                print(f"Timestamp: {result['timestamp']}")
            print(f"Complete: {result['is_complete']}")
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return 1
        
        return 0
    
    # 运行异步任务
    exit_code = asyncio.run(run_transcription())
    exit(exit_code)


if __name__ == "__main__":
    main()