// ===================== 店长端看板 =====================
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, APP_ID } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { STORES, getStore } from '../config';
import { calcLessonFee, calcUnlimitedHalfCommission, calcUpgradeForLessons, getTierByRevenue, getCurrentPeriodInfo, formatMoney } from '../utils/commission';
import { shortId, formatDate } from '../utils/helpers';
import type { Teacher, Student, Enrollment, LessonRecord, ScheduleAppointment } from '../types';
import {
  Music, Users, BookOpen, DollarSign, LogOut, CheckCircle, XCircle, Plus, Trash2,
  Calendar, Clock, Search, Filter, Building2, ShieldCheck, Loader2, AlertCircle, Gift, Download
} from 'lucide-react';

type Tab = 'overview' | 'teachers' | 'students' | 'schedule' | 'finance' | 'salary';

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [tab, setTab] = useState<Tab>('overview');

  // Data
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleAppointment[]>([]);

  // Modals
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddEnrollment, setShowAddEnrollment] = useState(false);
  const [showSalaryDetail, setShowSalaryDetail] = useState<string | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<string | null>(null);
  const [deleteConfirmTeacher, setDeleteConfirmTeacher] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(''), 2500);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);
  const [teacherForm, setTeacherForm] = useState({ name: '', storeId: 'dongguan' as string });
  const [studentForm, setStudentForm] = useState({ name: '', phone: '', teacherId: '', storeId: 'dongguan' as string, note: '' });
  const [enrollmentForm, setEnrollmentForm] = useState({ studentId: '', studentName: '', course: '', courseType: 'fixed' as string, price: '', teacherId: '', storeId: 'dongguan' as string, formalLessons: '', giftedLessons: '0', isUnlimited: 'false' as string });
  const [searchTerm, setSearchTerm] = useState('');

  // Period
  const period = getCurrentPeriodInfo();

  // 监听所有数据（整批替换防竞态）
  useEffect(() => {
    const col = (name: string, store: string) => collection(db, `${name}_${store}`);

    // 老师不分店 — 整批替换
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), snap => {
      try {
        const list: Teacher[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
        setTeachers(list);
      } catch(e) { console.warn('teachers listener error', e); }
    }, e => console.warn('teachers listener failed', e));

    const unsubs: (() => void)[] = [unsubTeachers];

    // 合并两个店的数据到统一数组
    const allStudents = new Map<string, Student>();
    const allEnrollments = new Map<string, Enrollment>();
    const allLessons = new Map<string, LessonRecord>();

    STORES.forEach(s => {
      unsubs.push(onSnapshot(col('students', s.id), snap => {
        try {
          snap.docChanges().forEach(change => {
            const d = change.doc;
            if (change.type === 'removed') {
              allStudents.delete(d.id);
            } else {
              allStudents.set(d.id, { id: d.id, ...d.data() } as Student);
            }
          });
          setStudents(Array.from(allStudents.values()));
        } catch(e) { console.warn('students listener error', e); }
      }, e => console.warn('students listener failed', e)));

      unsubs.push(onSnapshot(col('enrollments', s.id), snap => {
        try {
          snap.docChanges().forEach(change => {
            const d = change.doc;
            if (change.type === 'removed') {
              allEnrollments.delete(d.id);
            } else {
              allEnrollments.set(d.id, { id: d.id, ...d.data() } as Enrollment);
            }
          });
          setEnrollments(Array.from(allEnrollments.values()));
        } catch(e) { console.warn('enrollments listener error', e); }
      }, e => console.warn('enrollments listener failed', e)));

      unsubs.push(onSnapshot(col('lessons', s.id), snap => {
        try {
          snap.docChanges().forEach(change => {
            const d = change.doc;
            if (change.type === 'removed') {
              allLessons.delete(d.id);
            } else {
              allLessons.set(d.id, { id: d.id, ...d.data() } as LessonRecord);
            }
          });
          setLessons(Array.from(allLessons.values()));
        } catch(e) { console.warn('lessons listener error', e); }
      }, e => console.warn('lessons listener failed', e)));

      unsubs.push(onSnapshot(col('schedules', s.id), snap => {
        try {
          snap.docChanges().forEach(change => {
            const d = change.doc;
            if (change.type === 'removed') {
              // schedule state is replaced entirely below
            }
          });
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleAppointment));
          setSchedules(prev => {
            const filtered = prev.filter(x => x.storeId !== s.id);
            return [...filtered, ...list.map(x => ({ ...x, storeId: s.id }))];
          });
        } catch(e) { console.warn('schedules listener error', e); }
      }, e => console.warn('schedules listener failed', e)));
    });

    return () => unsubs.forEach(u => u());
  }, []);

  // 过滤
  const filteredData = <T extends { storeId?: string }>(arr: T[]) => {
    if (storeFilter === 'all') return arr;
    return arr.filter(x => x.storeId === storeFilter);
  };

  // ---- 店长操作：审核消课 ----
  const handleApproveLesson = async (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) { setToastMsg('未找到消课记录'); return; }
    const s = STORES.find(x => x.id === lesson.storeId);
    if (!s) { setToastMsg('门店信息错误'); return; }
    try {
      const colRef = collection(db, `lessons_${s.id}`);
      await updateDoc(doc(colRef, lessonId), { status: 'approved', approvedBy: 'manager', approvedAt: Date.now() } as any);
      // 同时扣学生课时
      const stu = students.find(st => st.id === lesson.studentId);
      if (stu) {
        const stuCol = collection(db, `students_${s.id}`);
        if (lesson.type === 'formal') {
          await updateDoc(doc(stuCol, lesson.studentId), { formalLessons: Math.max(0, stu.formalLessons - 1) } as any);
        } else {
          await updateDoc(doc(stuCol, lesson.studentId), { giftedLessons: Math.max(0, stu.giftedLessons - 1) } as any);
        }
      }
      setToastMsg(`${lesson.studentName} 消课审核通过！`);
    } catch (e: any) { setToastMsg('审核失败：' + e.message); }
  };

  const handleRejectLesson = async (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) { setToastMsg('未找到消课记录'); return; }
    const s = STORES.find(x => x.id === lesson.storeId);
    if (!s) { setToastMsg('门店信息错误'); return; }
    try {
      const colRef = collection(db, `lessons_${s.id}`);
      await updateDoc(doc(colRef, lessonId), { status: 'rejected', approvedBy: 'manager', approvedAt: Date.now() } as any);
      setToastMsg(`已拒绝 ${lesson.studentName} 的消课记录`);
    } catch (e: any) { setToastMsg('拒绝失败：' + e.message); }
  };

  // ---- 添加老师 ----
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.name.trim()) return;
    try {
      const t: Teacher = { id: shortId(), name: teacherForm.name.trim(), storeId: teacherForm.storeId as any, role: 'teacher' };
      await setDoc(doc(db, 'teachers', t.id), t);
      setToastMsg(`已添加老师：${t.name}`);
      setShowAddTeacher(false);
      setTeacherForm({ name: '', storeId: 'dongguan' });
    } catch (e: any) {
      setToastMsg('添加失败: ' + (e.message || '未知错误'));
    }
  };

  // ---- 添加学生 ----
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const stu: Student = {
      id: shortId(), name: studentForm.name, phone: studentForm.phone,
      storeId: studentForm.storeId as any, teacherId: studentForm.teacherId,
      formalLessons: 0, giftedLessons: 0, totalFormal: 0,
      note: studentForm.note, createdAt: Date.now(),
    };
    const colRef = collection(db, `students_${stu.storeId}`);
    await setDoc(doc(colRef, stu.id), stu);
    setToastMsg(`已添加学生：${stu.name}`);
    setShowAddStudent(false);
    setStudentForm({ name: '', phone: '', teacherId: '', storeId: 'dongguan', note: '' });
  };

  // ---- 添加报名 ----
  const handleAddEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(enrollmentForm.price);
    const formalLessons = Number(enrollmentForm.formalLessons);
    const giftedLessons = Number(enrollmentForm.giftedLessons);
    const isUnlimited = enrollmentForm.isUnlimited === 'true';

    // 计算该老师当前周期营业额
    const teacherEnrollments = enrollments.filter(en =>
      en.teacherId === enrollmentForm.teacherId &&
      en.enrollmentDate >= period.start && en.enrollmentDate <= period.end
    );
    const currentPeriodRevenue = teacherEnrollments.reduce((s, e) => s + e.price, 0) + price;
    const tier = getTierByRevenue(currentPeriodRevenue);

    const enrollment: Enrollment = {
      id: shortId(),
      studentId: enrollmentForm.studentId,
      studentName: enrollmentForm.studentName,
      course: enrollmentForm.course,
      courseType: isUnlimited ? 'unlimited' : 'fixed',
      price,
      teacherId: enrollmentForm.teacherId,
      storeId: enrollmentForm.storeId as any,
      enrollmentDate: formatDate(new Date()),
      commissionPeriod: period.period,
      commissionRate: tier.rate,
      formalLessons,
      giftedLessons,
      lessonsPerSession: formalLessons > 0 ? (price * tier.rate) / formalLessons : 0,
      isUnlimited,
      unlimitedHalfApproved: false,
      status: 'active',
      createdAt: Date.now(),
    };

    const colRef = collection(db, `enrollments_${enrollment.storeId}`);
    await setDoc(doc(colRef, enrollment.id), enrollment);
    setToastMsg(`${enrollment.studentName} 报名成功！锁定档位${enrollment.commissionRate*100}%`);

    // 同时更新学生课时
    const stored = storeFilter === 'all' ? enrollmentForm.storeId : storeFilter;
    const stuCol = collection(db, `students_${enrollment.storeId}`);
    const existingStu = students.find(s => s.id === enrollmentForm.studentId);
    if (existingStu) {
      await updateDoc(doc(stuCol, enrollmentForm.studentId), {
        formalLessons: existingStu.formalLessons + formalLessons,
        giftedLessons: existingStu.giftedLessons + giftedLessons,
        totalFormal: existingStu.totalFormal + formalLessons,
      } as any);
    }

    // 检查是否需要升级该老师该周期的消课记录（补差价）
    const currentTier = getTierByRevenue(teacherEnrollments.reduce((s, e) => s + e.price, 0) + price);
    const prevTier = getTierByRevenue(teacherEnrollments.reduce((s, e) => s + e.price, 0));
    if (currentTier.tier > prevTier.tier) {
      const periodLessons = lessons.filter(l =>
        l.teacherId === enrollmentForm.teacherId &&
        l.status === 'approved' && l.type === 'formal'
      );
      const { upgrades } = calcUpgradeForLessons(periodLessons, prevTier.rate, currentTier.rate, enrollments);
      // 更新每条消课记录的课时费
      for (const up of upgrades) {
        for (const s of STORES) {
          try {
            const colRef = collection(db, `lessons_${s.id}`);
            await updateDoc(doc(colRef, up.lessonId), { commissionAmount: up.newAmount, upgradedFrom: up.oldAmount, upgradedAt: Date.now() } as any);
          } catch {}
        }
      }
      if (upgrades.length > 0) {
        console.log(`✅ 档位升级 ${prevTier.label}→${currentTier.label}，补差价${upgrades.length}条，总额${formatMoney(upgrades.reduce((s,u)=>s+u.diff,0))}`);
      }
    }

    setShowAddEnrollment(false);
    setEnrollmentForm({ studentId: '', studentName: '', course: '', courseType: 'fixed', price: '', teacherId: '', storeId: 'dongguan', formalLessons: '', giftedLessons: '0', isUnlimited: 'false' });
  };

  // ---- 删除老师 ----
  const handleDeleteTeacher = async (teacherId: string) => {
    try {
      await deleteDoc(doc(db, 'teachers', teacherId));
      setToastMsg('老师已删除');
      setDeleteConfirmTeacher(null);
    } catch (e: any) { setToastMsg('删除失败：' + e.message); }
  };

  // ---- 删除学生 ----
  const handleDeleteStudent = async (studentId: string) => {
    const stu = students.find(s => s.id === studentId);
    if (!stu) return;
    try {
      const stuCol = collection(db, `students_${stu.storeId}`);
      await deleteDoc(doc(stuCol, studentId));
      // 同时删除该学生的所有报名记录
      const stuEnrollments = enrollments.filter(e => e.studentId === studentId);
      for (const e of stuEnrollments) {
        try {
          const enrollCol = collection(db, `enrollments_${stu.storeId}`);
          await deleteDoc(doc(enrollCol, e.id));
        } catch {}
      }
      setToastMsg(`已删除 ${stu.name} 及其 ${stuEnrollments.length} 条报名记录`);
      setDeleteConfirmStudent(null);
    } catch {}
  };

  // ---- 无限课时过半审核 ----
  const handleApproveHalf = async (enrollmentId: string) => {
    const enrollment = enrollments.find(e => e.id === enrollmentId);
    if (!enrollment) { setToastMsg('未找到该报名记录'); return; }
    try {
      const colRef = collection(db, `enrollments_${enrollment.storeId}`);
      await updateDoc(doc(colRef, enrollmentId), { unlimitedHalfApproved: true } as any);
      setToastMsg(`已确认 ${enrollment.studentName} 的${enrollment.course}过半`);
    } catch (e: any) { setToastMsg('操作失败: ' + e.message); }
  };

  // ---- 统计数据 ----
  const storeCounts = STORES.map(s => {
    const storeStudents = students.filter(st => st.storeId === s.id);
    const storeEnroll = enrollments.filter(e => e.storeId === s.id);
    const storeRevenue = storeEnroll.reduce((sum, e) => sum + e.price, 0);
    const pendingLessons = lessons.filter(l => l.storeId === s.id && l.status === 'pending').length;
    return { ...s, students: storeStudents.length, enrollments: storeEnroll.length, revenue: storeRevenue, pendingLessons };
  });

  // 工资计算
  const salaryData = teachers.map(t => {
    const tEnrollments = enrollments.filter(e => e.teacherId === t.id);
    const tLessons = lessons.filter(l => l.teacherId === t.id && l.status === 'approved');
    const store = getStore(t.storeId);
    const periodEnroll = tEnrollments.filter(e => e.enrollmentDate >= period.start && e.enrollmentDate <= period.end);
    const periodRev = periodEnroll.reduce((s, e) => s + e.price, 0);
    const tier = getTierByRevenue(periodRev);
    const lessonCommissions = tLessons.filter(l => l.type === 'formal').reduce((s, l) => s + (l.commissionAmount || 0), 0);
    const halfCommissions = tEnrollments.filter(e => e.isUnlimited && e.unlimitedHalfApproved).reduce((s, e) => s + calcUnlimitedHalfCommission(e.price, e.commissionRate), 0);
    const totalCommission = lessonCommissions + halfCommissions;
    const totalPayable = store.baseSalary + totalCommission;
    return { ...t, lessonCommissions, halfCommissions, totalCommission, baseSalary: store.baseSalary, totalPayable, periodRevenue: periodRev, tier: tier.label, storeName: store.name };
  });

  const navItems: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: '总览', icon: ShieldCheck },
    { key: 'teachers', label: '老师管理', icon: Users },
    { key: 'students', label: '学生档案', icon: BookOpen },
    { key: 'schedule', label: '排课总览', icon: Calendar },
    { key: 'finance', label: '财务审核', icon: DollarSign },
    { key: 'salary', label: '薪资结算', icon: DollarSign },
  ];

  const allPending = lessons.filter(l => l.status === 'pending');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-indigo-600" />
              <span className="font-bold text-sm">店长管理端</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{period.label}</span>
            </div>
            <div className="flex items-center gap-3">
              {/* 门店筛选 */}
              <select className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none"
                value={storeFilter} onChange={e => setStoreFilter(e.target.value)}>
                <option value="all">全部门店</option>
                {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={logout} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                <LogOut size={14} /> 退出
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {navItems.map(n => (
              <button key={n.key} onClick={() => setTab(n.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
                  ${tab === n.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <n.icon size={14} />
                {n.label}
                {n.key === 'finance' && allPending.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{allPending.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">

        {/* Toast - 用 inline style 确保显示 */}
        {toastMsg && (
          <div style={{
            position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 9999, background: '#16a34a', color: '#fff', padding: '10px 20px',
            borderRadius: '12px', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}>
            ✅ {toastMsg}
          </div>
        )}
        {/* ========== 总览 ========== */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storeCounts.map(s => (
                <div key={s.id} className={`bg-white rounded-2xl p-5 border shadow-sm ${s.id === 'dongguan' ? 'border-indigo-200' : 'border-emerald-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm flex items-center gap-1"><Building2 size={14} /> {s.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.id === 'dongguan' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {s.baseSalary > 0 ? `底薪${formatMoney(s.baseSalary)}` : '无底薪'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-lg font-bold text-slate-800">{s.students}</div><div className="text-xs text-slate-400">学生</div></div>
                    <div><div className="text-lg font-bold text-slate-800">{s.enrollments}</div><div className="text-xs text-slate-400">报名</div></div>
                    <div><div className="text-lg font-bold text-indigo-600">{formatMoney(s.revenue)}</div><div className="text-xs text-slate-400">总营收</div></div>
                  </div>
                  {s.pendingLessons > 0 && (
                    <div className="mt-3 bg-amber-50 rounded-xl p-2 flex items-center justify-between">
                      <span className="text-xs text-amber-700">待审核消课 <strong>{s.pendingLessons}</strong> 条</span>
                      <button onClick={() => setTab('finance')} className="text-xs text-amber-700 underline">去审核</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 快捷操作 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold mb-3">快捷操作</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowAddTeacher(true)} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-medium hover:bg-indigo-100">
                  <Plus size={14} className="inline mr-1" />添加老师
                </button>
                <button onClick={() => setShowAddStudent(true)} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium hover:bg-emerald-100">
                  <Plus size={14} className="inline mr-1" />添加学生
                </button>
                <button onClick={() => setShowAddEnrollment(true)} className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-xs font-medium hover:bg-purple-100">
                  <Plus size={14} className="inline mr-1" />新建报名
                </button>
              </div>
            </div>

            {/* 危险操作 */}
            {storeFilter !== 'all' && (
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-red-700">⚠️ 危险操作区</h4>
                    <p className="text-xs text-red-500 mt-0.5">清空当前门店下所有报名记录（营收归零）</p>
                  </div>
                  <button onClick={() => {
                    const s = STORES.find(x => x.id === storeFilter);
                    if (!s || !confirm(`确定清空 ${s.name} 的所有报名数据？此操作不可撤销！`)) return;
                    const toDelete = enrollments.filter(e => e.storeId === s.id);
                    (async () => {
                      for (const e of toDelete) {
                        try {
                          const colRef = collection(db, `enrollments_${s.id}`);
                          await deleteDoc(doc(colRef, e.id));
                        } catch {}
                      }
                      setToastMsg(`已清空 ${s.name} 的 ${toDelete.length} 条报名记录`);
                    })();
                  }} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700">
                    清空报名
                  </button>
                </div>
              </div>
            )}

            {/* 提成规则说明 */}
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <h4 className="text-xs font-bold text-blue-700 mb-2">📋 当前提成规则（广州车陂店）</h4>
              <div className="text-xs text-blue-600 space-y-0.5">
                <p>• 月营业额 0 ~ 40,000 → 20% 提成</p>
                <p>• 月营业额 40,000 ~ 50,000 → 30% 提成</p>
                <p>• 月营业额 50,000+ → 40% 提成</p>
                <p className="mt-1">• 考核周期：每月15号 ~ 次月15号</p>
                <p>• 东莞总店：无底薪，按原有40%上限</p>
                <p>• 🔄 提成比例在周期内动态浮动，突破阈值自动补差价（之前消过的课也自动升级）</p>
                <p>• 🔒 结算日（15号）后比例锁死，之后消课不再变化</p>
              </div>
            </div>
          </div>
        )}

        {/* ========== 老师管理 ========== */}
        {tab === 'teachers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-sm">老师列表</h2>
              <button onClick={() => setShowAddTeacher(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium">
                <Plus size={14} /> 添加老师
              </button>
            </div>
            <div className="space-y-2">
              {teachers.filter(t => storeFilter === 'all' || t.storeId === storeFilter).map(t => (
                <div key={t.id} className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{t.name}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${t.storeId === 'dongguan' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {getStore(t.storeId).name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-400">
                      {students.filter(s => s.teacherId === t.id).length} 个学生
                    </div>
                    <button onClick={() => setDeleteConfirmTeacher(t.id)}
                      className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100">
                      <Trash2 size={10} className="inline mr-0.5" />删除
                    </button>
                  </div>
                </div>
              ))}
              {teachers.length === 0 && <p className="text-center text-sm text-slate-400 py-8">暂无老师，请添加</p>}
            </div>
          </div>
        )}

        {/* ========== 学生档案 ========== */}
        {tab === 'students' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm">学生档案</h2>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="pl-7 pr-2 py-1.5 bg-slate-50 border rounded-lg text-xs outline-none w-40"
                    placeholder="搜索学生..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <button onClick={() => setShowAddStudent(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium">
                <Plus size={14} /> 添加学生
              </button>
            </div>
            <div className="space-y-2">
              {students.filter(s => (storeFilter === 'all' || s.storeId === storeFilter) && s.name.includes(searchTerm)).map(stu => (
                <div key={stu.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{stu.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${stu.storeId === 'dongguan' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {getStore(stu.storeId).shortName}
                        </span>
                        <span className="text-xs text-slate-400">{teachers.find(t => t.id === stu.teacherId)?.name}老师</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-slate-500">
                        <span>正式课: <strong className="text-indigo-600">{stu.formalLessons}</strong> 节</span>
                        <span>赠送: <strong className="text-emerald-600">{stu.giftedLessons}</strong> 节</span>
                        {stu.phone && <span>📞 {stu.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowAddEnrollment(true)}
                        className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100">报名</button>
                      <button onClick={() => setDeleteConfirmStudent(stu.id)}
                        className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== 排课总览 ========== */}
        {tab === 'schedule' && (
          <div>
            <h2 className="font-bold text-sm mb-4">今日排课总览</h2>
            <div className="space-y-2">
              {schedules.filter(s => s.date === formatDate(new Date()) && (storeFilter === 'all' || s.storeId === storeFilter))
                .sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => (
                <div key={s.id} className={`bg-white rounded-xl p-3 border shadow-sm ${s.checkedIn ? 'border-green-200' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{s.startTime}-{s.endTime}</span>
                      <span className="font-medium text-sm">{s.studentName}</span>
                      <span className="text-xs text-slate-400">{s.course}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.storeId === 'dongguan' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {getStore(s.storeId).shortName}
                      </span>
                    </div>
                    {s.checkedIn ? <CheckCircle size={14} className="text-green-500" /> : <span className="text-xs text-amber-500">未签到</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== 财务审核 ========== */}
        {tab === 'finance' && (
          <div>
            <h2 className="font-bold text-sm mb-4">
              消课审核
              {allPending.length > 0 && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">{allPending.length} 条待审核</span>}
            </h2>
            <div className="space-y-2">
              {lessons.filter(l => (storeFilter === 'all' || l.storeId === storeFilter))
                .sort((a, b) => b.createdAt - a.createdAt).map(l => (
                <div key={l.id} className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{l.studentName}</span>
                      <span className="text-xs text-slate-400">{l.course}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${l.type === 'formal' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {l.type === 'formal' ? '正式' : '赠送'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${l.storeId === 'dongguan' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {getStore(l.storeId).shortName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {teachers.find(t => t.id === l.teacherId)?.name}老师 · {l.date}
                      {l.commissionAmount > 0 && ` · 提成${formatMoney(l.commissionAmount)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.status === 'pending' && (
                      <>
                        <button onClick={() => handleApproveLesson(l.id)}
                          className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"><CheckCircle size={16} /></button>
                        <button onClick={() => handleRejectLesson(l.id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><XCircle size={16} /></button>
                      </>
                    )}
                    {l.status === 'approved' && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded">已通过</span>}
                    {l.status === 'rejected' && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded">已拒绝</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* 无限课时过半审核 */}
            <h3 className="font-bold text-sm mt-6 mb-3">无限课时过半审核</h3>
            {enrollments.filter(e => e.isUnlimited && !e.unlimitedHalfApproved && (storeFilter === 'all' || e.storeId === storeFilter)).length === 0 ? (
              <p className="text-xs text-slate-400">暂无待审核的过半申请</p>
            ) : (
              enrollments.filter(e => e.isUnlimited && !e.unlimitedHalfApproved && (storeFilter === 'all' || e.storeId === storeFilter)).map(e => (
                <div key={e.id} className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-sm">{e.studentName}</span>
                    <span className="text-xs text-slate-400 ml-2">{e.course} · {teachers.find(t => t.id === e.teacherId)?.name}老师</span>
                  </div>
                  <button onClick={() => handleApproveHalf(e.id)}
                    className="text-xs bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-100">
                    确认过半（发{formatMoney(calcUnlimitedHalfCommission(e.price, e.commissionRate))}）
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ========== 薪资结算 ========== */}
        {tab === 'salary' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-sm">薪资结算</h2>
                <p className="text-xs text-slate-400 mt-0.5">考核周期：{period.label}</p>
              </div>
              <button className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium">
                <Download size={14} /> 导出报表
              </button>
            </div>

            {/* 汇总卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <div className="text-xs text-slate-500">老师人数</div>
                <div className="text-lg font-bold text-slate-800">{salaryData.length}</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <div className="text-xs text-slate-500">总底薪</div>
                <div className="text-lg font-bold text-slate-800">{formatMoney(salaryData.reduce((s, t) => s + t.baseSalary, 0))}</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <div className="text-xs text-slate-500">总提成</div>
                <div className="text-lg font-bold text-indigo-600">{formatMoney(salaryData.reduce((s, t) => s + t.totalCommission, 0))}</div>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                <div className="text-xs text-rose-600">应发总额</div>
                <div className="text-lg font-bold text-rose-700">{formatMoney(salaryData.reduce((s, t) => s + t.totalPayable, 0))}</div>
              </div>
            </div>

            {/* 老师工资明细 */}
            <div className="space-y-2">
              {salaryData.filter(t => storeFilter === 'all' || t.storeId === storeFilter).map(t => (
                <div key={t.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.storeId === 'dongguan' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {t.storeName}
                      </span>
                      <span className="text-xs text-slate-400">周期营业额 {formatMoney(t.periodRevenue)} · 档位 {t.tier}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-indigo-700">{formatMoney(t.totalPayable)}</div>
                      <div className="text-[10px] text-slate-400">应发</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 rounded-lg py-2">
                      <div className="text-slate-500">底薪</div>
                      <div className="font-medium">{formatMoney(t.baseSalary)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                      <div className="text-slate-500">课时提成</div>
                      <div className="font-medium text-indigo-600">{formatMoney(t.lessonCommissions)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                      <div className="text-slate-500">过半提成</div>
                      <div className="font-medium text-amber-600">{formatMoney(t.halfCommissions)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ========== 添加老师弹窗 ========== */}
      {showAddTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-slate-800 mb-4">添加老师</h3>
            <form onSubmit={handleAddTeacher} className="space-y-3">
              <input className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="老师姓名" required
                value={teacherForm.name} onChange={e => setTeacherForm({ ...teacherForm, name: e.target.value })} />
              <select className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                value={teacherForm.storeId} onChange={e => setTeacherForm({ ...teacherForm, storeId: e.target.value })}>
                {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddTeacher(false)} className="flex-1 py-2 bg-slate-100 rounded-lg text-sm">取消</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== 添加学生弹窗 ========== */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-slate-800 mb-4">添加学生</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <input className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="学生姓名" required
                value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} />
              <input className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="手机号（选填）"
                value={studentForm.phone} onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })} />
              <select className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" required
                value={studentForm.teacherId} onChange={e => setStudentForm({ ...studentForm, teacherId: e.target.value })}>
                <option value="">选择负责老师</option>
                {teachers.filter(t => storeFilter === 'all' || t.storeId === storeFilter).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                value={studentForm.storeId} onChange={e => setStudentForm({ ...studentForm, storeId: e.target.value })}>
                {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="备注（选填）"
                value={studentForm.note} onChange={e => setStudentForm({ ...studentForm, note: e.target.value })} />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddStudent(false)} className="flex-1 py-2 bg-slate-100 rounded-lg text-sm">取消</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== 新建报名弹窗 ========== */}
      {showAddEnrollment && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">新建报名</h3>
              <button onClick={() => setShowAddEnrollment(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAddEnrollment} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" required
                  value={enrollmentForm.studentId}
                  onChange={e => {
                    const stu = students.find(s => s.id === e.target.value);
                    setEnrollmentForm({ ...enrollmentForm, studentId: e.target.value, studentName: stu?.name || '' });
                  }}>
                  <option value="">选择学生</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="课程名称" required
                  value={enrollmentForm.course} onChange={e => setEnrollmentForm({ ...enrollmentForm, course: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" required
                  value={enrollmentForm.teacherId} onChange={e => setEnrollmentForm({ ...enrollmentForm, teacherId: e.target.value })}>
                  <option value="">选择老师</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="number" className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="实收金额" required
                  value={enrollmentForm.price} onChange={e => setEnrollmentForm({ ...enrollmentForm, price: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="正式课时数" required
                  value={enrollmentForm.formalLessons} onChange={e => setEnrollmentForm({ ...enrollmentForm, formalLessons: e.target.value })} />
                <input type="number" className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="赠送课时数" required
                  value={enrollmentForm.giftedLessons} onChange={e => setEnrollmentForm({ ...enrollmentForm, giftedLessons: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={enrollmentForm.isUnlimited === 'true'}
                    onChange={e => setEnrollmentForm({ ...enrollmentForm, isUnlimited: e.target.checked ? 'true' : 'false' })} />
                  无限课时（钢琴等）
                </label>
                <select className="px-3 py-2 bg-slate-50 border rounded-lg text-sm flex-1"
                  value={enrollmentForm.storeId} onChange={e => setEnrollmentForm({ ...enrollmentForm, storeId: e.target.value })}>
                  {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* 自动计算提示 */}
              {enrollmentForm.price && enrollmentForm.teacherId && (
                <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700">
                  {(() => {
                    const price = Number(enrollmentForm.price);
                    const teacherEnroll = enrollments.filter(e =>
                      e.teacherId === enrollmentForm.teacherId &&
                      e.enrollmentDate >= period.start && e.enrollmentDate <= period.end
                    );
                    const totalRev = teacherEnroll.reduce((s, e) => s + e.price, 0) + price;
                    const tier = getTierByRevenue(totalRev);
                    return (
                      <>
                        该老师本轮已有营业额 {formatMoney(totalRev - price)} + 本次 {formatMoney(price)}
                        <br />累计 <strong>{formatMoney(totalRev)}</strong> → 锁定提成 <strong>{tier.label}</strong>
                        {enrollmentForm.formalLessons && Number(enrollmentForm.formalLessons) > 0 && (
                          <> → 每节课时费 <strong>{formatMoney((price * tier.rate) / Number(enrollmentForm.formalLessons))}</strong></>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddEnrollment(false)} className="flex-1 py-2 bg-slate-100 rounded-lg text-sm">取消</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm">确认报名</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========== 删除老师确认弹窗 ========== */}
      {deleteConfirmTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">确认删除老师？</h3>
            <p className="text-sm text-slate-500 mb-6">
              将删除「{teachers.find(t => t.id === deleteConfirmTeacher)?.name}」老师账号
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmTeacher(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">取消</button>
              <button onClick={() => handleDeleteTeacher(deleteConfirmTeacher!)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 删除学生确认弹窗 ========== */}
      {deleteConfirmStudent && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">确认删除学生？</h3>
            <p className="text-sm text-slate-500 mb-6">
              将删除「{students.find(s => s.id === deleteConfirmStudent)?.name}」的档案及相关报名记录
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmStudent(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">取消</button>
              <button onClick={() => handleDeleteStudent(deleteConfirmStudent!)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
