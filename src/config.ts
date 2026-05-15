// ===================== 门店和提成配置 =====================

export const STORES = [
  { id: 'dongguan', name: '东莞总店', shortName: '东莞', baseSalary: 0, color: 'indigo' },
  { id: 'chebei', name: '广州车陂店', shortName: '车陂', baseSalary: 4000, color: 'emerald' },
] as const;

export const STORE_MAP = Object.fromEntries(STORES.map(s => [s.id, s]));

export function getStore(id: string) {
  return STORE_MAP[id] || STORES[0];
}

// 阶梯提成档位
export const COMMISSION_TIERS = [
  { min: 0, max: 40000, rate: 0.2, label: '20%' },
  { min: 40000, max: 50000, rate: 0.3, label: '30%' },
  { min: 50000, max: Infinity, rate: 0.4, label: '40%' },
];

/**
 * 根据周期营业额计算提成档位
 * 营业额[1~40000] → 20%
 * 营业额[40000~50000] → 30%
 * 营业额[50000+] → 40%
 */
export function getCommissionTier(revenue: number) {
  for (const tier of COMMISSION_TIERS) {
    if (revenue >= tier.min && revenue < tier.max) {
      return { tier: tier.rate === 0.2 ? 1 : tier.rate === 0.3 ? 2 : 3, rate: tier.rate, label: tier.label };
    }
  }
  return { tier: 1, rate: 0.2, label: '20%' };
}

/**
 * 获取当前考核周期（15号到次月15号）
 */
export function getCurrentPeriod(): { period: string; start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  let periodYear, periodMonth, startDate, endDate;

  if (day >= 15) {
    // 当前月15号 ~ 下个月15号
    periodYear = year;
    periodMonth = month;
    startDate = `${year}-${String(month).padStart(2, '0')}-15`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`;
  } else {
    // 上个月15号 ~ 本月15号
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    periodYear = prevYear;
    periodMonth = prevMonth;
    startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-15`;
    endDate = `${year}-${String(month).padStart(2, '0')}-15`;
  }

  return {
    period: `${periodYear}-${String(periodMonth).padStart(2, '0')}`,
    start: startDate,
    end: endDate,
    label: `${periodMonth}月15日 ~ ${periodMonth === 12 ? 1 : periodMonth + 1}月15日`,
  };
}

/**
 * 判断某个日期属于哪个考核周期
 */
export function getPeriodForDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  if (day >= 15) {
    return `${year}-${String(month).padStart(2, '0')}`;
  } else {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }
}

/**
 * 格式化周期标签
 */
export function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-');
  const month = parseInt(m);
  return `${month}月15日 ~ ${month === 12 ? 1 : month + 1}月15日`;
}
