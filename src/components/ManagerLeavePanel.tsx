import React, { useState } from 'react';
import { collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { CheckCircle, ChevronLeft, ChevronRight, Loader2, XCircle } from 'lucide-react';
import { db } from '../firebase';
import { getStore } from '../config';
import {
  SELF_LEAVE_QUOTA,
  currentCalendarMonth,
  extraOverlapsMonth,
  formatDayLabel,
  formatRangeLabel,
  leaveCollection,
  leaveEnabledFor,
  leaveStatusLabel,
  monthTitle,
  selfLeavesInMonth,
  shiftMonth,
  storeMatchesFilter,
} from '../utils/leave';
import type { LeaveRecord, Teacher } from '../types';

interface ManagerLeavePanelProps {
  teachers: Teacher[];
  leaves: LeaveRecord[];
  storeFilter: string;
  onNotify: (message: string) => void;
}

export default function ManagerLeavePanel({ teachers, leaves, storeFilter, onNotify }: ManagerLeavePanelProps) {
  const [month, setMonth] = useState(currentCalendarMonth);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const visible = leaves.filter(l => storeMatchesFilter(l.storeId, storeFilter));
  const pending = visible
    .filter(l => l.kind === 'extra' && l.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt);
  const decided = visible
    .filter(l => l.kind === 'extra' && (l.status === 'approved' || l.status === 'rejected'))
    .sort((a, b) => (b.reviewedAt || b.createdAt) - (a.reviewedAt || a.createdAt))
    .slice(0, 8);
  const roster = teachers.filter(t => leaveEnabledFor(t) && storeMatchesFilter(t.storeId, storeFilter));

  const teacherName = (id: string, fallback: string) => teachers.find(t => t.id === id)?.name || fallback;

  const review = async (record: LeaveRecord, status: 'approved' | 'rejected') => {
    setBusyId(record.id);
    setError('');
    try {
      await updateDoc(doc(collection(db, leaveCollection(record.storeId)), record.id), {
        status,
        reviewedAt: Date.now(),
        reviewedBy: 'manager',
      });
      onNotify(status === 'approved'
        ? `已批准 ${teacherName(record.teacherId, record.teacherName)} 的休假`
        : `已驳回 ${teacherName(record.teacherId, record.teacherName)} 的休假`);
    } catch (e: any) {
      setError('操作失败，请稍后重试' + (e?.message ? `（${e.message}）` : ''));
    } finally {
      setBusyId(null);
    }
  };

  const removeSelf = async (record: LeaveRecord) => {
    setBusyId(record.id);
    setError('');
    try {
      await deleteDoc(doc(collection(db, leaveCollection(record.storeId)), record.id));
      onNotify(`已取消 ${teacherName(record.teacherId, record.teacherName)} ${formatDayLabel(record.date)} 的自主休假`);
    } catch (e: any) {
      setError('取消失败，请稍后重试' + (e?.message ? `（${e.message}）` : ''));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <section id="leave-approvals" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-sm text-slate-800">待审批的额外休假</h2>
          {pending.length > 0 ? (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{pending.length} 条待审批</span>
          ) : (
            <span className="text-xs text-slate-400">没有待处理的申请</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">每月 4 天自主休假不用审批。这里只处理节假日等额外申请。</p>
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        {pending.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">暂无待审批的休假申请</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pending.map(item => (
              <li key={item.id} className="border border-amber-200 bg-amber-50/40 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-slate-800">{teacherName(item.teacherId, item.teacherName)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{getStore(item.storeId).name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">待审批</span>
                    </div>
                    <div className="text-sm text-slate-700 mt-1">{formatRangeLabel(item.date, item.endDate)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">事由：{item.reason || '未填写'}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => { void review(item, 'approved'); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {busyId === item.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={13} />}
                      批准
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => { void review(item, 'rejected'); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle size={13} /> 驳回
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-800">本月已生效休假</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="p-1.5 hover:bg-slate-100 rounded-lg" aria-label="上个月">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-slate-700 w-24 text-center">{monthTitle(month)}</span>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg" aria-label="下个月">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">包含老师自己选定的休息日，以及已经批准的额外休假。不影响工资。</p>
        {roster.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">当前门店没有开通休假的老师。请切换到广州车陂店查看。</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {roster.map(teacher => {
              const selfDays = selfLeavesInMonth(visible, teacher.id, month);
              const approved = visible.filter(l =>
                l.teacherId === teacher.id && l.kind === 'extra' && l.status === 'approved' && extraOverlapsMonth(l, month),
              );
              return (
                <li key={teacher.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-slate-800">{teacher.name}</span>
                    <span className="text-xs text-slate-500">自主 {selfDays.length}/{SELF_LEAVE_QUOTA} 天</span>
                  </div>
                  {selfDays.length === 0 && approved.length === 0 ? (
                    <p className="text-xs text-slate-400 mt-2">这个月还没有休假。</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {selfDays.map(day => (
                        <div key={day.id} className="flex items-center justify-between text-xs">
                          <span className="text-emerald-700">{formatDayLabel(day.date)} · 自主休假</span>
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => { void removeSelf(day); }}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                          >
                            取消
                          </button>
                        </div>
                      ))}
                      {approved.map(item => (
                        <div key={item.id} className="text-xs text-sky-700">
                          {formatRangeLabel(item.date, item.endDate)} · 已批准{item.reason ? ` · ${item.reason}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-sm text-slate-800 mb-3">最近处理</h2>
          <ul className="space-y-2">
            {decided.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600">
                  {teacherName(item.teacherId, item.teacherName)} · {formatRangeLabel(item.date, item.endDate)}
                  {item.reason ? ` · ${item.reason}` : ''}
                </span>
                <span className={item.status === 'approved' ? 'text-green-600' : 'text-red-500'}>{leaveStatusLabel(item.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
