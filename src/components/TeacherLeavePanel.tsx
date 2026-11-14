import React, { useState } from 'react';
import { collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Umbrella, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { shortId, formatDate } from '../utils/helpers';
import {
  SELF_LEAVE_QUOTA,
  calendarMonth,
  currentCalendarMonth,
  dayOccupancy,
  extraLeaveBlockReason,
  formatDayLabel,
  formatRangeLabel,
  leaveCollection,
  leaveStatusLabel,
  monthGrid,
  monthTitle,
  selfLeaveBlockReason,
  selfLeavesInMonth,
  shiftMonth,
} from '../utils/leave';
import type { LeaveRecord, StoreId } from '../types';

interface TeacherLeavePanelProps {
  teacherId: string;
  teacherName: string;
  storeId: StoreId;
  leaves: LeaveRecord[];
  onNotify: (message: string) => void;
}

export default function TeacherLeavePanel({ teacherId, teacherName, storeId, leaves, onNotify }: TeacherLeavePanelProps) {
  const [month, setMonth] = useState(currentCalendarMonth);
  const [selected, setSelected] = useState(formatDate(new Date()));
  const [extraStart, setExtraStart] = useState('');
  const [extraEnd, setExtraEnd] = useState('');
  const [reason, setReason] = useState('');
  const [quotaError, setQuotaError] = useState('');
  const [extraError, setExtraError] = useState('');
  const [busy, setBusy] = useState<'self' | 'cancel' | 'extra' | 'withdraw' | null>(null);

  const usedDays = selfLeavesInMonth(leaves, teacherId, month);
  const used = usedDays.length;
  const remaining = Math.max(0, SELF_LEAVE_QUOTA - used);
  const selectedInMonth = selected.startsWith(month);
  const occupancy = selectedInMonth ? dayOccupancy(leaves, teacherId, selected) : null;
  const selfBlock = selectedInMonth ? selfLeaveBlockReason(leaves, teacherId, selected) : '请在当前月份里选择一天';
  const extras = leaves
    .filter(l => l.kind === 'extra' && l.teacherId === teacherId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const goMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    const today = formatDate(new Date());
    setSelected(today.startsWith(next) ? today : `${next}-01`);
    setQuotaError('');
  };

  const addSelfLeave = async () => {
    const block = selfLeaveBlockReason(leaves, teacherId, selected);
    if (block) {
      setQuotaError(block);
      return;
    }
    setBusy('self');
    setQuotaError('');
    try {
      const id = shortId();
      const record: LeaveRecord = {
        id,
        teacherId,
        teacherName,
        storeId,
        kind: 'self',
        date: selected,
        month: calendarMonth(selected),
        status: 'active',
        createdAt: Date.now(),
      };
      await setDoc(doc(collection(db, leaveCollection(storeId)), id), record);
      onNotify(`${formatDayLabel(selected)}已记为自主休假，立即生效`);
    } catch (e: any) {
      setQuotaError('保存失败，请稍后重试' + (e?.message ? `（${e.message}）` : ''));
    } finally {
      setBusy(null);
    }
  };

  const cancelSelfLeave = async (record: LeaveRecord) => {
    setBusy('cancel');
    setQuotaError('');
    try {
      await deleteDoc(doc(collection(db, leaveCollection(record.storeId)), record.id));
      onNotify(`已取消 ${formatDayLabel(record.date)} 的自主休假`);
    } catch (e: any) {
      setQuotaError('取消失败，请稍后重试' + (e?.message ? `（${e.message}）` : ''));
    } finally {
      setBusy(null);
    }
  };

  const submitExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    const block = extraLeaveBlockReason(leaves, teacherId, extraStart, extraEnd, reason);
    if (block) {
      setExtraError(block);
      return;
    }
    setBusy('extra');
    setExtraError('');
    try {
      const id = shortId();
      const record: LeaveRecord = {
        id,
        teacherId,
        teacherName,
        storeId,
        kind: 'extra',
        date: extraStart,
        endDate: extraEnd,
        month: calendarMonth(extraStart),
        reason: reason.trim(),
        status: 'pending',
        createdAt: Date.now(),
      };
      await setDoc(doc(collection(db, leaveCollection(storeId)), id), record);
      setReason('');
      setExtraStart('');
      setExtraEnd('');
      onNotify('额外休假已提交，状态为待审批');
    } catch (err: any) {
      setExtraError('提交失败，请稍后重试' + (err?.message ? `（${err.message}）` : ''));
    } finally {
      setBusy(null);
    }
  };

  const withdrawExtra = async (record: LeaveRecord) => {
    setBusy('withdraw');
    setExtraError('');
    try {
      await deleteDoc(doc(collection(db, leaveCollection(record.storeId)), record.id));
      onNotify('已撤回这条休假申请');
    } catch (e: any) {
      setExtraError('撤回失败，请稍后重试' + (e?.message ? `（${e.message}）` : ''));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <section id="leave-quota" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <Umbrella size={16} className="text-emerald-600" /> 自主休假
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              按自然月计算，每月可自己选 {SELF_LEAVE_QUOTA} 天。选中后立即生效，不用询问店长。
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400">本月剩余</div>
            <div className="text-2xl font-bold text-emerald-600 leading-none mt-0.5">{remaining}<span className="text-sm font-medium text-slate-400">/{SELF_LEAVE_QUOTA}</span></div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(used / SELF_LEAVE_QUOTA) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-600 whitespace-nowrap">已用 {used} 天，剩余 {remaining} 天</span>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {Array.from({ length: SELF_LEAVE_QUOTA }, (_, i) => (
            <span key={i} className={`h-2.5 w-8 rounded-full ${i < used ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={() => goMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="上个月">
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm font-bold text-slate-800">{monthTitle(month)}</div>
          <button type="button" onClick={() => goMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="下个月">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
          {['一', '二', '三', '四', '五', '六', '日'].map(label => <div key={label}>{label}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {monthGrid(month).map((day, index) => {
            if (!day) return <div key={`empty-${index}`} />;
            const kind = dayOccupancy(leaves, teacherId, day);
            const isSelected = day === selected;
            const tone = kind === 'self'
              ? 'bg-emerald-600 text-white'
              : kind === 'approved'
                ? 'bg-sky-600 text-white'
                : kind === 'pending'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100';
            return (
              <button
                key={day}
                type="button"
                onClick={() => { setSelected(day); setQuotaError(''); }}
                aria-pressed={isSelected}
                aria-label={formatDayLabel(day)}
                className={`h-10 rounded-lg text-xs font-medium relative ${tone} ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              >
                {Number(day.slice(8))}
                {kind === 'self' ? <span className="block text-[9px] leading-none">休</span> : null}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />自主休假</span>
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-sky-600" />已批准</span>
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-amber-200" />待审批</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600">{selectedInMonth ? formatDayLabel(selected) : '请选择日期'}</span>
          {occupancy === 'self' ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                const record = usedDays.find(l => l.date === selected);
                if (record) void cancelSelfLeave(record);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {busy === 'cancel' ? <Loader2 size={12} className="inline animate-spin" /> : null} 取消这天休息
            </button>
          ) : (
            <button
              type="button"
              disabled={busy !== null || selfBlock !== null}
              onClick={() => { void addSelfLeave(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              {busy === 'self' ? <Loader2 size={12} className="inline animate-spin" /> : null} 设为自主休假
            </button>
          )}
        </div>
        {selfBlock && occupancy !== 'self' ? <p className="mt-2 text-xs text-amber-700">{selfBlock}</p> : null}
        {quotaError ? <p className="mt-2 text-xs text-red-600">{quotaError}</p> : null}

        <div className="mt-4">
          <h3 className="text-xs font-medium text-slate-500 mb-2">本月已选休息日</h3>
          {usedDays.length === 0 ? (
            <p className="text-xs text-slate-400">还没有选择。点日期后按「设为自主休假」。</p>
          ) : (
            <ul className="space-y-2">
              {usedDays.map(day => (
                <li key={day.id} className="flex items-center justify-between bg-emerald-50 rounded-xl px-3 py-2">
                  <span className="text-sm text-emerald-800">{formatDayLabel(day.date)}</span>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => { void cancelSelfLeave(day); }}
                    className="text-xs text-slate-500 hover:text-red-600 disabled:opacity-50"
                  >
                    取消
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="leave-extra-form" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="font-bold text-sm text-slate-800">额外休假申请</h2>
        <p className="text-xs text-slate-500 mt-1">
          节假日或其他超出 {SELF_LEAVE_QUOTA} 天的休假，需要向店长申请。提交后状态为待审批，不占用每月 {SELF_LEAVE_QUOTA} 天自主额度。
        </p>
        <form onSubmit={submitExtra} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs text-slate-600">
              开始日期
              <input
                type="date"
                required
                value={extraStart}
                onChange={e => { setExtraStart(e.target.value); setExtraError(''); }}
                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block text-xs text-slate-600">
              结束日期
              <input
                type="date"
                required
                value={extraEnd}
                onChange={e => { setExtraEnd(e.target.value); setExtraError(''); }}
                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>
          <label className="block text-xs text-slate-600">
            事由
            <textarea
              required
              rows={3}
              value={reason}
              onChange={e => { setReason(e.target.value); setExtraError(''); }}
              placeholder="例如：国庆节回老家"
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy !== null}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === 'extra' ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}
            提交申请
          </button>
          {extraError ? <p className="text-xs text-red-600">{extraError}</p> : null}
        </form>

        <div className="mt-5">
          <h3 className="text-xs font-medium text-slate-500 mb-2">我的申请</h3>
          {extras.length === 0 ? (
            <p className="text-xs text-slate-400">还没有额外休假申请。</p>
          ) : (
            <ul className="space-y-2">
              {extras.map(item => (
                <li key={item.id} className="border border-slate-200 rounded-xl px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{formatRangeLabel(item.date, item.endDate)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.reason}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${
                      item.status === 'pending' ? 'bg-amber-50 text-amber-700'
                        : item.status === 'approved' ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-600'
                    }`}>
                      {leaveStatusLabel(item.status)}
                    </span>
                  </div>
                  {item.status === 'pending' ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => { void withdrawExtra(item); }}
                      className="mt-2 text-xs text-slate-500 hover:text-red-600 disabled:opacity-50"
                    >
                      撤回
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
