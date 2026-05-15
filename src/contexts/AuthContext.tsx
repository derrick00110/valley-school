// ===================== 认证上下文 =====================
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, db } from '../firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import type { Teacher, UserRole, StoreId } from '../types';

interface AuthUser {
  uid: string;
  role: UserRole;
  teacherId?: string;
  teacherName?: string;
  storeId?: StoreId;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('valley_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Firebase 匿名登录
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 监听老师列表
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(collection(db, 'teachers'), (snap) => {
      const list: Teacher[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Teacher));
      setTeachers(list);
    });
    return () => unsub();
  }, [firebaseUser]);

  const loginAsTeacher = (teacherId: string) => {
    const t = teachers.find(t => t.id === teacherId);
    if (!t) return;
    const u: AuthUser = {
      uid: firebaseUser?.uid || 'anon',
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
      uid: firebaseUser?.uid || 'anon',
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
