// ===================== 提成计算工具 =====================
import type { Enrollment, LessonRecord } from '../types';
import { getCommissionTier } from '../config';

/**
 * 计算单个学生的课时提成
 * @param price 学费实收
 * @param rate 锁定提成比例 (0.2/0.3/0.4)
 * @param formalLessons 正式课时数
 * @returns 每节课时费
 */
export function calcLessonFee(price: number, rate: number, formalLessons: number): number {
  if (formalLessons <= 0) return 0;
  return (price * rate) / formalLessons;
}

/**
 * 计算无限课时过半提成（钢琴等）
 * 总提成 price * rate，过半发一半
 */
export function calcUnlimitedHalfCommission(price: number, rate: number): number {
  return (price * rate) / 2;
}

/**
 * 根据老师周期内营业额计算锁定档位
 */
export function calcTier(totalRevenue: number) {
  return getCommissionTier(totalRevenue);
}

/**
 * 计算周期内老师提成汇总
 */
export function calcTeacherPeriodCommission(
  enrollments: Enrollment[],
  lessons: LessonRecord[],
  baseSalary: number,
) {
  // 课时提成
  const lessonCommissions = lessons
    .filter(l => l.status === 'approved' && l.type === 'formal')
    .reduce((sum, l) => sum + l.commissionAmount, 0);

  // 无限课时过半提成
  const halfCommissions = enrollments
    .filter(e => e.isUnlimited && e.unlimitedHalfApproved && e.status === 'active')
    .reduce((sum, e) => sum + calcUnlimitedHalfCommission(e.price, e.commissionRate), 0);

  const totalCommission = lessonCommissions + halfCommissions;
  const totalPayable = baseSalary + totalCommission;

  return {
    lessonCommissions,
    halfCommissions,
    totalCommission,
    baseSalary,
    totalPayable,
  };
}

/**
 * 格式化金额
 */
export function formatMoney(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
