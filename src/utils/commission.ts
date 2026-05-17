// ===================== 提成计算引擎（动态补差价版） =====================
// 
// 核心规则：
// 1. 周期内（15号到次月15号），提成比例实时浮动
// 2. 营业额突破阈值 → 之前消过的课自动补差价升级
// 3. 结算日后，比例锁死
//
// 数据模型：
// - Enrollment: 报名时的 snapshot 信息
// - Lesson: 每次消课记录，包含当时的 periodRate
// - PeriodLock: 结算日后锁定，不可回退

import type { Enrollment, LessonRecord } from '../types';

export const COMMISSION_TIERS = [
  { min: 0, max: 40000, rate: 0.2, label: '20%', tier: 1 },
  { min: 40000, max: 50000, rate: 0.3, label: '30%', tier: 2 },
  { min: 50000, max: Infinity, rate: 0.4, label: '40%', tier: 3 },
];

/**
 * 根据营业额返回当前档位信息
 */
export function getTierByRevenue(revenue: number) {
  for (const t of COMMISSION_TIERS) {
    if (revenue >= t.min && revenue < t.max) return t;
  }
  return COMMISSION_TIERS[0];
}

/**
 * 计算单节课时费
 * @param price 学费实收
 * @param rate 当前提成比例
 * @param formalLessons 正式课时数
 */
export function calcLessonFee(price: number, rate: number, formalLessons: number): number {
  if (formalLessons <= 0) return 0;
  return Math.round(((price * rate) / formalLessons) * 100) / 100;
}

/**
 * 计算无限课时过半提成
 */
export function calcUnlimitedHalfCommission(price: number, rate: number): number {
  return Math.round(price * rate * 50) / 100;
}

/**
 * 计算补差价
 * 当档位从 oldRate 升级到 newRate 时，已消课时需要补多少
 */
export function calcUpgradeForLessons(
  lessons: LessonRecord[],
  oldRate: number,
  newRate: number,
  enrollments: Enrollment[],
): { totalUpgrade: number; upgrades: { lessonId: string; oldAmount: number; newAmount: number; diff: number }[] } {
  const upgrades: { lessonId: string; oldAmount: number; newAmount: number; diff: number }[] = [];
  let totalUpgrade = 0;

  for (const lesson of lessons) {
    if (lesson.type !== 'formal' || lesson.commissionAmount <= 0) continue;
    if (lesson.status === 'rejected') continue;

    const enrollment = enrollments.find(e => e.id === lesson.enrollmentId);
    if (!enrollment || enrollment.formalLessons <= 0) continue;

    const oldAmount = lesson.commissionAmount;
    // 用新比例重新计算
    const newAmount = calcLessonFee(enrollment.price, newRate, enrollment.formalLessons);
    const diff = Math.round((newAmount - oldAmount) * 100) / 100;

    if (diff > 0) {
      upgrades.push({ lessonId: lesson.id, oldAmount, newAmount, diff });
      totalUpgrade += diff;
    }
  }

  totalUpgrade = Math.round(totalUpgrade * 100) / 100;
  return { totalUpgrade, upgrades };
}

/**
 * 格式化金额
 */
export function formatMoney(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 获取当前考核周期
 */
export function getCurrentPeriodInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  if (day >= 15) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      start: `${year}-${String(month).padStart(2, '0')}-15`,
      end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`,
      label: `${month}月15日 ~ ${nextMonth}月15日`,
      isAfterSettlement: false,  // 当前还没到结算日
    };
  } else {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return {
      period: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
      start: `${prevYear}-${String(prevMonth).padStart(2, '0')}-15`,
      end: `${year}-${String(month).padStart(2, '0')}-15`,
      label: `${prevMonth}月15日 ~ ${month}月15日`,
      isAfterSettlement: true,  // 已过结算日，比例锁死
    };
  }
}

/**
 * 判断某周期是否已过结算日（可以锁定）
 */
export function isPeriodLocked(periodKey: string): boolean {
  const now = new Date();
  const [y, m] = periodKey.split('-').map(Number);
  // 结算日是次月15号
  const settlementDate = new Date(y, m, 15); // 次月15号（JS month: 0-based, so m = next month)

  return now >= settlementDate;
}
