// ===================== 店长数据看板：周期营业额与工资（只读计算） =====================
//
// 与老师端「预估工资」、店长端「薪资结算」同一套规则，按考核周期拆开，避免把多个月
// 的底薪只算一次，也避免 15 号被相邻两个周期各算一遍。
//
// 考核周期：每月 15 日（含）至次月 15 日（不含）。15 日当天起算新周期，
// 与 getCurrentPeriod / getPeriodForDate、报名记录上的 commissionPeriod 一致。
//
// 某一周期、某一位老师的应发：
//   底薪 + 课时提成 + 过半提成 − 社保（员工自付）
// 全职的底薪、社保取门店配置，每个考核周期计一次。
// 兼职（employmentType === 'parttime'）无论门店，底薪和社保都是 0。
// 营业额仍按老师个人累计，并计入该报名所属门店的营业额合计；兼职不并入其他老师的档位。
// 课时提成只统计已审核的正式消课，金额按「报名所属周期」的营业额档位实时重算
// （不使用消课记录上可能过期的 commissionAmount）：
//   round(学费 price × 档位比例 / 正式课时, 2)
// 档位：营业额 [0, 40000) → 20%，[40000, 50000) → 30%，[50000, ∞) → 40%。
// 兼职老师若 employmentType 为 parttime 且 fixedCommissionRate 有效，则锁定该比例，
// 不随周期营业额改档；过半提成同样按该比例重算。
// 全职的过半提成仍用已审核记录上的金额（与老师端一致）。赠送课、待审核、已拒绝不计。

import type { Enrollment, LessonRecord, StoreId, Teacher } from '../types';
import { STORES, getPeriodForDate, getStore } from '../config';
import { calcLessonFee, calcUnlimitedHalfCommission, fixedCommissionRateOf, getCurrentPeriodInfo, resolveTeacherCommission } from './commission';

export type StoreFilter = 'all' | StoreId;

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** 全职用门店底薪和社保。兼职固定为 0，不跟车陂的 ¥2000 / ¥570.84。 */
export function teacherBasePay(
  teacher: { employmentType?: string | null } | null | undefined,
  store: { baseSalary?: number; socialInsurance?: number } | null | undefined,
): { baseSalary: number; socialInsurance: number } {
  if (teacher?.employmentType === 'parttime') {
    return { baseSalary: 0, socialInsurance: 0 };
  }
  return {
    baseSalary: Number(store?.baseSalary) || 0,
    socialInsurance: Number(store?.socialInsurance) || 0,
  };
}

export function periodLabel(period: string): string {
  const [ys, ms] = period.split('-');
  const year = Number(ys);
  const month = Number(ms);
  if (!year || !month) return period;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endYear = nextYear === year ? '' : `${nextYear}年`;
  return `${year}年${month}月15日 ~ ${endYear}${nextMonth}月15日`;
}

export function periodShortLabel(period: string): string {
  const month = Number(period.split('-')[1]);
  return month ? `${month}月` : period;
}

function nextPeriod(period: string): string {
  let [year, month] = period.split('-').map(Number);
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 含首尾。起止写反时自动交换。非法值返回空数组。 */
export function enumeratePeriods(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) return [];
  let start = from;
  let end = to;
  if (start > end) [start, end] = [end, start];
  const out: string[] = [];
  let cursor = start;
  for (let i = 0; i < 240; i++) {
    out.push(cursor);
    if (cursor === end) break;
    cursor = nextPeriod(cursor);
  }
  return out;
}

function periodOfEnrollment(enrollment: Enrollment): string | null {
  if (enrollment.commissionPeriod && /^\d{4}-\d{2}$/.test(enrollment.commissionPeriod)) {
    return enrollment.commissionPeriod;
  }
  if (!enrollment.enrollmentDate) return null;
  return getPeriodForDate(enrollment.enrollmentDate);
}

/** 下拉里的连续周期：最早一条报名/消课到当前考核周期（或数据里更晚的月份）。 */
export function listPeriodOptions(enrollments: Enrollment[], lessons: LessonRecord[]): string[] {
  const keys = new Set<string>();
  keys.add(getCurrentPeriodInfo().period);
  for (const enrollment of enrollments) {
    const period = periodOfEnrollment(enrollment);
    if (period) keys.add(period);
  }
  for (const lesson of lessons) {
    if (!lesson.date) continue;
    const period = getPeriodForDate(lesson.date);
    if (/^\d{4}-\d{2}$/.test(period)) keys.add(period);
  }
  const sorted = [...keys].filter(period => /^\d{4}-\d{2}$/.test(period)).sort();
  if (sorted.length === 0) return [getCurrentPeriodInfo().period];
  return enumeratePeriods(sorted[0], sorted[sorted.length - 1]);
}

export interface TeacherPeriodRow {
  teacherId: string;
  teacherName: string;
  storeId: string;
  storeName: string;
  period: string;
  periodLabel: string;
  revenue: number;
  tierLabel: string;
  tierRate: number;
  /** 兼职固定提成；全职为 null */
  partTimeRate: number | null;
  formalLessons: number;
  lessonCommission: number;
  halfCommission: number;
  baseSalary: number;
  socialInsurance: number;
  payable: number;
}

export interface PeriodSummary {
  period: string;
  periodLabel: string;
  revenue: number;
  lessonCommission: number;
  halfCommission: number;
  baseSalary: number;
  socialInsurance: number;
  payable: number;
}

export interface TeacherTotal {
  teacherId: string;
  teacherName: string;
  storeId: string;
  storeName: string;
  partTimeRate: number | null;
  revenue: number;
  lessonCommission: number;
  halfCommission: number;
  baseSalary: number;
  socialInsurance: number;
  payable: number;
}

export interface PayrollReport {
  periods: PeriodSummary[];
  teachers: TeacherTotal[];
  details: TeacherPeriodRow[];
  totalRevenue: number;
  totalPayable: number;
  totalLesson: number;
  totalHalf: number;
  totalBase: number;
  totalInsurance: number;
  /** 已审核正式课找不到报名或正式课时为 0，无法按公式计薪 */
  skippedFormalLessons: number;
  /** 已审核消课的老师已不在老师列表中 */
  orphanApprovedLessons: number;
}

function lessonPay(
  lesson: LessonRecord,
  enrollmentById: Map<string, Enrollment>,
  revenueByTeacherPeriod: Map<string, number>,
  teacherById: Map<string, Teacher>,
): { lesson: number; half: number; formal: number; skipped: boolean } {
  const teacher = teacherById.get(lesson.teacherId);
  const enrollment = enrollmentById.get(lesson.enrollmentId);
  if (lesson.type === 'half') {
    const fixedRate = fixedCommissionRateOf(teacher);
    const half = fixedRate != null && enrollment
      ? calcUnlimitedHalfCommission(Number(enrollment.price) || 0, fixedRate)
      : Number(lesson.commissionAmount) || 0;
    return { lesson: 0, half, formal: 0, skipped: false };
  }
  if (lesson.type !== 'formal') {
    return { lesson: 0, half: 0, formal: 0, skipped: false };
  }
  const formalLessons = Number(enrollment?.formalLessons) || 0;
  if (!enrollment || formalLessons <= 0) {
    return { lesson: 0, half: 0, formal: 1, skipped: true };
  }
  const period = periodOfEnrollment(enrollment);
  const revenue = period ? revenueByTeacherPeriod.get(`${lesson.teacherId}::${period}`) || 0 : 0;
  const quote = resolveTeacherCommission(teacher, revenue);
  return {
    lesson: calcLessonFee(Number(enrollment.price) || 0, quote.rate, formalLessons),
    half: 0,
    formal: 1,
    skipped: false,
  };
}

export function buildPayrollReport(input: {
  teachers: Teacher[];
  enrollments: Enrollment[];
  lessons: LessonRecord[];
  storeId: string;
  fromPeriod: string;
  toPeriod: string;
}): PayrollReport {
  const periods = enumeratePeriods(input.fromPeriod, input.toPeriod);
  const periodSet = new Set(periods);
  const storeId = input.storeId;
  const inStore = <T extends { storeId?: string }>(row: T) => storeId === 'all' || row.storeId === storeId;

  const teachers = input.teachers.filter(inStore);
  const teacherIds = new Set(teachers.map(teacher => teacher.id));
  const enrollments = input.enrollments.filter(inStore);
  const lessons = input.lessons.filter(inStore);

  // 档位按「报名所属周期」的全部营业额计算，即使用户只查看其中几个月。
  const revenueByTeacherPeriod = new Map<string, number>();
  const revenueByPeriod = new Map<string, number>();
  for (const enrollment of enrollments) {
    const period = periodOfEnrollment(enrollment);
    if (!period) continue;
    const price = Number(enrollment.price) || 0;
    if (enrollment.teacherId) {
      const key = `${enrollment.teacherId}::${period}`;
      revenueByTeacherPeriod.set(key, (revenueByTeacherPeriod.get(key) || 0) + price);
    }
    if (periodSet.has(period)) {
      revenueByPeriod.set(period, (revenueByPeriod.get(period) || 0) + price);
    }
  }

  const enrollmentById = new Map(enrollments.map(enrollment => [enrollment.id, enrollment]));
  const teacherById = new Map(teachers.map(teacher => [teacher.id, teacher]));
  const lessonsByTeacherPeriod = new Map<string, LessonRecord[]>();
  let orphanApprovedLessons = 0;
  for (const lesson of lessons) {
    if (lesson.status !== 'approved' || !lesson.date) continue;
    const period = getPeriodForDate(lesson.date);
    if (!periodSet.has(period)) continue;
    if (!teacherIds.has(lesson.teacherId)) {
      orphanApprovedLessons += 1;
      continue;
    }
    const key = `${lesson.teacherId}::${period}`;
    const bucket = lessonsByTeacherPeriod.get(key);
    if (bucket) bucket.push(lesson);
    else lessonsByTeacherPeriod.set(key, [lesson]);
  }

  const details: TeacherPeriodRow[] = [];
  let skippedFormalLessons = 0;

  for (const period of periods) {
    for (const teacher of teachers) {
      const store = getStore(teacher.storeId);
      const revenue = roundMoney(revenueByTeacherPeriod.get(`${teacher.id}::${period}`) || 0);
      const quote = resolveTeacherCommission(teacher, revenue);
      const partTimeRate = fixedCommissionRateOf(teacher);
      const bucket = lessonsByTeacherPeriod.get(`${teacher.id}::${period}`) || [];
      let lessonCommission = 0;
      let halfCommission = 0;
      let formalLessons = 0;
      for (const lesson of bucket) {
        const pay = lessonPay(lesson, enrollmentById, revenueByTeacherPeriod, teacherById);
        lessonCommission += pay.lesson;
        halfCommission += pay.half;
        formalLessons += pay.formal;
        if (pay.skipped) skippedFormalLessons += 1;
      }
      lessonCommission = roundMoney(lessonCommission);
      halfCommission = roundMoney(halfCommission);
      const { baseSalary, socialInsurance } = teacherBasePay(teacher, store);
      const payable = roundMoney(baseSalary + lessonCommission + halfCommission - socialInsurance);
      details.push({
        teacherId: teacher.id,
        teacherName: teacher.name,
        storeId: teacher.storeId,
        storeName: store.name,
        period,
        periodLabel: periodLabel(period),
        revenue,
        tierLabel: quote.fixed ? `兼职${quote.label}` : (revenue > 0 ? quote.label : '—'),
        tierRate: quote.fixed ? quote.rate : (revenue > 0 ? quote.rate : 0),
        partTimeRate,
        formalLessons,
        lessonCommission,
        halfCommission,
        baseSalary,
        socialInsurance,
        payable,
      });
    }
  }

  const periodSummaries: PeriodSummary[] = periods.map(period => {
    const rows = details.filter(row => row.period === period);
    const revenue = roundMoney(revenueByPeriod.get(period) || 0);
    return {
      period,
      periodLabel: periodLabel(period),
      revenue,
      lessonCommission: roundMoney(rows.reduce((sum, row) => sum + row.lessonCommission, 0)),
      halfCommission: roundMoney(rows.reduce((sum, row) => sum + row.halfCommission, 0)),
      baseSalary: roundMoney(rows.reduce((sum, row) => sum + row.baseSalary, 0)),
      socialInsurance: roundMoney(rows.reduce((sum, row) => sum + row.socialInsurance, 0)),
      payable: roundMoney(rows.reduce((sum, row) => sum + row.payable, 0)),
    };
  });

  const teacherTotals: TeacherTotal[] = teachers.map(teacher => {
    const rows = details.filter(row => row.teacherId === teacher.id);
    const store = getStore(teacher.storeId);
    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      storeId: teacher.storeId,
      storeName: store.name,
      partTimeRate: fixedCommissionRateOf(teacher),
      revenue: roundMoney(rows.reduce((sum, row) => sum + row.revenue, 0)),
      lessonCommission: roundMoney(rows.reduce((sum, row) => sum + row.lessonCommission, 0)),
      halfCommission: roundMoney(rows.reduce((sum, row) => sum + row.halfCommission, 0)),
      baseSalary: roundMoney(rows.reduce((sum, row) => sum + row.baseSalary, 0)),
      socialInsurance: roundMoney(rows.reduce((sum, row) => sum + row.socialInsurance, 0)),
      payable: roundMoney(rows.reduce((sum, row) => sum + row.payable, 0)),
    };
  }).sort((a, b) => b.payable - a.payable || a.teacherName.localeCompare(b.teacherName, 'zh-CN'));

  const total = (pick: (row: PeriodSummary) => number) => roundMoney(periodSummaries.reduce((sum, row) => sum + pick(row), 0));

  return {
    periods: periodSummaries,
    teachers: teacherTotals,
    details,
    totalRevenue: total(row => row.revenue),
    totalPayable: total(row => row.payable),
    totalLesson: total(row => row.lessonCommission),
    totalHalf: total(row => row.halfCommission),
    totalBase: total(row => row.baseSalary),
    totalInsurance: total(row => row.socialInsurance),
    skippedFormalLessons,
    orphanApprovedLessons,
  };
}

export const STORE_FILTERS: { id: StoreFilter; label: string }[] = [
  { id: 'all', label: '全部门店' },
  ...STORES.map(store => ({ id: store.id, label: store.name })),
];
