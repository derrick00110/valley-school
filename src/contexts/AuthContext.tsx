// ===================== 认证上下文（超时兜底版） =====================
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, db, firebaseReady } from '../firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Teacher } from '../types';

interface AuthUser {
  uid: string;
  role: 'teacher' | 'manager';
  teacherId?: string;
  teacherName?: string;
  storeId?: string;
  isManager?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  authError: string;
  teachers: Teacher[];
  loginAsTeacher: (teacherId: string) => void;
  loginAsManager: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [authError, setAuthError] = useState('');
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('valley_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔥 10秒超时兜底：无论 Firebase 如何都放行
    const timeout = setTimeout(() => {
      setLoading(false);
      setAuthError('连接超时，请检查网络后刷新页面');
    }, 10000);

    if (!firebaseReady || !auth) {
      setLoading(false);
      setAuthError('Firebase 未初始化，请确认配置文件正确');
      clearTimeout(timeout);
      return;
    }

    let cancelled = false;
    let authUnsub: any;

    signInAnonymously(auth).catch(err => {
      console.warn('匿名登录失败:', err.message);
      if (!cancelled) {
        setAuthError('登录失败: ' + err.message);
        setLoading(false);
      }
    });

    authUnsub = onAuthStateChanged(auth, (u) => {
      if (cancelled) return;
      if (u) {
        setFirebaseUser(u);
        setAuthError('');
      } else {
        setLoading(false);
        if (!authError) setAuthError('等待登录中...');
      }
    }, (err) => {
      if (!cancelled) {
        setAuthError('认证错误: ' + err.message);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (authUnsub) authUnsub();
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser || !db) return;
    let unsub: any;
    try {
      unsub = onSnapshot(
        collection(db, 'teachers'),
        (snap) => {
          const list: Teacher[] = [];
          snap.forEach((d) => {
            try { list.push({ id: d.id, ...d.data() } as Teacher); } catch {}
          });
          setTeachers(list);
          setLoading(false);
        },
        (err) => {
          console.warn('读取教师列表失败:', err.message);
          setTeachers([]);
          setLoading(false);
        }
      );
    } catch (e: any) {
      console.warn('监听教师列表出错:', e);
      setLoading(false);
    }
    return () => { if (unsub) unsub(); };
  }, [firebaseUser]);

  const loginAsTeacher = (teacherId: string) => {
    const t = teachers.find(t => t.id === teacherId);
    if (!t) return;
    setSessionUser({
      uid: firebaseUser?.uid || 'local',
      role: 'teacher',
      teacherId: t.id,
      teacherName: t.name,
      storeId: t.storeId,
      isManager: false,
    });
    localStorage.setItem('valley_session', JSON.stringify(sessionUser));
  };

  const loginAsManager = (password: string): boolean => {
    if (password !== 'sgyyzhou') return false;
    setSessionUser({ uid: firebaseUser?.uid || 'local', role: 'manager', isManager: true });
    localStorage.setItem('valley_session', JSON.stringify(sessionUser));
    return true;
  };

  const logout = () => {
    setSessionUser(null);
    localStorage.removeItem('valley_session');
  };

  return (
    <AuthContext.Provider value={{ user: sessionUser, loading, authError, teachers, loginAsTeacher, loginAsManager, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
