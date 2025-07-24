const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

// 确保数据库目录存在
const dbDir = path.join(__dirname, '../../data');
fs.ensureDirSync(dbDir);

const dbPath = path.join(dbDir, 'say.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database.');
});

// 创建表结构
const createTables = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 用户表
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT,
                    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
                    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
                )
            `);

            // 笔记表
            db.run(`
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    tags TEXT NOT NULL DEFAULT '[]',
                    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'transcribing', 'completed', 'error')),
                    audio_url TEXT,
                    transcription_progress INTEGER DEFAULT 0,
                    error_message TEXT,
                    created INTEGER NOT NULL,
                    last_edited INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `);

            // 笔记版本表
            db.run(`
                CREATE TABLE IF NOT EXISTS note_versions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    note_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
                )
            `);

            // 转录任务表
            db.run(`
                CREATE TABLE IF NOT EXISTS transcription_jobs (
                    id TEXT PRIMARY KEY,
                    note_id TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
                    progress INTEGER NOT NULL DEFAULT 0,
                    result TEXT,
                    error TEXT,
                    created_at INTEGER NOT NULL,
                    completed_at INTEGER,
                    audio_file_path TEXT,
                    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database tables created successfully.');
                    resolve();
                }
            });

            // 创建索引
            db.run('CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes (user_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions (note_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_transcription_jobs_note_id ON transcription_jobs (note_id)');
        });
    });
};

// 初始化数据库
createTables().then(() => {
    console.log('Database initialization completed.');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
}).catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});

module.exports = { dbPath };