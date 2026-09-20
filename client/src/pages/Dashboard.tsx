import { useState } from 'react';

type DashboardProps = {
  dashboard: {
    summary: {
      totalEmployees?: number;
      activeEmployees?: number;
      presentToday?: number;
      lateToday?: number;
      absentToday?: number;
      onTimeRate?: number;
      lateRate?: number;
      absentRate?: number;
      totalHours?: number;
      totalBonus?: number;
      totalSalary?: number;
    };
    recentRecords: Array<{
      id: string;
      employeeName: string;
      status: string;
      checkIn: string;
      checkOut?: string | null;
      totalHours?: number | null;
      bonus?: number | null;
    }>;
  } | null;
  user?: { email: string; role: string } | null;
};

function formatHours(hours: number) {
  return Number.isFinite(hours) ? `${hours.toFixed(1)}h` : '0.0h';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildHoursByDay(records: Array<{ checkIn: string; checkOut?: string | null; totalHours?: number | null }>) {
  const byDay = new Map<string, { day: string; hours: number }>();

  records.forEach((record) => {
    const checkIn = new Date(record.checkIn);
    if (Number.isNaN(checkIn.getTime())) return;

    const dateKey = checkIn.toISOString().slice(0, 10);
    const hours = record.totalHours ?? ((record.checkOut)
      ? Math.max((new Date(record.checkOut).getTime() - checkIn.getTime()) / (1000 * 60 * 60), 0)
      : 0);
    const existing = byDay.get(dateKey) ?? { day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(checkIn), hours: 0 };

    existing.hours += hours;
    byDay.set(dateKey, existing);
  });

  return Array.from(byDay.values()).map((item) => ({
    day: item.day,
    hours: Number(item.hours.toFixed(1)),
  })).slice(-7);
}

export default function Dashboard({ dashboard, user }: DashboardProps) {
  if (!dashboard) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  const { summary, recentRecords } = dashboard;
  const isEmployeeView = user?.role === 'EMPLOYEE';
  const [showTotalSalary, setShowTotalSalary] = useState(false);
  const totalHours = summary.totalHours ?? recentRecords.reduce((sum, record) => sum + (record.totalHours ?? 0), 0);
  const totalBonus = summary.totalBonus ?? recentRecords.reduce((sum, record) => sum + (record.bonus ?? 0), 0);
  const totalSalary = summary.totalSalary ?? recentRecords.reduce((sum, record) => {
    const hours = record.totalHours ?? ((record.checkOut && record.checkIn)
      ? Math.max((new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / (1000 * 60 * 60), 0)
      : 0);
    return sum + hours * 250000 + (record.bonus ?? 0);
  }, 0);

  const averageHours = recentRecords.length
    ? recentRecords.reduce((total, record) => total + (record.totalHours ?? ((record.checkOut && record.checkIn)
      ? Math.max((new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / (1000 * 60 * 60), 0)
      : 0)), 0) / recentRecords.length
    : 0;

  const statCards = isEmployeeView
    ? [
        { label: 'Tổng giờ làm', value: formatHours(totalHours), accent: 'bg-blue-100 text-blue-700' },
        { label: 'Tổng bonus', value: formatMoney(totalBonus), accent: 'bg-emerald-100 text-emerald-700' },
        { label: 'Tổng lương', value: showTotalSalary ? formatMoney(totalSalary) : '••••••••••', accent: 'bg-violet-100 text-violet-700' },
        { label: 'Giờ làm TB', value: formatHours(averageHours), accent: 'bg-amber-100 text-amber-700' },
      ]
    : [
        { label: 'Tổng nhân viên', value: summary.totalEmployees ?? 0, accent: 'bg-blue-100 text-blue-700' },
        { label: 'Đã chấm công', value: summary.presentToday ?? 0, accent: 'bg-emerald-100 text-emerald-700' },
        { label: 'Đi muộn', value: summary.lateToday ?? 0, accent: 'bg-amber-100 text-amber-700' },
        { label: 'Giờ làm TB', value: formatHours(averageHours || Number(summary.presentToday ? (summary.presentToday / (summary.totalEmployees ?? 1)) * 8 : 0)), accent: 'bg-violet-100 text-violet-700' },
      ];

  const hourlyData = buildHoursByDay(recentRecords);
  const maxHours = Math.max(1, ...hourlyData.map((item) => item.hours));
  const onTimeRate = summary.onTimeRate ?? 0;
  const lateRate = summary.lateRate ?? 0;
  const pieGradient = lateRate + onTimeRate > 0
    ? `conic-gradient(#22c55e 0 ${onTimeRate}%, #f59e0b ${onTimeRate}% ${onTimeRate + lateRate}%, #e2e8f0 ${onTimeRate + lateRate}% 100%)`
    : 'conic-gradient(#22c55e 0 100%)';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-600">Overview</p>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Tổng quan chấm công và hiệu suất làm việc của {user?.email || 'admin'}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {statCards.map((stat) => {
          const isSalaryCard = stat.label === 'Tổng lương';

          return (
            <div key={stat.label} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3 shadow-[0_18px_38px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(15,23,42,0.12)] sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className={`inline-flex rounded-xl px-2 py-1 text-[10px] font-semibold shadow-sm sm:px-2.5 sm:text-xs ${stat.accent}`}>
                  {stat.label}
                </div>
                {isSalaryCard && (
                  <button
                    type="button"
                    aria-label={showTotalSalary ? 'Ẩn tổng lương' : 'Hiện tổng lương'}
                    onClick={() => setShowTotalSalary((prev) => !prev)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-200 hover:text-sky-600"
                  >
                    {showTotalSalary ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                        <path d="M3 3l18 18" />
                        <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
                        <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.12 17.12 0 0 1-4.04 5.18M6.61 6.61A16.97 16.97 0 0 0 2 12s3.5 7 10 7a11.54 11.54 0 0 0 5.16-1.39" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <p className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Chart</p>
              <h2 className="text-xl font-bold text-slate-900">Giờ làm theo ngày</h2>
            </div>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">Live data</span>
          </div>

          <div className="space-y-5">
            <div className="flex h-44 items-end gap-3 pt-4">
              {hourlyData.length > 0 ? (
                hourlyData.map((item) => (
                  <div key={`${item.day}-${item.hours}`} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex h-full w-full items-end justify-center">
                      <div
                        className="w-full rounded-t-2xl bg-gradient-to-t from-sky-600 via-sky-500 to-sky-300 shadow-sm"
                        style={{ height: `${(item.hours / maxHours) * 100}%`, minHeight: '18%' }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500">{item.day}</span>
                  </div>
                ))
              ) : (
                <div className="flex h-44 w-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
                  Chưa có dữ liệu giờ làm trong khoảng thời gian này.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
              <span>Giờ làm theo từng ngày</span>
              <span className="font-medium text-slate-700">{hourlyData.length > 0 ? `${Math.max(...hourlyData.map((item) => item.hours)).toFixed(1)}h cao nhất` : '0.0h'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Chart</p>
              <h2 className="text-xl font-bold text-slate-900">Tỷ lệ đúng giờ</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{onTimeRate}%</span>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 md:flex-row md:items-center md:justify-between">
            <div
              className="relative h-40 w-40 rounded-full shadow-inner ring-8 ring-slate-50"
              style={{ background: pieGradient }}
            >
              <div className="absolute inset-5 rounded-full bg-white shadow-inner" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{onTimeRate}%</div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Đúng giờ</div>
                </div>
              </div>
            </div>

            <div className="w-full max-w-[220px] space-y-3 text-sm">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Đúng giờ</span>
                <span className="ml-auto font-semibold text-slate-900">{onTimeRate}%</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="text-slate-600">Đi muộn</span>
                <span className="ml-auto font-semibold text-slate-900">{lateRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
