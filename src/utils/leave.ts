// 休假额度按自然月计算（每月 1 日到月末），不使用 15 日到次月 15 日的考核周期。
// 休假不计入工资、提成或业绩。

import type { LeaveRecord, StoreId } from '../types';
import { formatDate } from './helpers';

export const SELF_LEAVE_QUOTA = 4;
export const MAX_EXTRA_LEAVE_DAYS = 31;

/** 叶老师。车陂店老师都会开通；这个 id 保证她本人一定能看到休假。 */
export const LEAVE_TEACHER_ID = 'mp9tg4z007w6t';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function leaveCollection(storeId: string): string {
  return `leaves_${storeId}`;
}

export function leaveEnabledFor(teacher: { id?: string; storeId?: string } | null | undefined): boolean {
  if (!teacher) return false;
  if (teacher.id === LEAVE_TEACHER_ID) return true;
  return teacher.storeId === 'chebei';
}

export function calendarMonth(dateStr: string): string {
  return (dateStr || '').slice(0, 7);
}

export function currentCalendarMonth(now = new Date()): string {
  return formatDate(now).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return formatDate(d).slice(0, 7);
}

export function monthTitle(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

export function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function formatRangeLabel(start: string, end?: string): string {
  if (!end || end === start) return formatDayLabel(start);
  const [ys, ms, ds] = start.split('-');
  const [ye, me, de] = end.split('-');
  if (ys === ye && ms === me) return `${ys}年${Number(ms)}月${Number(ds)}日–${Number(de)}日`;
  if (ys === ye) return `${ys}年${Number(ms)}月${Number(ds)}日–${Number(me)}月${Number(de)}日`;
  return `${formatDayLabel(start)}–${formatDayLabel(end)}`;
}

export function leaveStatusLabel(status: LeaveRecord['status']): string {
  if (status === 'pending') return '待审批';
  if (status === 'approved') return '已批准';
  if (status === 'rejected') return '已驳回';
  return '已生效';
}

/** 周一开头的月历格子，空位为 null。 */
export function monthGrid(month: string): (string | null)[] {
  if (!MONTH_RE.test(month)) return [];
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

export function expandDateRange(start: string, end: string): { days: string[] } | { error: string } {
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return { error: '请选择开始和结束日期' };
  if (end < start) return { error: '结束日期不能早于开始日期' };
  const [ys, ms, ds] = start.split('-').map(Number);
  const cur = new Date(ys, ms - 1, ds);
  const days: string[] = [];
  while (days.length <= MAX_EXTRA_LEAVE_DAYS) {
    const key = formatDate(cur);
    days.push(key);
    if (key >= end) return { days };
    cur.setDate(cur.getDate() + 1);
  }
  return { error: `一次最多申请 ${MAX_EXTRA_LEAVE_DAYS} 天，请缩短日期范围` };
}

export function selfLeavesInMonth(leaves: LeaveRecord[], teacherId: string, month: string): LeaveRecord[] {
  return leaves
    .filter(l => l.kind === 'self' && l.teacherId === teacherId && l.month === month && l.status === 'active')
    .sort((a, b) => a.date.localeCompare(b.date));
}

function rangeCovers(leave: LeaveRecord, date: string): boolean {
  const end = leave.endDate || leave.date;
  return date >= leave.date && date <= end;
}

export function dayOccupancy(leaves: LeaveRecord[], teacherId: string, date: string): 'self' | 'approved' | 'pending' | null {
  const mine = leaves.filter(l => l.teacherId === teacherId);
  if (mine.some(l => l.kind === 'self' && l.status === 'active' && l.date === date)) return 'self';
  if (mine.some(l => l.kind === 'extra' && l.status === 'approved' && rangeCovers(l, date))) return 'approved';
  if (mine.some(l => l.kind === 'extra' && l.status === 'pending' && rangeCovers(l, date))) return 'pending';
  return null;
}

export function isConfirmedLeaveDay(leaves: LeaveRecord[], teacherId: string, date: string): boolean {
  const kind = dayOccupancy(leaves, teacherId, date);
  return kind === 'self' || kind === 'approved';
}

export function selfLeaveBlockReason(leaves: LeaveRecord[], teacherId: string, date: string): string | null {
  if (!DATE_RE.test(date)) return '请选择日期';
  const occupancy = dayOccupancy(leaves, teacherId, date);
  if (occupancy === 'self') return '这一天已经是自主休假';
  if (occupancy === 'approved') return '这一天已有批准的休假，不用重复选择';
  if (occupancy === 'pending') return '这一天已有待审批的申请';
  const used = selfLeavesInMonth(leaves, teacherId, calendarMonth(date)).length;
  if (used >= SELF_LEAVE_QUOTA) {
    return `本月自主休假已用完 ${SELF_LEAVE_QUOTA} 天。节假日或其他额外休假请在下方提交申请，等店长审批。`;
  }
  return null;
}

export function extraLeaveBlockReason(
  leaves: LeaveRecord[],
  teacherId: string,
  start: string,
  end: string,
  reason: string,
): string | null {
  if (!reason.trim()) return '请填写休假事由';
  const expanded = expandDateRange(start, end);
  if ('error' in expanded) return expanded.error;
  for (const day of expanded.days) {
    const occupancy = dayOccupancy(leaves, teacherId, day);
    if (occupancy === 'self') return `${formatDayLabel(day)}已是自主休假，无需再申请`;
    if (occupancy === 'approved' || occupancy === 'pending') return `${formatDayLabel(day)}已有休假申请`;
  }
  return null;
}

export function extraOverlapsMonth(leave: LeaveRecord, month: string): boolean {
  if (leave.kind !== 'extra') return false;
  const end = leave.endDate || leave.date;
  return calendarMonth(leave.date) <= month && month <= calendarMonth(end);
}

export function storeMatchesFilter(storeId: StoreId | string, storeFilter: string): boolean {
  return storeFilter === 'all' || storeId === storeFilter;
}
