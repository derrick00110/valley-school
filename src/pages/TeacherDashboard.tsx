// ===================== 老师端看板 =====================
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, APP_ID } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { STORES } from '../config';
import { calcLessonFee, calcUnlimitedHalfCommission, formatMoney, getTierByRevenue, getCurrentPeriodInfo } from '../utils/commission';
import { shortId, formatDate, formatDateDisplay } from '../utils/helpers';
import type { Student, Enrollment, LessonRecord, ScheduleAppointment, LessonType } from '../types';
import {
  Calendar, Users, BookOpen, DollarSign, LogOut, Clock, CheckCircle, XCircle,
  Plus, Music, ChevronLeft, ChevronRight, AlertCircle, Loader2, Building2, Gift
} from 'lucide-react';

type Tab = 'schedule' | 'students' | 'lessons' | 'salary';

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const teacherId = user?.teacherId || '';
  const teacherName = user?.teacherName || '';
  const storeId = user?.storeId || 'dongguan';
  const store = STORES.find(s => s.id === storeId)!;

  const [tab, setTab] = useState<Tab>('schedule');

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleAppointment[]>([]);

  // Schedule state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ studentId: '', studentName: '', course: '', startTime: '10:00', endTime: '11:00', room: '', note: '' });

  // Lesson state
  const [showDeduct, setShowDeduct] = useState<{ studentId: string; enrollmentId: string; studentName: string; course: string; type: LessonType } | null>(null);

  // Alert
  const [alertMsg, setAlertMsg] = useState('');
  useEffect(() => {
    if (alertMsg) {
      const t = setTimeout(() => setAlertMsg(''), 2500);
      return () => clearTimeout(t);
    }
  }, [alertMsg]);

  // Student creation
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: '', phone: '', note: '' });

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const colRef = collection(db, `students_${storeId}`);
    const stu: Student = {
      id: shortId(), name: studentForm.name, phone: studentForm.phone,
      storeId, teacherId, formalLessons: 0, giftedLessons: 0, totalFormal: 0,
      note: studentForm.note, createdAt: Date.now(),
    };
    await setDoc(doc(colRef, stu.id), stu);
    setAlertMsg(`已添加学生：${stu.name}`);
    setShowAddStudent(false);
    setStudentForm({ name: '', phone: '', note: '' });
  };

  // Enrollment creation (teacher side)
  const [showAddEnrollment, setShowAddEnrollment] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ studentId: '', studentName: '', course: '', price: '', formalLessons: '1', giftedLessons: '0', isUnlimited: false });

  const handleAddEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(enrollForm.price);
    const formalLessons = Number(enrollForm.formalLessons);
    const giftedLessons = Number(enrollForm.giftedLessons);
    const isUnlimited = enrollForm.isUnlimited;

    // 计算老师周期营业额→锁定档位
    const periodEnroll = enrollments.filter(en =>
      en.teacherId === teacherId && en.enrollmentDate >= period.start && en.enrollmentDate <= period.end
    );
    const totalRev = periodEnroll.reduce((s, e) => s + e.price, 0) + price;
    const tier = getTierByRevenue(totalRev);

    const enrollment: Enrollment = {
      id: shortId(), studentId: enrollForm.studentId, studentName: enrollForm.studentName,
      course: enrollForm.course, courseType: isUnlimited ? 'unlimited' : 'fixed',
      price, teacherId, storeId,
      enrollmentDate: formatDate(new Date()),
      commissionPeriod: period.period,
      commissionRate: tier.rate,
      formalLessons, giftedLessons,
      lessonsPerSession: formalLessons > 0 ? (price * tier.rate) / formalLessons : 0,
      isUnlimited, unlimitedHalfApproved: false,
      status: 'active', createdAt: Date.now(),
    };

    const colRef = collection(db, `enrollments_${storeId}`);
    await setDoc(doc(colRef, enrollment.id), enrollment);

    // 更新学生课时
    const stuCol = collection(db, `students_${storeId}`);
    const existingStu = students.find(s => s.id === enrollForm.studentId);
    if (existingStu) {
      await updateDoc(doc(stuCol, enrollForm.studentId), {
        formalLessons: existingStu.formalLessons + formalLessons,
        giftedLessons: existingStu.giftedLessons + giftedLessons,
      } as any);
    }
    setAlertMsg(`${enrollForm.studentName} 报名成功！锁定${tier.label}`);
    setShowAddEnrollment(false);
    setEnrollForm({ studentId: '', studentName: '', course: '', price: '', formalLessons: '1', giftedLessons: '0', isUnlimited: false });
  };

  // 监听数据
  useEffect(() => {
    if (!teacherId) return;
    const col = (name: string) => collection(db, `${name}_${storeId}`);

    const unsubStudents = onSnapshot(col('students'), snap => {
      const list: Student[] = [];
      snap.forEach(d => { const data = d.data(); if (data.teacherId === teacherId) list.push({ id: d.id, ...data } as Student); });
      setStudents(list);
    });
    const unsubEnroll = onSnapshot(col('enrollments'), snap => {
      const list: Enrollment[] = [];
      snap.forEach(d => { const data = d.data(); if (data.teacherId === teacherId) list.push({ id: d.id, ...data } as Enrollment); });
      setEnrollments(list);
    });
    const unsubLessons = onSnapshot(col('lessons'), snap => {
      const list: LessonRecord[] = [];
      snap.forEach(d => { const data = d.data(); if (data.teacherId === teacherId) list.push({ id: d.id, ...data } as LessonRecord); });
      setLessons(list);
    });
    const unsubSched = onSnapshot(col('schedules'), snap => {
      const list: ScheduleAppointment[] = [];
      snap.forEach(d => { const data = d.data(); if (data.teacherId === teacherId || !data.teacherId) list.push({ id: d.id, ...data } as ScheduleAppointment); });
      setSchedules(list);
    });

    return () => { unsubStudents(); unsubEnroll(); unsubLessons(); unsubSched(); };
  }, [teacherId, storeId]);

  // 排课日期导航
  const today = formatDate(currentDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay() + i);
    return formatDate(d);
  });
  const daySchedules = schedules.filter(s => s.date === today);

  // ---- 消课处理 ----
  const handleDeductLesson = async () => {
    if (!showDeduct) return;
    const enrollment = enrollments.find(e => e.id === showDeduct.enrollmentId);
    if (!enrollment) return;

    const isFormal = showDeduct.type === 'formal';
    if (isFormal && enrollment.formalLessons <= 0) {
      alert('该课程正式课时已用完！');
      return;
    }
    if (!isFormal && enrollment.giftedLessons <= 0) {
      alert('该课程赠送课时已用完！');
      return;
    }

    const lessonFee = isFormal ? calcLessonFee(enrollment.price, enrollment.commissionRate, enrollment.formalLessons) : 0;

    const lessonData: LessonRecord = {
      id: shortId(),
      studentId: showDeduct.studentId,
      studentName: showDeduct.studentName,
      enrollmentId: showDeduct.enrollmentId,
      course: showDeduct.course,
      teacherId,
      storeId,
      date: formatDate(new Date()),
      type: showDeduct.type,
      commissionAmount: lessonFee,
      status: 'pending',
      createdAt: Date.now(),
    };

    const colRef = collection(db, `lessons_${storeId}`);
    await setDoc(doc(colRef, lessonData.id), lessonData);
    setAlertMsg(`已提交消课记录，待店长审核`);
    setShowDeduct(null);
  };

  // ---- 添加排课 ----
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const sched: ScheduleAppointment = {
      id: shortId(),
      studentId: scheduleForm.studentId,
      studentName: scheduleForm.studentName,
      course: scheduleForm.course,
      teacherId,
      storeId,
      date: today,
      startTime: scheduleForm.startTime,
      endTime: scheduleForm.endTime,
      room: scheduleForm.room,
      note: scheduleForm.note,
      checkedIn: false,
      createdAt: Date.now(),
    };
    const colRef = collection(db, `schedules_${storeId}`);
    await setDoc(doc(colRef, sched.id), sched);
    setAlertMsg('排课已添加');
    setScheduleForm({ studentId: '', studentName: '', course: '', startTime: '10:00', endTime: '11:00', room: '', note: '' });
    setShowAddSchedule(false);
  };

  // ---- 签到（上课打卡） ----
  const handleCheckIn = async (scheduleId: string) => {
    const s = schedules.find(s => s.id === scheduleId);
    if (!s) return;
    // 标记已签到
    const colRef = collection(db, `schedules_${storeId}`);
    await updateDoc(doc(colRef, scheduleId), { checkedIn: true } as any);

    // 自动创建消课记录（正式课）
    const enrollment = enrollments.find(e => e.studentId === s.studentId && e.status === 'active');
    if (enrollment) {
      const lessonFee = enrollment.formalLessons > 0
        ? calcLessonFee(enrollment.price, enrollment.commissionRate, enrollment.formalLessons) : 0;
      const lessonData: LessonRecord = {
        id: shortId(),
        studentId: s.studentId,
        studentName: s.studentName,
        enrollmentId: enrollment.id,
        course: s.course,
        teacherId,
        storeId,
        date: s.date,
        type: 'formal',
        commissionAmount: lessonFee,
        status: 'pending',
        createdAt: Date.now(),
      };
      const lessonCol = collection(db, `lessons_${storeId}`);
      await setDoc(doc(lessonCol, lessonData.id), lessonData);
      setAlertMsg(`已签到并创建消课记录`);
    }
  };

  // 计算预估工资
  const period = getCurrentPeriodInfo();
  const periodLessons = lessons.filter(l =>
    l.status === 'approved' && l.teacherId === teacherId &&
    l.date >= period.start && l.date <= period.end
  );
  const periodEnrollments = enrollments.filter(e =>
    e.teacherId === teacherId && e.enrollmentDate >= period.start && e.enrollmentDate <= period.end
  );
  const periodRevenue = periodEnrollments.reduce((s, e) => s + e.price, 0);
  const tier = getTierByRevenue(periodRevenue);
  const totalLessonCommission = periodLessons.reduce((s, l) => s + l.commissionAmount, 0);
  const estimatedCommission = totalLessonCommission;
  const estimatedSalary = store.baseSalary + estimatedCommission;

  const navItems: { key: Tab; label: string; icon: any }[] = [
    { key: 'schedule', label: '我的排课', icon: Calendar },
    { key: 'students', label: '我的学生', icon: Users },
    { key: 'lessons', label: '消课记录', icon: BookOpen },
    { key: 'salary', label: '预估工资', icon: DollarSign },
  ];

  const pendingCount = lessons.filter(l => l.status === 'pending' && l.teacherId === teacherId).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Music size={20} className="text-indigo-600" />
              <span className="font-bold text-sm text-slate-800">{teacherName}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${storeId === 'dongguan' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                <Building2 size={10} className="inline mr-0.5" />{store.name}
              </span>
            </div>
            <button onClick={logout} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
              <LogOut size={14} /> 退出
            </button>
          </div>
          {/* Tab导航 */}
          <div className="flex gap-1 -mb-px">
            {navItems.map(n => (
              <button key={n.key} onClick={() => setTab(n.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors
                  ${tab === n.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <n.icon size={14} />
                {n.label}
                {n.key === 'lessons' && pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* ========== 排课 Tab ========== */}
        {tab === 'schedule' && (
          <div>
            {/* 日期导航 */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }} className="p-2 hover:bg-slate-100 rounded-lg">
                <ChevronLeft size={18} />
              </button>
              <div className="flex gap-1">
                {weekDates.map(d => {
                  const isToday = d === today;
                  const dayNum = new Date(d).getDate();
                  const dayName = ['日', '一', '二', '三', '四', '五', '六'][new Date(d).getDay()];
                  return (
                    <button key={d} onClick={() => setCurrentDate(new Date(d))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <div>{dayName}</div>
                      <div className="text-sm font-bold">{dayNum}</div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }} className="p-2 hover:bg-slate-100 rounded-lg">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* 添加排课按钮 */}
            <button onClick={() => setShowAddSchedule(true)}
              className="w-full mb-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2">
              <Plus size={16} /> 添加排课
            </button>

            {/* 当天课程 */}
            <div className="space-y-2">
              {daySchedules.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar size={48} className="mx-auto mb-3 text-slate-200" />
                  <p className="text-sm">今天没有课程安排</p>
                </div>
              ) : (
                daySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => (
                  <div key={s.id} className={`bg-white rounded-xl p-4 border shadow-sm transition-all ${s.checkedIn ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{s.startTime}-{s.endTime}</span>
                          <span className="font-medium text-sm">{s.studentName}</span>
                          <span className="text-xs text-slate-400">{s.course}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <Clock size={12} />
                          <span>{s.room || '未指定教室'}</span>
                          {s.note && <span className="text-amber-500">📌 {s.note}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.checkedIn ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded"><CheckCircle size={12} /> 已签到</span>
                        ) : (
                          <button onClick={() => handleCheckIn(s.id)}
                            className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                            签到上课
                          </button>
                        )}
                        <button onClick={async () => {
                          if (!confirm('确定删除此排课？')) return;
                          try {
                            const colRef = collection(db, `schedules_${storeId}`);
                            await deleteDoc(doc(colRef, s.id));
                            setAlertMsg('排课已删除');
                          } catch {}
                        }} className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 添加排课弹窗 */}
            {showAddSchedule && (
              <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                  <h3 className="font-bold text-slate-800 mb-4">添加排课</h3>
                  <form onSubmit={handleAddSchedule} className="space-y-3">
                    <select className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" required
                      value={scheduleForm.studentId}
                      onChange={e => {
                        const stu = students.find(s => s.id === e.target.value);
                        setScheduleForm({ ...scheduleForm, studentId: e.target.value, studentName: stu?.name || '' });
                      }}>
                      <option value="">选择学生</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.name}（剩余正式{s.formalLessons}节）</option>
                      ))}
                    </select>
                    <input className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="课程" value={scheduleForm.course} required
                      onChange={e => setScheduleForm({ ...scheduleForm, course: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="time" className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" value={scheduleForm.startTime}
                        onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
                      <input type="time" className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" value={scheduleForm.endTime}
                        onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
                    </div>
                    <select className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                      value={scheduleForm.room} onChange={e => setScheduleForm({ ...scheduleForm, room: e.target.value })}>
                      <option value="">选择教室</option>
                      <option value="主声乐教室">🎤 主声乐教室</option>
                      <option value="副声乐教室">🎤 副声乐教室</option>
                      <option value="架子鼓教室">🥁 架子鼓教室</option>
                    </select>
                    <input className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="备注（可选）"
                      value={scheduleForm.note} onChange={e => setScheduleForm({ ...scheduleForm, note: e.target.value })} />
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setShowAddSchedule(false)} className="flex-1 py-2 bg-slate-100 rounded-lg text-sm">取消</button>
                      <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm">添加</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== 学生 Tab ========== */}
        {tab === 'students' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">{students.length} 个学生</span>
              <button onClick={() => setShowAddStudent(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium">
                <Plus size={14} /> 添加学生
              </button>
            </div>
            {students.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users size={48} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm">暂无学生，点击上方按钮添加</p>
              </div>
            ) : (
              students.map(stu => {
                const stuEnrollments = enrollments.filter(e => e.studentId === stu.id && e.status === 'active');
                return (
                  <div key={stu.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-slate-800">{stu.name}</h3>
                        <div className="flex gap-3 mt-1 text-xs text-slate-500">
                          <span>正式课剩余: <strong className="text-indigo-600">{stu.formalLessons}</strong> 节</span>
                          {stu.giftedLessons > 0 && <span>赠送剩余: <strong className="text-emerald-600">{stu.giftedLessons}</strong> 节</span>}
                        </div>
                        {stuEnrollments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {stuEnrollments.map(e => (
                              <div key={e.id} className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded inline-block mr-1">
                                {e.course} · 锁定{e.commissionRate * 100}%
                                {e.isUnlimited && <span className="ml-1 text-amber-500">[无限课时]</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {/* 正式课消课 */}
                        {stuEnrollments.map(e => (
                          <React.Fragment key={e.id}>
                            {e.formalLessons > 0 && (
                              <button onClick={() => setShowDeduct({ studentId: stu.id, enrollmentId: e.id, studentName: stu.name, course: e.course, type: 'formal' })}
                                className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100">
                                消正式课
                              </button>
                            )}
                            {e.giftedLessons > 0 && (
                              <button onClick={() => setShowDeduct({ studentId: stu.id, enrollmentId: e.id, studentName: stu.name, course: e.course, type: 'gifted' })}
                                className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-100">
                                <Gift size={10} className="inline" /> 赠送消课
                              </button>
                            )}
                            {e.isUnlimited && !e.unlimitedHalfApproved && (
                              <button onClick={async () => {
                                if (!db) return;
                                const colRef = collection(db, `enrollments_${storeId}`);
                                await updateDoc(doc(colRef, e.id), { halfRequested: true } as any);
                                setAlertMsg(`已提交「${e.course}」过半申请，待店长审核`);
                              }} className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded hover:bg-amber-100">
                                标记课程过半
                              </button>
                            )}
                          </React.Fragment>
                        ))}
                        <button onClick={() => {
                          setEnrollForm({ ...enrollForm, studentId: stu.id, studentName: stu.name });
                          setShowAddEnrollment(true);
                        }} className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100">
                          <Plus size={10} className="inline mr-0.5" />报名
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========== 消课记录 Tab ========== */}
        {tab === 'lessons' && (
          <div className="space-y-2">
            {lessons.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <BookOpen size={48} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm">暂无消课记录</p>
              </div>
            ) : (
              [...lessons].sort((a, b) => b.createdAt - a.createdAt).map(l => (
                <div key={l.id} className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{l.studentName}</span>
                      <span className="text-xs text-slate-400">{l.course}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${l.type === 'formal' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {l.type === 'formal' ? '正式' : '赠送'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{formatDateDisplay(l.date)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.commissionAmount > 0 && <span className="text-xs text-indigo-600">+{formatMoney(l.commissionAmount)}</span>}
                    {l.status === 'pending' && <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded">待审核</span>}
                    {l.status === 'approved' && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded"><CheckCircle size={10} className="inline" /> 已通过</span>}
                    {l.status === 'rejected' && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded"><XCircle size={10} className="inline" /> 已拒绝</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ========== 预估工资 Tab ========== */}
        {tab === 'salary' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-700">当前考核周期</h2>
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">{period.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs text-slate-500">周期营业额</div>
                  <div className="text-lg font-bold text-slate-800">{formatMoney(periodRevenue)}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs text-slate-500">当前提成档位</div>
                  <div className="text-lg font-bold text-indigo-600">{tier.label}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 mb-3">预估薪资</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">底薪</span>
                  <span className="font-medium">{formatMoney(store.baseSalary)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">课时提成（已审核/{periodLessons.length}节）</span>
                  <span className="font-medium text-indigo-600">{formatMoney(estimatedCommission)}</span>
                </div>
                <hr className="border-slate-100" />
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>预估应发</span>
                  <span className="text-lg text-indigo-700">{formatMoney(estimatedSalary)}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">* 最终以店长审核和15号结算为准</p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-700">温馨提示</p>
                  <p className="text-xs text-amber-600 mt-1">
                    当月营业额决定报名学生的提成锁率。消课记录需店长审核通过后才计入工资。
                    {store.baseSalary > 0 && ` 含底薪${formatMoney(store.baseSalary)}。`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 操作提示 Toast */}
      {alertMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] bg-green-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-bounce-in">
          {alertMsg}
        </div>
      )}
      {/* 消课确认弹窗 */}
      {showDeduct && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-slate-800 mb-2">确认消课</h3>
            <div className="space-y-2 mb-4 text-sm">
              <p>学生：{showDeduct.studentName}</p>
              <p>课程：{showDeduct.course}</p>
              <p>类型：{showDeduct.type === 'formal' ? '正式课时' : '赠送课时'}</p>
            </div>
            {showDeduct.type === 'formal' && (
              <div className="bg-indigo-50 p-3 rounded-xl mb-4">
                <p className="text-xs text-indigo-700">本次消课将产生课时费提成，待店长审核后计入工资</p>
              </div>
            )}
            {showDeduct.type === 'gifted' && (
              <div className="bg-emerald-50 p-3 rounded-xl mb-4">
                <p className="text-xs text-emerald-700">赠送课时消课不计入提成</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowDeduct(null)} className="flex-1 py-2 bg-slate-100 rounded-lg text-sm">取消</button>
              <button onClick={handleDeductLesson} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm">确认消课</button>
            </div>
          </div>
        </div>
      )}
      {/* 报名弹窗 */}
      {showAddEnrollment && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">新建报名</h3>
              <button onClick={() => setShowAddEnrollment(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleAddEnrollment} className="space-y-3">
              <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                学生：{enrollForm.studentName} · 老师：{teacherName}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="课程名称" required
                  value={enrollForm.course} onChange={e => setEnrollForm({ ...enrollForm, course: e.target.value })} />
                <input type="number" className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="学费实收" required
                  value={enrollForm.price} onChange={e => setEnrollForm({ ...enrollForm, price: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="正式课时" required
                  value={enrollForm.formalLessons} onChange={e => setEnrollForm({ ...enrollForm, formalLessons: e.target.value })} />
                <input type="number" className="px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="赠送课时"
                  value={enrollForm.giftedLessons} onChange={e => setEnrollForm({ ...enrollForm, giftedLessons: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={enrollForm.isUnlimited}
                  onChange={e => setEnrollForm({ ...enrollForm, isUnlimited: e.target.checked })} />
                无限课时（钢琴等）
              </label>
              {enrollForm.price && Number(enrollForm.price) > 0 && (
                <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700">
                  当前周期营业额+本次 → 提成档位 {(() => {
                    const rev = enrollments.filter(en => en.teacherId === teacherId && en.enrollmentDate >= period.start && en.enrollmentDate <= period.end).reduce((s, e) => s + e.price, 0) + Number(enrollForm.price);
                    return getTierByRevenue(rev).label;
                  })()}
                  {enrollForm.formalLessons && Number(enrollForm.formalLessons) > 0 && (() => {
                    const p = Number(enrollForm.price), fl = Number(enrollForm.formalLessons);
                    const rate = getTierByRevenue(
                      enrollments.filter(en => en.teacherId === teacherId && en.enrollmentDate >= period.start && en.enrollmentDate <= period.end).reduce((s, e) => s + e.price, 0) + p
                    ).rate;
                    return <> · 每节课时费 {formatMoney((p * rate) / fl)}</>;
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

      {/* 添加学生弹窗 */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-slate-800 mb-4">添加学生</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <input className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="学生姓名" required
                value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} />
              <input className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm" placeholder="手机号（选填）"
                value={studentForm.phone} onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })} />
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
    </div>
  );
}
