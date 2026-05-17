// ===================== 通用错误边界 =====================
import React from 'react';

interface State { hasError: boolean; error: string; stack: string; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: '', stack: '' };

  static getDerivedStateFromError(e: Error): State {
    return { hasError: true, error: e.message || String(e), stack: e.stack || '' };
  }

  componentDidCatch(e: Error, info: any) {
    console.error('🔥 系统崩溃:', e, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: 480, padding: 24, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', margin: 0 }}>系统发生错误</h2>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <code style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error}
              </code>
            </div>
            <details style={{ marginBottom: 12 }}>
              <summary style={{ fontSize: 12, color: '#64748b', cursor: 'pointer' }}>详细堆栈</summary>
              <pre style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
                {this.state.stack}
              </pre>
            </details>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              style={{ width: '100%', padding: '10px 0', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
            >
              重新加载页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
