import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Modal from "./modal/Modal";
import { UrlInput } from "./modal/UrlInput";
import AudioPlayer from "./AudioPlayer";
import Constants from "../utils/Constants";
import Progress from "./Progress";
import AudioRecorder from "./AudioRecorder";

// Utility function to convert AudioBuffer to WAV Blob
function audioBufferToWav(audioBuffer: AudioBuffer, mimeType: string): Blob {
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    
    // Create a new ArrayBuffer for the WAV file
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export enum AudioSource {
    URL = "URL",
    FILE = "FILE",
    RECORDING = "RECORDING",
}

interface Props {
    onTranscriptionComplete?: (text: string) => void;
    onAudioUpload?: (audioFile: File, title?: string) => Promise<string>;
}

export function AudioManager({ onTranscriptionComplete, onAudioUpload }: Props) {
    const [progress, setProgress] = useState<number | undefined>(undefined);
    const [audioData, setAudioData] = useState<{
        buffer: AudioBuffer;
        url: string;
        source: AudioSource;
        mimeType: string;
        type: string;
    } | undefined>(undefined);
    const [audioDownloadUrl, setAudioDownloadUrl] = useState<string | undefined>(undefined);
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [showRecordModal, setShowRecordModal] = useState(false);

    const isAudioLoading = progress !== undefined;

    const resetAudio = useCallback(() => {
        setAudioData(undefined);
        setAudioDownloadUrl(undefined);
        setProgress(undefined);
    }, []);

    // Audio processing functions

    const setAudioFromDownload = async (data: ArrayBuffer, mimeType: string) => {
        const audioCTX = new AudioContext({ sampleRate: Constants.SAMPLING_RATE });
        const blobUrl = URL.createObjectURL(new Blob([data], { type: "audio/*" }));
        const decoded = await audioCTX.decodeAudioData(data);
        setAudioData({
            buffer: decoded,
            url: blobUrl,
            source: AudioSource.URL,
            mimeType: mimeType,
            type: "" //TODO: figure out how to get the type
        });
    };

    const setAudioFromRecording = async (data: Blob) => {
        resetAudio();
        setProgress(0);
        const blobUrl = URL.createObjectURL(data);
        const fileReader = new FileReader();
        fileReader.onprogress = (event) => {
            setProgress(event.loaded / event.total || 0);
        };
        fileReader.onloadend = async () => {
            const audioCTX = new AudioContext({ sampleRate: Constants.SAMPLING_RATE });
            const arrayBuffer = fileReader.result as ArrayBuffer;
            const decoded = await audioCTX.decodeAudioData(arrayBuffer);
            setProgress(undefined);
            setAudioData({
                buffer: decoded,
                url: blobUrl,
                source: AudioSource.RECORDING,
                mimeType: data.type,
                type: "" //TODO: figure out how to get the type
            });
            setShowRecordModal(false);
            
            // 如果支持后台转录，自动上传音频文件
            if (onAudioUpload) {
                try {
                    const audioFile = new File([data], `recording-${Date.now()}.wav`, { type: data.type });
                    await onAudioUpload(audioFile, 'Recorded Audio');
                    resetAudio(); // 清理本地音频数据
                } catch (error) {
                    console.error('Error uploading audio for background transcription:', error);
                }
            }
        };
        fileReader.readAsArrayBuffer(data);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        resetAudio();
        setProgress(0);
        
        // 如果支持后台处理，直接上传文件
        if (onAudioUpload) {
            try {
                await onAudioUpload(file, file.name);
                setProgress(undefined);
                return;
            } catch (error) {
                console.error('Error uploading audio file:', error);
                // 如果上传失败，继续本地处理
            }
        }
        
        const blobUrl = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onprogress = (event) => {
            setProgress(event.loaded / event.total || 0);
        };
        reader.onload = async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) return;

            const audioCTX = new AudioContext({ sampleRate: Constants.SAMPLING_RATE });
            const decoded = await audioCTX.decodeAudioData(arrayBuffer);
            setProgress(undefined);
            setAudioData({
                buffer: decoded,
                url: blobUrl,
                source: AudioSource.FILE,
                mimeType: file.type,
                type: file.name.split('.').pop() || '',
            });
        };
        reader.readAsArrayBuffer(file);
    };

    const downloadAudioFromUrl = async (requestAbortController: AbortController) => {
        if (audioDownloadUrl) {
            try {
                setAudioData(undefined);
                setProgress(0);
                const { data, headers } = await axios.get(audioDownloadUrl, {
                    signal: requestAbortController.signal,
                    responseType: "arraybuffer",
                    onDownloadProgress(progressEvent) {
                        setProgress(progressEvent.progress || 0);
                    },
                });

                let mimeType = headers["content-type"];
                if (!mimeType || mimeType === "audio/wave") {
                    mimeType = "audio/wav";
                }
                setAudioFromDownload(data, mimeType);
                setShowUrlModal(false);
            } catch (error) {
                console.error("Request failed or aborted", error);
            } finally {
                setProgress(undefined);
            }
        }
    };

    useEffect(() => {
        if (audioDownloadUrl) {
            const requestAbortController = new AbortController();
            downloadAudioFromUrl(requestAbortController);
            return () => {
                requestAbortController.abort();
            };
        }
    }, [audioDownloadUrl]);

    // Removed Whisper transcription and Dify workflow functions

    // Removed Dify config and Whisper model change handlers

    const convertToMp3 = async (audioBuffer: AudioBuffer): Promise<Blob> => {
        // Create an offline audio context
        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        // Create a buffer source
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start();

        // Render the audio
        const renderedBuffer = await offlineCtx.startRendering();

        // Convert to WAV format first (since we can't directly create MP3)
        const wavBlob = await new Promise<Blob>((resolve) => {
            const length = renderedBuffer.length;
            const channels = renderedBuffer.numberOfChannels;
            const sampleRate = renderedBuffer.sampleRate;
            
            // Create the WAV file
            const buffer = new ArrayBuffer(44 + length * channels * 2);
            const view = new DataView(buffer);
            
            // Write WAV header
            const writeString = (view: DataView, offset: number, string: string) => {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            };
            
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + length * channels * 2, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, channels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * channels * 2, true);
            view.setUint16(32, channels * 2, true);
            view.setUint16(34, 16, true);
            writeString(view, 36, 'data');
            view.setUint32(40, length * channels * 2, true);
            
            // Write audio data
            const offset = 44;
            for (let i = 0; i < length; i++) {
                for (let channel = 0; channel < channels; channel++) {
                    const sample = Math.max(-1, Math.min(1, renderedBuffer.getChannelData(channel)[i]));
                    view.setInt16(offset + (i * channels + channel) * 2, sample * 0x7FFF, true);
                }
            }
            
            resolve(new Blob([buffer], { type: 'audio/wav' }));
        });

        // For now, we'll return WAV since we can't create true MP3 in the browser
        // The file will still download as .mp3 but will actually be a WAV file
        // This ensures the audio is at least playable
        return wavBlob;
    };

    const handleExportAudio = useCallback(async () => {
        if (!audioData) return;
        
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const blob = await convertToMp3(audioData.buffer);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording-${timestamp}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting audio:', error);
        }
    }, [audioData]);

    return (
        <div className="space-y-6">

            {!audioData && (
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={() => setShowRecordModal(true)}
                        className="w-full max-w-md px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-lg font-semibold flex items-center justify-center gap-3"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Start Recording
                    </button>
                    
                    <div className="flex gap-4 w-full max-w-md">
                        <button
                            onClick={() => setShowUrlModal(true)}
                            className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                            </svg>
                            From URL
                        </button>
                        
                        <label className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Upload File
                            <input
                                type="file"
                                accept="audio/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </label>
                    </div>
                </div>
            )}
            
            {/* Removed ModelSelector and WorkflowConfig components */}

            {isAudioLoading && (
                <div className="w-full bg-gray-200 rounded-full h-1">
                    <div
                        className="bg-blue-600 h-1 rounded-full transition-all duration-100"
                        style={{ width: `${Math.round(progress! * 100)}%` }}
                    />
                </div>
            )}

            {audioData && (
                <div className="space-y-4">
                    <AudioPlayer audioUrl={audioData.url} mimeType={audioData.mimeType} />
                    
                    <div className="space-y-4">
                        {/* Removed TranscribeButton and WorkflowButton components */}
                        
                        <div className="flex justify-center">
                            <button
                                onClick={resetAudio}
                                className="px-4 py-2 text-red-500 hover:text-red-600 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleExportAudio}
                        className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-lg font-semibold flex items-center justify-center gap-3"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Audio
                    </button>

                    {/* Removed model loading progress display */}
                    
                    {/* Removed Dify workflow status display */}
                </div>
            )}

            <Modal
                show={showUrlModal}
                title="Add Audio from URL"
                content={
                    <>
                        <p className="mb-4">Enter the URL of the audio file you want to transcribe.</p>
                        <UrlInput
                            onChange={(e) => setAudioDownloadUrl(e.target.value)}
                            value={audioDownloadUrl || Constants.DEFAULT_AUDIO_URL}
                        />
                    </>
                }
                onClose={() => setShowUrlModal(false)}
                submitText="Load Audio"
                onSubmit={() => {}}
            />

            <Modal
                show={showRecordModal}
                title="Record Audio"
                content={
                    <AudioRecorder onRecordingComplete={setAudioFromRecording} />
                }
                onClose={() => setShowRecordModal(false)}
                onSubmit={() => {}}
            />
        </div>
    );
}
