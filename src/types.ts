// ===================== 类型定义 =====================

export type StoreId = 'dongguan' | 'chebei';
export type UserRole = 'teacher' | 'manager';
export type LessonType = 'formal' | 'gifted';
export type LessonStatus = 'pending' | 'approved' | 'rejected';
export type CourseType = 'fixed' | 'unlimited'; // 固定课时 / 无限课时(钢琴)

export interface Store {
  id: StoreId;
  name: string;
  shortName: string;
  baseSalary: number; // 底薪，0表示无
  color: string;
}

export interface Teacher {
  id: string;
  name: string;
  storeId: StoreId;
  role: 'teacher';
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  storeId: StoreId;
  teacherId: string;
  formalLessons: number;   // 剩余正式课时
  giftedLessons: number;   // 剩余赠送课时
  totalFormal: number;     // 总正式课时（历史累计）
  note: string;
  createdAt: number;
}

export interface Enrollment {
  id: string;
  studentId: string;
  studentName: string;
  course: string;
  courseType: CourseType;
  price: number;            // 实收金额
  teacherId: string;
  storeId: StoreId;
  enrollmentDate: string;   // YYYY-MM-DD
  commissionPeriod: string; // 如 "2026-05" 表示5.15~6.15周期
  commissionRate: number;   // 锁定比例 0.2 | 0.3 | 0.4
  formalLessons: number;    // 该课程正式课时数
  giftedLessons: number;    // 该课程赠送课时数
  lessonsPerSession: number; // 每节课时费 = price * rate / formalLessons
  isUnlimited: boolean;     // 是否无限课时
  unlimitedHalfApproved: boolean; // 无限课时过半审核
  status: 'active' | 'completed';
  createdAt: number;
}

export interface LessonRecord {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentId: string;
  course: string;
  teacherId: string;
  storeId: StoreId;
  date: string;            // YYYY-MM-DD
  type: LessonType;
  commissionAmount: number; // 该节课产生的提成
  status: LessonStatus;
  approvedBy?: string;
  approvedAt?: number;
  createdAt: number;
}

export interface CommissionPeriod {
  id: string;
  storeId: StoreId;
  teacherId: string;
  period: string;          // "2026-05" 表示5.15~6.15
  periodLabel: string;     // "5月15日 ~ 6月15日"
  // 营业额统计
  totalRevenue: number;
  tier: number;            // 1|2|3
  tierRate: number;        // 0.2|0.3|0.4
  // 提成汇总
  lessonCommissions: number;  // 课时提成总计
  halfCommissions: number;    // 无限课时过半提成
  totalCommission: number;    // 总提成
  baseSalary: number;         // 底薪
  totalPayable: number;       // 应发总计
  status: 'estimated' | 'finalized' | 'paid';
}

export interface ScheduleAppointment {
  id: string;
  studentId: string;
  studentName: string;
  course: string;
  teacherId: string;
  storeId: StoreId;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  note: string;
  checkedIn: boolean;     // 是否已上课
  lessonRecordId?: string; // 关联的消课记录
  createdAt: number;
}

export interface PeriodRevenue {
  teacherId: string;
  storeId: StoreId;
  period: string;
  enrollments: Enrollment[];
  totalRevenue: number;
  tier: number;
  tierRate: number;
}
