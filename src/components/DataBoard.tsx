// ===================== 店长端 · 数据看板（只读） =====================
// 不写 Firestore。数字来自店长端已经订阅的报名与消课，计算在 payroll.ts。
import React, { useMemo, useState } from 'react';
import type { Enrollment, LessonRecord, Teacher } from '../types';
import { formatMoney } from '../utils/commission';
import {
  STORE_FILTERS,
  buildPayrollReport,
  listPeriodOptions,
  periodShortLabel,
  type TeacherPeriodRow,
} from '../utils/payroll';

interface DataBoardProps {
  teachers: Teacher[];
  enrollments: Enrollment[];
  lessons: LessonRecord[];
  storeFilter: string;
  onStoreFilter: (storeId: string) => void;
}

function shortMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 10000) {
    const wan = abs / 10000;
    const digits = wan >= 10 ? 1 : 2;
    return `${sign}¥${wan.toFixed(digits)}万`;
  }
  return `${sign}¥${Math.round(abs).toLocaleString('zh-CN')}`;
}

function MoneyBars({
  rows,
  pick,
  color,
  caption,
}: {
  rows: { period: string; revenue: number; payable: number }[];
  pick: (row: { period: string; revenue: number; payable: number }) => number;
  color: string;
  caption: string;
}) {
  const max = Math.max(...rows.map(row => Math.max(0, pick(row))), 1);
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-600 mb-2">{caption}</div>
      <div className="flex items-end gap-2 h-44">
        {rows.map(row => {
          const value = pick(row);
          const height = value <= 0 ? 0 : Math.max(4, (value / max) * 100);
          return (
            <div key={row.period} className="flex-1 min-w-0 h-full flex flex-col">
              <div className="text-[10px] text-slate-500 text-center leading-tight truncate">{shortMoney(value)}</div>
              <div className="relative flex-1 min-h-0 mt-1">
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[36px] rounded-t"
                  style={{ height: `${height}%`, background: color }}
                  title={formatMoney(value)}
                />
              </div>
              <div className="text-[10px] text-slate-400 text-center mt-1">{periodShortLabel(row.period)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoreBadge({ storeId, name }: { storeId: string; name: string }) {
  const chebei = storeId === 'chebei';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${chebei ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
      {name}
    </span>
  );
}

export default function DataBoard({ teachers, enrollments, lessons, storeFilter, onStoreFilter }: DataBoardProps) {
  const options = useMemo(() => listPeriodOptions(enrollments, lessons), [enrollments, lessons]);
  const [fromPeriod, setFromPeriod] = useState('');
  const [toPeriod, setToPeriod] = useState('');
  const [showAllDetails, setShowAllDetails] = useState(false);

  const from = fromPeriod && options.includes(fromPeriod) ? fromPeriod : options[0];
  const to = toPeriod && options.includes(toPeriod) ? toPeriod : options[options.length - 1];

  const report = useMemo(
    () => buildPayrollReport({
      teachers,
      enrollments,
      lessons,
      storeId: storeFilter,
      fromPeriod: from,
      toPeriod: to,
    }),
    [teachers, enrollments, lessons, storeFilter, from, to],
  );

  const visibleDetails = report.details
    .filter(row => showAllDetails || row.revenue !== 0 || row.lessonCommission !== 0 || row.halfCommission !== 0 || row.baseSalary !== 0 || row.socialInsurance !== 0)
    .sort((a, b) => a.period.localeCompare(b.period) || a.teacherName.localeCompare(b.teacherName, 'zh-CN'));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-bold text-sm text-slate-800">数据看板</h2>
          <p className="text-xs text-slate-400 mt-0.5">考核周期为每月 15 日到次月 15 日，只读统计，不会修改任何数据</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-[10px] text-slate-400 mb-1">门店</div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
              {STORE_FILTERS.map(store => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => onStoreFilter(store.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium ${storeFilter === store.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {store.label}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs text-slate-500">
            <span className="block text-[10px] text-slate-400 mb-1">起始周期</span>
            <select
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
              value={from}
              onChange={event => setFromPeriod(event.target.value)}
            >
              {options.map(period => <option key={period} value={period}>{periodLabelOption(period)}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            <span className="block text-[10px] text-slate-400 mb-1">结束周期</span>
            <select
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
              value={to}
              onChange={event => setToPeriod(event.target.value)}
            >
              {options.map(period => <option key={period} value={period}>{periodLabelOption(period)}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="区间营业额" value={formatMoney(report.totalRevenue)} hint="报名学费合计" tone="slate" />
        <SummaryCard label="老师工资合计" value={formatMoney(report.totalPayable)} hint="底薪 + 提成 − 社保" tone="rose" />
        <SummaryCard label="课时提成" value={formatMoney(report.totalLesson)} hint={`过半提成 ${formatMoney(report.totalHalf)}`} tone="indigo" />
        <SummaryCard label="底薪 / 社保" value={formatMoney(report.totalBase)} hint={`社保自付 ${formatMoney(report.totalInsurance)}`} tone="slate" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700">各周期对比</h3>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> 营业额</span>
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" /> 老师工资</span>
          </div>
        </div>
        {report.periods.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">这个区间没有考核周期</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <MoneyBars rows={report.periods} pick={row => row.revenue} color="#10b981" caption="营业额" />
            <MoneyBars rows={report.periods} pick={row => row.payable} color="#6366f1" caption="老师工资" />
          </div>
        )}
      </div>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">周期汇总</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <Th>周期</Th>
                <Th align="right">营业额</Th>
                <Th align="right">课时提成</Th>
                <Th align="right">过半提成</Th>
                <Th align="right">底薪</Th>
                <Th align="right">社保</Th>
                <Th align="right">老师工资</Th>
              </tr>
            </thead>
            <tbody>
              {report.periods.map(row => (
                <tr key={row.period} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.periodLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-indigo-700">{formatMoney(row.lessonCommission)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">{formatMoney(row.halfCommission)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.baseSalary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600">{row.socialInsurance ? `-${formatMoney(row.socialInsurance)}` : formatMoney(0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">{formatMoney(row.payable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2">合计</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(report.totalRevenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-indigo-700">{formatMoney(report.totalLesson)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-700">{formatMoney(report.totalHalf)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(report.totalBase)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-600">{report.totalInsurance ? `-${formatMoney(report.totalInsurance)}` : formatMoney(0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(report.totalPayable)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">老师区间合计</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">所选周期内每位老师的营业额与应发工资</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <Th>老师</Th>
                <Th>门店</Th>
                <Th align="right">营业额</Th>
                <Th align="right">课时提成</Th>
                <Th align="right">过半提成</Th>
                <Th align="right">底薪</Th>
                <Th align="right">社保</Th>
                <Th align="right">工资合计</Th>
              </tr>
            </thead>
            <tbody>
              {report.teachers.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">该门店还没有老师</td></tr>
              ) : report.teachers.map(row => (
                <tr key={row.teacherId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                    {row.teacherName}
                    {row.partTimeRate != null && (
                      <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-50 text-amber-700">兼职{Math.round(row.partTimeRate * 100)}%</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><StoreBadge storeId={row.storeId} name={row.storeName} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-indigo-700">{formatMoney(row.lessonCommission)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">{formatMoney(row.halfCommission)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.baseSalary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600">{row.socialInsurance ? `-${formatMoney(row.socialInsurance)}` : formatMoney(0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(row.payable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700">老师 × 周期明细</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">全职档位由该周期报名营业额决定；兼职按固定比例，不随营业额改档</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAllDetails(value => !value)}
            className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-600 shrink-0"
          >
            {showAllDetails ? '隐藏无发生月份' : '显示全部月份'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <Th>周期</Th>
                <Th>老师</Th>
                <Th>门店</Th>
                <Th align="right">营业额</Th>
                <Th>档位</Th>
                <Th align="right">课时提成</Th>
                <Th align="right">过半提成</Th>
                <Th align="right">底薪</Th>
                <Th align="right">社保</Th>
                <Th align="right">工资</Th>
              </tr>
            </thead>
            <tbody>
              {visibleDetails.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-400">该区间没有营业额或工资</td></tr>
              ) : visibleDetails.map(row => (
                <DetailRow key={`${row.teacherId}-${row.period}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 space-y-1.5">
        <p className="font-medium">工资口径（与老师端预估工资一致）</p>
        <p>应发 = 底薪 + 已审核正式课课时提成 + 已审核过半提成 − 社保。全职车陂店每个周期底薪 ¥2,000.00、社保自付 ¥570.84；东莞总店无底薪、无社保。兼职老师无论门店，底薪和社保都是 0。</p>
        <p>课时提成按老师个人营业额分档，不跟同店其他老师合并。不满 4 万为 20%，4 万至不满 5 万为 30%，5 万及以上为 40%。兼职锁定个人固定比例（如 40%）。报名仍计入所在门店的营业额合计。15 日当天起算新周期，每条消课只计入上课日期所在的那一个周期。</p>
        <p>待审核、已拒绝和赠送课不计入。看板只读取数据，不会审核、改价或结算。</p>
        {report.skippedFormalLessons > 0 && (
          <p>有 {report.skippedFormalLessons} 条已审核正式课缺少报名记录或正式课时为 0，未计入工资。</p>
        )}
        {report.orphanApprovedLessons > 0 && (
          <p>另有 {report.orphanApprovedLessons} 条已审核消课属于已不在老师列表中的账号，未计入。</p>
        )}
      </div>
    </div>
  );
}

function periodLabelOption(period: string): string {
  const [year, month] = period.split('-');
  return `${year}年${Number(month)}月周期`;
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: 'slate' | 'rose' | 'indigo' }) {
  const toneClass = tone === 'rose' ? 'bg-rose-50 border-rose-100' : tone === 'indigo' ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-200';
  const valueClass = tone === 'rose' ? 'text-rose-700' : tone === 'indigo' ? 'text-indigo-700' : 'text-slate-800';
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-3 py-2 font-medium whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>
  );
}

function DetailRow({ row }: { row: TeacherPeriodRow }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.periodLabel}</td>
      <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{row.teacherName}</td>
      <td className="px-3 py-2"><StoreBadge storeId={row.storeId} name={row.storeName} /></td>
      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.revenue)}</td>
      <td className="px-3 py-2 text-slate-600">{row.tierLabel}</td>
      <td className="px-3 py-2 text-right tabular-nums text-indigo-700">{formatMoney(row.lessonCommission)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-amber-700">{formatMoney(row.halfCommission)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.baseSalary)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-rose-600">{row.socialInsurance ? `-${formatMoney(row.socialInsurance)}` : formatMoney(0)}</td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(row.payable)}</td>
    </tr>
  );
}
