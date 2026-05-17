// ===================== 认证上下文（容错版） =====================
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
  teachers: Teacher[];
  loginAsTeacher: (teacherId: string) => void;
  loginAsManager: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

// 默认老师（当无法连接 Firebase 时的兜底数据）
const FALLBACK_TEACHERS: Teacher[] = [];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [teachers, setTeachers] = useState<Teacher[]>(FALLBACK_TEACHERS);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('valley_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let authUnsub: any;

    signInAnonymously(auth).catch(err => {
      console.warn('匿名登录失败:', err.message);
      if (!cancelled) setLoading(false);
    });

    authUnsub = onAuthStateChanged(auth, (u) => {
      if (!cancelled) {
        setFirebaseUser(u);
        if (!u) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
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
            try {
              list.push({ id: d.id, ...d.data() } as Teacher);
            } catch {}
          });
          setTeachers(list);
          setLoading(false);
        },
        (err) => {
          console.warn('读取教师列表失败:', err.message);
          setTeachers(FALLBACK_TEACHERS);
          setLoading(false);
        }
      );
    } catch (e) {
      console.warn('监听教师列表出错:', e);
      setLoading(false);
    }
    return () => { if (unsub) unsub(); };
  }, [firebaseUser]);

  const loginAsTeacher = (teacherId: string) => {
    const t = teachers.find(t => t.id === teacherId);
    if (!t) return;
    const u: AuthUser = {
      uid: firebaseUser?.uid || 'local',
      role: 'teacher',
      teacherId: t.id,
      teacherName: t.name,
      storeId: t.storeId,
      isManager: false,
    };
    setSessionUser(u);
    localStorage.setItem('valley_session', JSON.stringify(u));
  };

  const loginAsManager = (password: string): boolean => {
    if (password !== 'sgyyzhou') return false;
    const u: AuthUser = {
      uid: firebaseUser?.uid || 'local',
      role: 'manager',
      isManager: true,
    };
    setSessionUser(u);
    localStorage.setItem('valley_session', JSON.stringify(u));
    return true;
  };

  const logout = () => {
    setSessionUser(null);
    localStorage.removeItem('valley_session');
  };

  return (
    <AuthContext.Provider value={{ user: sessionUser, loading, teachers, loginAsTeacher, loginAsManager, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
