// ===================== 登录页 =====================
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { STORES } from '../config';
import { Music, UserCircle, ShieldCheck, Building2 } from 'lucide-react';

export default function LoginPage() {
  const { teachers, loginAsTeacher, loginAsManager } = useAuth();
  const [mode, setMode] = useState<'select' | 'manager'>('select');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleManagerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAsManager(password)) {
      // success
    } else {
      setError('密码错误');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Music size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">山谷音乐学校管理系统</h1>
          <p className="text-sm text-slate-500 mt-1">排课 · 财务 · 薪资一体化</p>
        </div>

        {/* 门店信息 */}
        <div className="flex gap-2 justify-center mb-6">
          {STORES.map(s => (
            <span key={s.id} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
              ${s.id === 'dongguan' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <Building2 size={12} />
              {s.name}
            </span>
          ))}
        </div>

        {/* 模式切换 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => { setMode('select'); setError(''); }}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors
                ${mode === 'select' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <UserCircle size={16} className="inline mr-1" /> 老师登录
            </button>
            <button
              onClick={() => { setMode('manager'); setError(''); }}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors
                ${mode === 'manager' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ShieldCheck size={16} className="inline mr-1" /> 店长登录
            </button>
          </div>

          {mode === 'select' ? (
            <div className="p-6">
              <h2 className="text-sm font-medium text-slate-600 mb-3">选择您的名字</h2>
              {teachers.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <p className="text-sm">暂无老师账号</p>
                  <p className="text-xs mt-1">请店长先在系统中添加老师</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {teachers.map(t => (
                    <button
                      key={t.id}
                      onClick={() => loginAsTeacher(t.id)}
                      className={`p-3 rounded-xl border text-left transition-all hover:shadow-sm
                        ${t.storeId === 'dongguan'
                          ? 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                          : 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'}`}
                    >
                      <div className="font-medium text-sm text-slate-800">{t.name}</div>
                      <div className={`text-xs mt-0.5 ${t.storeId === 'dongguan' ? 'text-indigo-500' : 'text-emerald-500'}`}>
                        {t.storeId === 'dongguan' ? '东莞总店' : '广州车陂店'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleManagerLogin} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">店长密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入管理密码"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                进入管理系统
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          山谷音乐学校 · 综合管理系统 v3.0
        </p>
      </div>
    </div>
  );
}
