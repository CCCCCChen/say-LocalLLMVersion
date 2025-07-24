import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import AdminPanel from './components/AdminPanel';
// Removed Whisper transcriber import
import { AudioManager } from './components/AudioManager';
import { backendAPI, Note, NoteVersion } from './utils/BackendAPI';

// Note and NoteVersion interfaces are now imported from BackendAPI

function App() {
    // Removed Whisper transcriber initialization
    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNoteList, setShowNoteList] = useState(false);
    const [showInfo, setShowInfo] = useState(true);
    const [showAdmin, setShowAdmin] = useState(false);
    const [userId, setUserId] = useState<string>('user-demo-002'); // 临时用户ID
    // 移除了转录相关的状态管理代码

    const loadNotes = useCallback(async () => {
        try {
            // 设置当前用户ID到API客户端
            backendAPI.setUserId(userId);
            
            // 从后端加载笔记
            const userNotes = await backendAPI.getNotes(userId);
            setNotes(userNotes);
            
            // 移除了转录任务检查逻辑
            
        } catch (error) {
            console.error('Error loading notes from backend:', error);
            // 如果后端不可用，尝试从localStorage加载作为备用
            const storedNotes = localStorage.getItem('notes');
            if (storedNotes) {
                try {
                    const parsedNotes = JSON.parse(storedNotes);
                    const migratedNotes = parsedNotes.map((note: any) => ({
                        ...note,
                        userId: userId,
                        status: note.status || 'completed',
                        tags: note.tags || [],
                        versions: note.versions || [],
                        created: note.created || Date.now(),
                        lastEdited: note.lastEdited || Date.now()
                    }));
                    setNotes(migratedNotes);
                } catch (parseError) {
                    console.error('Error parsing stored notes:', parseError);
                }
            }
        } finally {
            setIsLoaded(true);
        }
    }, [userId]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const saveNotes = useCallback((notesToSave: Note[]) => {
        // 保留localStorage作为备用
        localStorage.setItem('notes', JSON.stringify(notesToSave));
    }, []);

    const updateNotes = useCallback((newNotes: Note[]) => {
        setNotes(newNotes);
        saveNotes(newNotes);
    }, [saveNotes]);

    const handleCreateNote = useCallback(async () => {
        try {
            const newNote = await backendAPI.createNote({
                userId: userId,
                title: 'New Note',
                content: '',
                tags: []
            });
            setNotes(prevNotes => [...prevNotes, newNote]);
            setSelectedNoteId(newNote.id);
            return newNote.id;
        } catch (error) {
            console.error('Error creating note:', error);
            // 备用方案：本地创建
            const now = Date.now();
            const newNote: Note = {
                id: now.toString(),
                userId: userId,
                title: 'New Note',
                content: '',
                tags: [],
                versions: [],
                created: now,
                lastEdited: now,
                status: 'draft'
            };
            updateNotes([...notes, newNote]);
            setSelectedNoteId(newNote.id);
            return newNote.id;
        }
    }, [notes, updateNotes, userId]);

    // 简化后的函数，仅处理文本内容添加到笔记中
    const handleTranscriptionComplete = useCallback((text: string) => {
        setShowInfo(false);
        // 创建新笔记
        const now = Date.now();
        const newNote: Note = {
            id: now.toString(),
            userId: userId,
            title: 'Audio Note',
            content: text,
            tags: [],
            versions: [],
            created: now,
            lastEdited: now,
            status: 'completed'
        };
        updateNotes([...notes, newNote]);
        setSelectedNoteId(newNote.id);
        setShowNoteList(true);
    }, [notes, updateNotes, userId]);

    // 处理音频文件上传，简化版本，不涉及转录
    const handleAudioUpload = useCallback(async (audioFile: File, title: string = 'Audio Note') => {
        try {
            setShowInfo(false);
            // 创建带有音频文件的笔记
            const newNote = await backendAPI.createNote({
                userId: userId,
                title: title,
                content: '音频文件已上传',
                tags: [],
                audioFile: audioFile
            });
            
            setNotes(prevNotes => [...prevNotes, newNote]);
            console.log('New note created:', newNote);
            setSelectedNoteId(newNote.id);
            setShowNoteList(true);
            
            return newNote.id;
        } catch (error) {
            console.error('Error uploading audio:', error);
            // 备用方案：创建本地笔记
            const now = Date.now();
            const newNote: Note = {
                id: now.toString(),
                userId: userId,
                title: title,
                content: '音频文件已上传（本地）',
                tags: [],
                versions: [],
                created: now,
                lastEdited: now,
                status: 'completed'
            };
            updateNotes([...notes, newNote]);
            setSelectedNoteId(newNote.id);
            setShowNoteList(true);
            return newNote.id;
        }
    }, [notes, updateNotes, userId]);

    const handleDeleteNote = useCallback(async (id: string) => {
        try {
            await backendAPI.deleteNote(id);
            const updatedNotes = notes.filter(note => note.id !== id);
            setNotes(updatedNotes);
            if (selectedNoteId === id) {
                setSelectedNoteId(null);
            }
            // 移除了转录任务清理逻辑
        } catch (error) {
            console.error('Error deleting note:', error);
            // 备用方案：本地删除
            const updatedNotes = notes.filter(note => note.id !== id);
            updateNotes(updatedNotes);
            if (selectedNoteId === id) {
                setSelectedNoteId(null);
            }
        }
    }, [notes, selectedNoteId, updateNotes]);

    const handleUpdateNote = useCallback(async (updatedNote: Note) => {
        try {
            const serverNote = await backendAPI.updateNote({
                id: updatedNote.id,
                title: updatedNote.title,
                content: updatedNote.content,
                tags: updatedNote.tags
            });
            const updatedNotes = notes.map(note => 
                note.id === updatedNote.id ? serverNote : note
            );
            setNotes(updatedNotes);
        } catch (error) {
            console.error('Error updating note:', error);
            // 备用方案：本地更新
            const updatedNotes = notes.map(note => 
                note.id === updatedNote.id ? { ...updatedNote, lastEdited: Date.now() } : note
            );
            updateNotes(updatedNotes);
        }
    }, [notes, updateNotes]);

    const handleSaveVersion = useCallback(async (noteId: string, description: string) => {
        try {
            const updatedNote = await backendAPI.saveNoteVersion(noteId, description);
            const updatedNotes = notes.map(note => 
                note.id === noteId ? updatedNote : note
            );
            setNotes(updatedNotes);
        } catch (error) {
            console.error('Error saving version:', error);
            // 备用方案：本地保存版本
            const note = notes.find(n => n.id === noteId);
            if (note) {
                const newVersion: NoteVersion = {
                    content: note.content,
                    timestamp: Date.now(),
                    description
                };
                const updatedNote = {
                    ...note,
                    versions: [...note.versions, newVersion],
                    lastEdited: Date.now()
                };
                handleUpdateNote(updatedNote);
            }
        }
    }, [notes, handleUpdateNote]);

    const handleRestoreVersion = useCallback(async (noteId: string, version: NoteVersion) => {
        try {
            // 找到版本索引
            const note = notes.find(n => n.id === noteId);
            if (note) {
                const versionIndex = note.versions.findIndex(v => 
                    v.timestamp === version.timestamp && v.description === version.description
                );
                if (versionIndex !== -1) {
                    const updatedNote = await backendAPI.restoreNoteVersion(noteId, String(versionIndex));
                    const updatedNotes = notes.map(n => 
                        n.id === noteId ? updatedNote : n
                    );
                    setNotes(updatedNotes);
                }
            }
        } catch (error) {
            console.error('Error restoring version:', error);
            // 备用方案：本地恢复版本
            const note = notes.find(n => n.id === noteId);
            if (note) {
                const updatedNote = {
                    ...note,
                    content: version.content,
                    lastEdited: Date.now()
                };
                handleUpdateNote(updatedNote);
            }
        }
    }, [notes, handleUpdateNote]);

    const handleUpdateTags = useCallback((noteId: string, tags: string[]) => {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            const updatedNote = {
                ...note,
                tags,
                lastEdited: Date.now()
            };
            handleUpdateNote(updatedNote);
        }
    }, [notes, handleUpdateNote]);

    const handleExportNotes = useCallback(async () => {
        try {
            // 尝试从后端获取最新的笔记数据
            const latestNotes = await backendAPI.getNotes(userId);
            const notesBlob = new Blob([JSON.stringify(latestNotes, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(notesBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scribe-notes-export-${userId}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting notes from backend:', error);
            // 备用方案：导出本地笔记
            const notesBlob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(notesBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scribe-notes-export-local.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }, [notes, userId]);

    const handleImportNotes = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedNotes = JSON.parse(e.target?.result as string);
                    if (Array.isArray(importedNotes) && importedNotes.every(note => 
                        typeof note === 'object' && 
                        'id' in note && 
                        'title' in note && 
                        'content' in note
                    )) {
                        const now = Date.now();
                        const migratedNotes = importedNotes.map(note => ({
                            ...note,
                            userId: userId, // 确保导入的笔记属于当前用户
                            tags: note.tags || [],
                            versions: note.versions || [],
                            created: note.created || now,
                            lastEdited: note.lastEdited || now,
                            status: note.status || 'completed',
                            transcriptionProgress: note.transcriptionProgress || 0
                        }));
                        
                        try {
                            // 尝试批量导入到后端
                            for (const note of migratedNotes) {
                                await backendAPI.createNote({
                                    userId: note.userId,
                                    title: note.title,
                                    content: note.content,
                                    tags: note.tags
                                });
                            }
                            // 重新加载笔记
                            await loadNotes();
                            alert('Notes imported successfully!');
                        } catch (error) {
                            console.error('Error importing to backend:', error);
                            // 备用方案：本地导入
                            updateNotes(migratedNotes);
                            alert('Notes imported locally (backend unavailable)');
                        }
                    } else {
                        alert('Invalid notes format');
                    }
                } catch (error) {
                    console.error('Error importing notes:', error);
                    alert('Error importing notes');
                }
            };
            reader.readAsText(file);
        }
    }, [updateNotes, userId, loadNotes]);

    const filteredNotes = useMemo(() => {
        const searchLower = searchQuery.toLowerCase();
        return notes.filter(note => {
            // 安全访问 title 和 content，并转为字符串
            const title = typeof note.title === 'string' ? note.title : '';
            const content = typeof note.content === 'string' ? note.content : '';
            
            // 安全处理 tags 数组
            const tags = Array.isArray(note.tags) 
                ? note.tags 
                : typeof note.tags === 'string' 
                    ? [note.tags] 
                    : [];

            return (
                title.toLowerCase().includes(searchLower) ||
                content.toLowerCase().includes(searchLower) ||
                tags.some(tag => 
                    typeof tag === 'string' && tag.toLowerCase().includes(searchLower)
                )
            );
        });
    }, [notes, searchQuery]);

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    return (
        <div className='flex flex-col min-h-screen bg-slate-50'>
            <header className='bg-slate-800 text-white p-4 shadow-lg'>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h1 className='text-3xl font-bold'>Say</h1>
                        <button
                            onClick={() => setShowNoteList(!showNoteList)}
                            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                        >
                            {showNoteList ? 'Hide Notes' : 'Show Notes'}
                        </button>
                        <button
                            onClick={() => setShowAdmin(!showAdmin)}
                            className="px-3 py-1 text-sm bg-orange-600 hover:bg-orange-500 rounded-md transition-colors"
                        >
                            {showAdmin ? 'Exit Admin' : 'Admin Panel'}
                        </button>
                    </div>
                </div>
            </header>
            <main className='flex-grow flex flex-col md:flex-row'>
                {showAdmin ? (
                    <AdminPanel />
                ) : (
                    <>
                        {showNoteList && (
                            <aside className='w-full md:w-72 bg-white border-b md:border-r border-slate-200 p-4 overflow-y-auto'>
                                <NoteList
                                    notes={filteredNotes}
                                    selectedNoteId={selectedNoteId}
                                    onSelectNote={setSelectedNoteId}
                                    onDeleteNote={handleDeleteNote}
                                    onCreateNote={handleCreateNote}
                                    searchQuery={searchQuery}
                                    onSearchChange={setSearchQuery}
                                    onExportNotes={handleExportNotes}
                                    onImportNotes={handleImportNotes}
                                />
                            </aside>
                        )}
                        <section className={`flex-grow p-2 md:p-4 ${showNoteList ? 'md:w-[calc(100%-18rem)]' : 'w-full'}`}>
                    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
                            <h2 className="text-xl md:text-2xl font-semibold mb-4">Quick Record</h2>
                            <AudioManager 
                    onTranscriptionComplete={handleTranscriptionComplete}
                    onAudioUpload={handleAudioUpload}
                />
                        </div>

                        {showInfo && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6">
    <h3 className="text-base md:text-lg font-semibold text-blue-900 mb-2">Welcome to Say!</h3>
    <p className="text-sm md:text-base text-blue-800">
        Easily record and transcribe your audio files into text using AI. When you start recording, 
        it will download a small language model to your device. All processing happens privately and locally.
    </p>
    <ul className="text-sm md:text-base list-disc list-inside pl-4 text-blue-800 md:p-6 p-6">
        <li>🎙️ High-quality on-device transcription with Whisper (tiny or base)</li>
        <li>📂 Transcribe recordings, local and hosted audio files</li>
        <li>📝 Rich-text editing, note management, and versioning</li>
        <li>✍️ AI summaries of notes powered by T5</li>
        <li>🔄 Export and import all your notes any time</li>
    </ul>
</div>
                        )}

                        {selectedNoteId && (
                            <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
                                <NoteEditor
                                    note={notes.find(note => note.id === selectedNoteId)!}
                                    onUpdateNote={(updatedNote: Note) => {
                                        void handleUpdateNote(updatedNote);
                                    }}
                                    onSaveVersion={handleSaveVersion}
                                    onRestoreVersion={handleRestoreVersion}
                                    onUpdateTags={handleUpdateTags}
                                    hasMicrophonePermission={true}
                                />
                            </div>
                        )}
                    </div>
                </section>
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
