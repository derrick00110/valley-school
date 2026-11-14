// 无限课时分两次结算：过半、结课。每次金额都是学费 × 比例 ÷ 2。
// 过半只记里程碑，报名保持进行中；结课审核通过后才改为已结课。
// 代码里没有四分之一 / 四分之三。店长确认的规则是这两段，不是四段。

import type { Enrollment, LessonRecord, LessonType } from '../types';
import { calcUnlimitedHalfCommission, fixedCommissionRateOf } from './commission';

export type UnlimitedPhase = 'need-half' | 'half-pending' | 'half-done' | 'close-pending' | 'closed';

type StageTeacher = {
  employmentType?: string | null;
  fixedCommissionRate?: number | null;
} | null | undefined;

function stageLessons(lessons: LessonRecord[], enrollmentId: string, type: 'half' | 'close'): LessonRecord[] {
  return lessons.filter(lesson => lesson.enrollmentId === enrollmentId && lesson.type === type);
}

/** 同一报名、同一阶段只保留最早的一条已通过记录，避免重复发放。 */
export function countedStageLessonIds(lessons: LessonRecord[], type: 'half' | 'close'): Set<string> {
  const chosen = new Map<string, LessonRecord>();
  for (const lesson of lessons) {
    if (lesson.type !== type || lesson.status !== 'approved' || !lesson.enrollmentId) continue;
    const prev = chosen.get(lesson.enrollmentId);
    if (!prev || stageOrder(lesson) < stageOrder(prev)) chosen.set(lesson.enrollmentId, lesson);
  }
  return new Set([...chosen.values()].map(lesson => lesson.id));
}

function stageOrder(lesson: LessonRecord): string {
  const created = String(lesson.createdAt ?? 0).padStart(16, '0');
  return `${lesson.date || '9999-99-99'}|${created}|${lesson.id}`;
}

export function canonicalStageLesson(
  lessons: LessonRecord[],
  enrollmentId: string,
  type: 'half' | 'close',
): LessonRecord | null {
  const ids = countedStageLessonIds(lessons, type);
  return lessons.find(lesson => lesson.enrollmentId === enrollmentId && lesson.type === type && ids.has(lesson.id)) || null;
}

/**
 * 已通过的过半优先于审核中，审核中优先于已拒绝。
 * unlimitedHalfApproved 本身就表示过半已确认（含已重置为 active 的报名）。
 * 结课只看已通过的结课记录，不能把旧的「过半误标 completed」当成结课。
 */
export function unlimitedPhase(
  enrollment: Pick<Enrollment, 'id' | 'unlimitedHalfApproved'>,
  lessons: LessonRecord[],
): UnlimitedPhase {
  const closeRows = stageLessons(lessons, enrollment.id, 'close');
  if (closeRows.some(lesson => lesson.status === 'approved')) return 'closed';
  if (closeRows.some(lesson => lesson.status === 'pending')) return 'close-pending';
  const halfRows = stageLessons(lessons, enrollment.id, 'half');
  if (enrollment.unlimitedHalfApproved || halfRows.some(lesson => lesson.status === 'approved')) return 'half-done';
  if (halfRows.some(lesson => lesson.status === 'pending')) return 'half-pending';
  return 'need-half';
}

/**
 * 写入新申请时的金额。
 * 全职读报名上锁定的 commissionRate。结课若已有通过的过半记录，金额与那一条相同，
 * 这样两段都是当时的「学费 × 比例 ÷ 2」。
 * 兼职与工资里的过半一样，用固定比例，不读营业额档位。
 */
export function unlimitedStageAmount(input: {
  price: number;
  commissionRate: number;
  teacher: StageTeacher;
  stage: 'half' | 'close';
  matchedHalfAmount?: number | null;
}): number {
  const fixed = fixedCommissionRateOf(input.teacher);
  if (fixed != null) return calcUnlimitedHalfCommission(Number(input.price) || 0, fixed);
  if (input.stage === 'close') {
    const matched = Number(input.matchedHalfAmount);
    if (Number.isFinite(matched) && matched > 0) return matched;
  }
  return calcUnlimitedHalfCommission(Number(input.price) || 0, Number(input.commissionRate) || 0);
}

export function lessonKindLabel(type: LessonType): string {
  if (type === 'formal') return '正式';
  if (type === 'half') return '过半提成';
  if (type === 'close') return '结课提成';
  return '赠送';
}

export function lessonKindClass(type: LessonType): string {
  if (type === 'formal') return 'bg-indigo-50 text-indigo-600';
  if (type === 'half') return 'bg-amber-50 text-amber-600';
  if (type === 'close') return 'bg-rose-50 text-rose-600';
  return 'bg-emerald-50 text-emerald-600';
}
