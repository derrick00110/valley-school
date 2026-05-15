// ===================== 工具函数 =====================

/**
 * 生成短UUID
 */
export function shortId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 格式化显示日期
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parts[1]}月${parts[2]}日`;
}

/**
 * 时间段格式化
 */
export function formatTimeLabel(start: string, end: string): string {
  return `${start} - ${end}`;
}

/**
 * localStorage 工具
 */
export function getLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export function setLocal(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}
