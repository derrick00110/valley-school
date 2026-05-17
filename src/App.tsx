// ===================== 主应用 =====================
import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import TeacherDashboard from './pages/TeacherDashboard';
import ManagerDashboard from './pages/ManagerDashboard';

function AppContent() {
  const { user, loading, authError } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: 15, margin: '0 0 8px' }}>正在连接云端...</p>
          {authError ? (
            <div style={{ background: '#fef2f2', borderRadius: 12, padding: '12px 16px', marginTop: 12 }}>
              <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>⚠️ {authError}</p>
              <p style={{ color: '#64748b', fontSize: 11, margin: '8px 0 0' }}>
                请确认：<br/>
                1. Firebase 已启用 Anonymous 登录<br/>
                2. Vercel 域名已加入 Firebase 授权域名
              </p>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: 12 }}>首次加载可能需要几秒钟</p>
          )}
          <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      </div>
    );
  }

  if (!user) return <ErrorBoundary><LoginPage /></ErrorBoundary>;
  if (user.isManager) return <ErrorBoundary><ManagerDashboard /></ErrorBoundary>;
  return <ErrorBoundary><TeacherDashboard /></ErrorBoundary>;
}

export default function App() {
  const [init, setInit] = useState(false);
  useEffect(() => { setInit(true); }, []);
  if (!init) return <div style={{ minHeight: '100vh', background: '#f8fafc' }} />;

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
