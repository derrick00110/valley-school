import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 错误边界：确保任何崩溃都能看到提示
function FallbackUI() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h2 style={{ color: '#333' }}>山谷音乐学校管理系统</h2>
      <p style={{ color: '#666' }}>系统正在加载中，请稍候...</p>
      <p style={{ color: '#999', fontSize: '14px' }}>
        如果长时间停留在本页面，请检查 Firebase 配置
      </p>
    </div>
  );
}

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  console.error('App crashed:', e);
  ReactDOM.createRoot(document.getElementById('root')!).render(<FallbackUI />);
}
