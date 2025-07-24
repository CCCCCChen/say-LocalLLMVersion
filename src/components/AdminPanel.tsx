import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

interface SystemStatus {
  timestamp: string;
  database: {
    users: number;
    notes: number;
    transcriptionJobs: number;
  };
  transcriptionStats: Record<string, number>;
  services: {
    funasr: string;
  };
  storage: {
    uploadsSize: string;
    uploadsCount: number;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  created: number;
  notesCount: number;
  lastActivity: number;
}

interface TranscriptionJob {
  id: string;
  noteId: string;
  status: string;
  progress: number;
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  audioFilePath?: string;
}

const AdminPanel: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [activeTab, setActiveTab] = useState<'status' | 'users' | 'jobs'>('status');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'http://localhost:3001';

  const fetchData = async (endpoint: string) => {
    const response = await fetch(`${API_BASE}/admin/${endpoint}`, {
      headers: {
        'Authorization': 'Bearer dev-admin-token'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '请求失败');
    }
    
    return data.data;
  };

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchData('status');
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载状态失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchData('users');
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchData('transcription-jobs');
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const cleanupFailedJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/cleanup/failed-jobs`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer dev-admin-token'
        }
      });
      
      const data = await response.json();
      if (data.success) {
        alert(data.data.message);
        loadJobs(); // 重新加载任务列表
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '清理失败');
    } finally {
      setLoading(false);
    }
  };

  const testFunASR = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/test/funasr`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer dev-admin-token'
        }
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`FunASR测试结果:\nHTTP: ${data.data.http}\nWebSocket: ${data.data.websocket}`);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'status') loadStatus();
    else if (activeTab === 'users') loadUsers();
    else if (activeTab === 'jobs') loadJobs();
  }, [activeTab]);

  const formatDate = (timestamp: number | string) => {
    const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp);
    return date.toLocaleString('zh-CN');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'processing': return '#FF9800';
      case 'failed': case 'error': return '#F44336';
      case 'pending': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>系统管理面板</h1>
        <div className="admin-tabs">
          <button 
            className={activeTab === 'status' ? 'active' : ''}
            onClick={() => setActiveTab('status')}
          >
            系统状态
          </button>
          <button 
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            用户管理
          </button>
          <button 
            className={activeTab === 'jobs' ? 'active' : ''}
            onClick={() => setActiveTab('jobs')}
          >
            转录任务
          </button>
        </div>
      </div>

      {loading && <div className="loading">加载中...</div>}
      {error && <div className="error">错误: {error}</div>}

      {activeTab === 'status' && status && (
        <div className="status-panel">
          <div className="status-grid">
            <div className="status-card">
              <h3>数据库统计</h3>
              <p>用户数: {status.database.users}</p>
              <p>笔记数: {status.database.notes}</p>
              <p>转录任务: {status.database.transcriptionJobs}</p>
            </div>
            
            <div className="status-card">
              <h3>转录统计</h3>
              {Object.entries(status.transcriptionStats).map(([status, count]) => (
                <p key={status}>
                  <span style={{ color: getStatusColor(status) }}>●</span>
                  {status}: {count}
                </p>
              ))}
            </div>
            
            <div className="status-card">
              <h3>服务状态</h3>
              <p>
                <span style={{ color: status.services.funasr === 'healthy' ? '#4CAF50' : '#F44336' }}>●</span>
                FunASR: {status.services.funasr}
              </p>
              <button onClick={testFunASR} disabled={loading}>
                测试FunASR连接
              </button>
            </div>
            
            <div className="status-card">
              <h3>存储信息</h3>
              <p>上传文件大小: {status.storage.uploadsSize}</p>
              <p>文件数量: {status.storage.uploadsCount}</p>
            </div>
          </div>
          
          <div className="actions">
            <button onClick={loadStatus} disabled={loading}>
              刷新状态
            </button>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="users-panel">
          <div className="panel-header">
            <h3>用户列表 ({users.length})</h3>
            <button onClick={loadUsers} disabled={loading}>
              刷新
            </button>
          </div>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>姓名</th>
                  <th>邮箱</th>
                  <th>笔记数</th>
                  <th>创建时间</th>
                  <th>最后活动</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.notesCount}</td>
                    <td>{formatDate(user.created)}</td>
                    <td>{formatDate(user.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="jobs-panel">
          <div className="panel-header">
            <h3>转录任务 ({jobs.length})</h3>
            <div>
              <button onClick={loadJobs} disabled={loading}>
                刷新
              </button>
              <button onClick={cleanupFailedJobs} disabled={loading}>
                清理失败任务
              </button>
            </div>
          </div>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>笔记ID</th>
                  <th>状态</th>
                  <th>进度</th>
                  <th>创建时间</th>
                  <th>完成时间</th>
                  <th>错误信息</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.noteId}</td>
                    <td>
                      <span style={{ color: getStatusColor(job.status) }}>●</span>
                      {job.status}
                    </td>
                    <td>{job.progress || 0}%</td>
                    <td>{formatDate(job.createdAt)}</td>
                    <td>{job.completedAt ? formatDate(job.completedAt) : '-'}</td>
                    <td className="error-cell">{job.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;