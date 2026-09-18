import { useEffect, useMemo, useState } from 'react';
import {
  createAttendanceRecord,
  fetchAttendanceByEmployee,
  fetchEmployees,
  type AttendanceEntry,
  type Employee,
  updateAttendanceRecord,
} from '../api';

const DEFAULT_HOURLY_RATE = 250000;
const DAY_MS = 24 * 60 * 60 * 1000;

type PeriodFilter = 'week' | 'month' | 'all';

const emptyAttendanceForm = {
  checkIn: '',
  checkOut: '',
  totalHours: '',
  bonus: '',
  notes: '',
  status: 'PRESENT',
};

function getHoursFromEntry(entry: AttendanceEntry) {
  if (typeof entry.totalHours === 'number' && Number.isFinite(entry.totalHours)) {
    return entry.totalHours;
  }

  if (!entry.checkIn || !entry.checkOut) {
    return 0;
  }

  const diffMs = new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime();
  return Math.max(diffMs / (1000 * 60 * 60), 0);
}

function formatLocalDateTimeInput(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Attendance({ token, userRole }: { token: string; userRole?: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceEntry[]>>({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendanceForm);
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecordValues, setEditingRecordValues] = useState<{
    checkIn: string;
    checkOut: string;
    totalHours: string;
    bonus: string;
    notes: string;
  } | null>(null);

  const isEmployeeUser = userRole === 'EMPLOYEE';

  const loadData = async () => {
    try {
      const data = await fetchEmployees(token);
      const employeeList = data.employees;
      setEmployees(employeeList);

      const nextSelectedEmployeeId = isEmployeeUser
        ? employeeList[0]?.id ?? selectedEmployeeId
        : (!selectedEmployeeId && employeeList[0] ? employeeList[0].id : selectedEmployeeId);

      if (nextSelectedEmployeeId) {
        setSelectedEmployeeId(nextSelectedEmployeeId);
      }

      const attendanceResults = await Promise.all(
        employeeList.map(async (employee) => {
          try {
            const result = await fetchAttendanceByEmployee(token, employee.id);
            return { employeeId: employee.id, attendance: result.attendance };
          } catch {
            return { employeeId: employee.id, attendance: [] };
          }
        }),
      );

      const nextMap: Record<string, AttendanceEntry[]> = {};
      attendanceResults.forEach(({ employeeId, attendance }) => {
        nextMap[employeeId] = attendance;
      });
      setAttendanceMap(nextMap);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? null;

  const filterEntriesByPeriod = (entries: AttendanceEntry[]) => {
    if (period === 'all') return entries;

    const now = new Date();
    const lookbackMs = period === 'week' ? 7 * DAY_MS : 30 * DAY_MS;
    const cutoff = now.getTime() - lookbackMs;

    return entries.filter((entry) => {
      const entryTime = new Date(entry.checkIn).getTime();
      return Number.isFinite(entryTime) && entryTime >= cutoff;
    });
  };

  const selectedRows = selectedEmployeeId ? filterEntriesByPeriod(attendanceMap[selectedEmployeeId] ?? []) : [];

  const payrollRows = useMemo(() => {
    return employees.map((employee) => {
      const records = filterEntriesByPeriod(attendanceMap[employee.id] ?? []);
      const totalHours = records.reduce((sum, item) => sum + getHoursFromEntry(item), 0);
      const totalBonus = records.reduce((sum, item) => sum + (item.bonus ?? 0), 0);
      const hourlyRate = Number(employee.hourlyRate ?? DEFAULT_HOURLY_RATE);
      const baseSalary = totalHours * hourlyRate;
      const salary = baseSalary + totalBonus;

      return {
        employee,
        totalHours,
        totalBonus,
        salary,
      };
    });
  }, [employees, attendanceMap, period]);

  const totalHours = payrollRows.reduce((sum, item) => sum + item.totalHours, 0);
  const totalBonus = payrollRows.reduce((sum, item) => sum + item.totalBonus, 0);
  const totalPayroll = payrollRows.reduce((sum, item) => sum + item.salary, 0);

  const hoursChartData = payrollRows.map(({ employee, totalHours }) => ({
    label: employee.fullName.split(' ').slice(-1)[0],
    value: totalHours,
  }));

  const bonusChartData = payrollRows.map(({ employee, totalBonus }) => ({
    label: employee.fullName.split(' ').slice(-1)[0],
    value: totalBonus,
  }));

  const maxHours = Math.max(1, ...hoursChartData.map((item) => item.value));
  const maxBonus = Math.max(1, ...bonusChartData.map((item) => item.value));

  const handleAttendanceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetEmployeeId = selectedEmployeeId ?? employees[0]?.id;

    if (!targetEmployeeId) {
      setError('Please select an employee before adding attendance.');
      return;
    }

    setSelectedEmployeeId(targetEmployeeId);
    setLoading(true);
    setError('');

    try {
      const payload = {
        checkIn: attendanceForm.checkIn,
        checkOut: attendanceForm.checkOut || null,
        totalHours: attendanceForm.totalHours ? Number(attendanceForm.totalHours) : null,
        bonus: attendanceForm.bonus ? Number(attendanceForm.bonus) : null,
        notes: attendanceForm.notes || null,
        status: attendanceForm.status,
      };

      await createAttendanceRecord(token, targetEmployeeId, payload);
      setAttendanceForm(emptyAttendanceForm);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = (field: keyof typeof emptyAttendanceForm, value: string) => {
    setAttendanceForm((current) => ({ ...current, [field]: value }));
  };

  const handleEditRecordStart = (entry: AttendanceEntry) => {
    setEditingRecordId(entry.id);
    setEditingRecordValues({
      checkIn: formatLocalDateTimeInput(entry.checkIn),
      checkOut: formatLocalDateTimeInput(entry.checkOut),
      totalHours: String(entry.totalHours ?? getHoursFromEntry(entry)),
      bonus: String(entry.bonus ?? ''),
      notes: entry.notes ?? '',
    });
  };

  const handleEditRecordChange = (field: keyof NonNullable<typeof editingRecordValues>, value: string) => {
    setEditingRecordValues((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSaveRecord = async (entry: AttendanceEntry) => {
    if (!selectedEmployeeId || !editingRecordValues) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      await updateAttendanceRecord(token, selectedEmployeeId, entry.id, {
        checkIn: editingRecordValues.checkIn,
        checkOut: editingRecordValues.checkOut || null,
        totalHours: editingRecordValues.totalHours === '' ? null : Number(editingRecordValues.totalHours),
        bonus: editingRecordValues.bonus === '' ? null : Number(editingRecordValues.bonus),
        notes: editingRecordValues.notes.trim() || null,
      });

      setEditingRecordId(null);
      setEditingRecordValues(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const liveTotalHours = attendanceForm.checkIn && attendanceForm.checkOut
    ? ((new Date(attendanceForm.checkOut).getTime() - new Date(attendanceForm.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(1)
    : '';

  const exportCsv = () => {
    const rows = payrollRows.map(({ employee, totalHours, totalBonus, salary }) => [
      employee.fullName,
      totalHours.toFixed(1),
      totalBonus.toString(),
      salary.toString(),
    ]);

    const csv = [
      ['Employee', 'Hours', 'Bonus', 'Payroll'],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">Timekeeping</p>
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500">Theo dõi giờ làm, bonus và tính lương tự động cho nhân viên.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between md:p-4">
        <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1">
          {(['week', 'month', 'all'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition sm:text-sm ${period === item ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {item === 'all' ? 'All' : item === 'week' ? 'Tuần' : 'Tháng'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:text-sm"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-500 sm:text-sm"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
          <p className="text-xs text-slate-500 sm:text-sm">Tổng giờ làm</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:mt-3 sm:text-3xl">{totalHours.toFixed(1)}h</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
          <p className="text-xs text-slate-500 sm:text-sm">Tổng bonus</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:mt-3 sm:text-3xl">{formatMoney(totalBonus)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
          <p className="text-xs text-slate-500 sm:text-sm">Tổng lương</p>
          <p className="mt-2 text-xl font-bold text-slate-900 sm:mt-3 sm:text-3xl">{formatMoney(totalPayroll)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
          <p className="text-xs text-slate-500 sm:text-sm">Nhân viên</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:mt-3 sm:text-3xl">{employees.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_34px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Chart</p>
              <h2 className="text-xl font-bold text-slate-900">Giờ làm theo nhân viên</h2>
            </div>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">Hours</span>
          </div>

          <div className="space-y-4">
            {hoursChartData.length === 0 ? (
              <p className="text-sm text-slate-500">No attendance data.</p>
            ) : (
              hoursChartData.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>{item.label}</span>
                    <span className="font-semibold text-slate-800">{item.value.toFixed(1)}h</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600"
                      style={{ width: `${(item.value / maxHours) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Chart</p>
              <h2 className="text-xl font-bold text-slate-900">Bonus theo nhân viên</h2>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Bonus</span>
          </div>

          <div className="space-y-4">
            {bonusChartData.length === 0 ? (
              <p className="text-sm text-slate-500">No bonus data.</p>
            ) : (
              bonusChartData.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>{item.label}</span>
                    <span className="font-semibold text-slate-800">{formatMoney(item.value)}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                      style={{ width: `${(item.value / maxBonus) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_34px_rgba(15,23,42,0.06)] sm:p-6">
          <h2 className="text-xl font-bold text-slate-900">Add attendance</h2>
          <p className="mt-1 text-sm text-slate-500">Nhập dữ liệu chấm công cho nhân viên đang chọn.</p>

          {!isEmployeeUser ? (
            <select
              value={selectedEmployeeId ?? ''}
              onChange={(event) => setSelectedEmployeeId(event.target.value || null)}
              className="mt-5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-500"
            >
              {employees.length === 0 ? (
                <option value="">No employees</option>
              ) : (
                employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                ))
              )}
            </select>
          ) : selectedEmployee ? (
            <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
              Đang chấm công cho: <span className="font-semibold">{selectedEmployee.fullName}</span>
            </div>
          ) : null}

          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleAttendanceSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Check in</label>
              <input
                type="datetime-local"
                value={attendanceForm.checkIn}
                onChange={(event) => handleAttendanceChange('checkIn', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Check out</label>
              <input
                type="datetime-local"
                value={attendanceForm.checkOut}
                onChange={(event) => handleAttendanceChange('checkOut', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tổng giờ làm</label>
              <input
                type="number"
                step="0.1"
                value={attendanceForm.totalHours || liveTotalHours}
                onChange={(event) => handleAttendanceChange('totalHours', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-sky-500"
                placeholder="8.5"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bonus</label>
              <input
                type="number"
                step="1000"
                value={attendanceForm.bonus}
                onChange={(event) => handleAttendanceChange('bonus', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-sky-500"
                placeholder="250000"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={attendanceForm.status}
                onChange={(event) => handleAttendanceChange('status', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-sky-500"
              >
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="ABSENT">ABSENT</option>
                <option value="HALF_DAY">HALF_DAY</option>
                <option value="HOLIDAY">HOLIDAY</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
              <textarea
                value={attendanceForm.notes}
                onChange={(event) => handleAttendanceChange('notes', event.target.value)}
                className="min-h-[100px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-sky-500"
                placeholder="Ghi chú..."
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={loading || !selectedEmployeeId}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {loading ? 'Saving...' : 'Add attendance'}
              </button>
            </div>

            {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_34px_rgba(15,23,42,0.06)] sm:p-6">
          <h2 className="text-xl font-bold text-slate-900">Employee payroll</h2>
          <div className="mt-5 space-y-3">
            {payrollRows.length === 0 ? (
              <p className="text-sm text-slate-500">No data yet.</p>
            ) : (
              payrollRows.map(({ employee, totalHours, totalBonus, salary }) => (
                <div key={employee.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{employee.fullName}</p>
                      <p className="text-xs text-slate-500">{employee.department || 'Unassigned'} • {employee.position || 'Employee'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatMoney(salary)}</p>
                      <p className="text-xs text-slate-500">{totalHours.toFixed(1)}h • {formatMoney(totalBonus)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedEmployee && selectedRows.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Recent attendance for {selectedEmployee.fullName}</h2>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[760px] text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Check in</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Check out</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Hours</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Bonus</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Salary</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Note</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedRows.map((entry) => {
                  const hours = getHoursFromEntry(entry);
                  const hourlyRate = Number(selectedEmployee.hourlyRate ?? DEFAULT_HOURLY_RATE);
                  const salary = hours * hourlyRate + (entry.bonus ?? 0);
                  const isEditing = editingRecordId === entry.id && editingRecordValues;

                  return (
                    <tr key={entry.id} className="bg-white align-top">
                      {isEditing ? (
                        <>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <input
                              type="datetime-local"
                              value={editingRecordValues.checkIn}
                              onChange={(event) => handleEditRecordChange('checkIn', event.target.value)}
                              className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none focus:border-sky-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <input
                              type="datetime-local"
                              value={editingRecordValues.checkOut}
                              onChange={(event) => handleEditRecordChange('checkOut', event.target.value)}
                              className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none focus:border-sky-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <input
                              type="number"
                              step="0.1"
                              value={editingRecordValues.totalHours}
                              onChange={(event) => handleEditRecordChange('totalHours', event.target.value)}
                              className="w-24 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none focus:border-sky-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <input
                              type="number"
                              step="1000"
                              value={editingRecordValues.bonus}
                              onChange={(event) => handleEditRecordChange('bonus', event.target.value)}
                              className="w-28 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none focus:border-sky-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">{formatMoney(salary)}</td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <textarea
                              value={editingRecordValues.notes}
                              onChange={(event) => handleEditRecordChange('notes', event.target.value)}
                              className="min-h-[60px] w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none focus:border-sky-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => void handleSaveRecord(entry)}
                                className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-200"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRecordId(null);
                                  setEditingRecordValues(null);
                                }}
                                className="rounded-lg bg-slate-200 px-2.5 py-1.5 text-slate-700 hover:bg-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm text-slate-700">{new Date(entry.checkIn).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{entry.checkOut ? new Date(entry.checkOut).toLocaleString() : '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{hours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{entry.bonus ? formatMoney(entry.bonus) : '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatMoney(salary)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{entry.notes || '—'}</td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              type="button"
                              onClick={() => handleEditRecordStart(entry)}
                              className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-amber-700 hover:bg-amber-200"
                            >
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
