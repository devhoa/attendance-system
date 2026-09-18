import { useEffect, useMemo, useState } from 'react';
import {
  createAttendanceRecord,
  createEmployee,
  deleteAttendanceRecord,
  deleteEmployee,
  fetchAttendanceByEmployee,
  fetchEmployees,
  registerUser,
  resetEmployeePassword,
  updateEmployee,
  type AttendanceEntry,
  type Employee,
} from '../api';

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  hourlyRate: '250000',
  password: '',
  isActive: true,
};

const emptyAttendanceForm = {
  checkIn: '',
  checkOut: '',
  totalHours: '',
  bonus: '',
  notes: '',
  status: 'PRESENT',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Employees({ token }: { token: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendanceForm);
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const activeEmployees = employees.filter((employee) => employee.isActive).length;
  const averageHourlyRate = employees.length
    ? employees.reduce((sum, employee) => sum + Number(employee.hourlyRate ?? 250000), 0) / employees.length
    : 0;

  const loadEmployees = async () => {
    try {
      const data = await fetchEmployees(token);
      setEmployees(data.employees);
      if (!selectedEmployeeId && data.employees[0]) {
        setSelectedEmployeeId(data.employees[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadAttendance = async (employeeId: string) => {
    try {
      const data = await fetchAttendanceByEmployee(token, employeeId);
      setAttendanceEntries(data.attendance);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, [token]);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    void loadAttendance(selectedEmployeeId);
  }, [selectedEmployeeId, token]);

  const handleChange = (field: keyof typeof emptyForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAttendanceChange = (field: keyof typeof emptyAttendanceForm, value: string) => {
    setAttendanceForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || null,
        department: form.department || null,
        position: form.position || null,
        hourlyRate: Number(form.hourlyRate) || 250000,
        isActive: form.isActive,
      };

      if (editingId) {
        await updateEmployee(token, editingId, payload);

        if (form.password && form.password.length >= 6) {
          await resetEmployeePassword(token, editingId, form.password);
        }
      } else {
        if (!form.password || form.password.length < 6) {
          throw new Error('Employee password is required and must be at least 6 characters long.');
        }

        await registerUser(form.email, form.password, 'EMPLOYEE');
        await createEmployee(token, payload);
      }

      resetForm();
      await loadEmployees();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setForm({
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone ?? '',
      department: employee.department ?? '',
      position: employee.position ?? '',
      hourlyRate: String(employee.hourlyRate ?? 250000),
      password: '',
      isActive: employee.isActive,
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xoá nhân viên này?')) return;

    try {
      await deleteEmployee(token, id);
      await loadEmployees();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResetPassword = async (employee: Employee) => {
    const newPassword = window.prompt(`Nhập mật khẩu mới cho ${employee.fullName}:`, '');

    if (newPassword === null) {
      return;
    }

    const trimmedPassword = newPassword.trim();
    if (!trimmedPassword || trimmedPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    try {
      setError('');
      await resetEmployeePassword(token, employee.id, trimmedPassword);
      window.alert(`Đã cập nhật mật khẩu cho ${employee.fullName}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAttendanceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployeeId) {
      setError('Vui lòng chọn nhân viên trước khi chấm công.');
      return;
    }

    setAttendanceLoading(true);
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

      await createAttendanceRecord(token, selectedEmployeeId, payload);
      setAttendanceForm(emptyAttendanceForm);
      await loadAttendance(selectedEmployeeId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleDeleteAttendance = async (recordId: string) => {
    if (!selectedEmployeeId) return;

    try {
      await deleteAttendanceRecord(token, selectedEmployeeId, recordId);
      await loadAttendance(selectedEmployeeId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const totalHoursFromTimes = attendanceForm.checkIn && attendanceForm.checkOut
    ? ((new Date(attendanceForm.checkOut).getTime() - new Date(attendanceForm.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(1)
    : '';

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Human resources</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Employee management</h1>
          </div>
          <div className="rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
            {employees.length} employees
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 sm:text-sm">Total employees</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 sm:mt-3 sm:text-3xl">{employees.length}</p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 shadow-sm">
            <p className="text-xs text-emerald-700 sm:text-sm">Active</p>
            <p className="mt-2 text-2xl font-bold text-emerald-800 sm:mt-3 sm:text-3xl">{activeEmployees}</p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-amber-100 p-4 shadow-sm">
            <p className="text-xs text-amber-700 sm:text-sm">Avg. hourly rate</p>
            <p className="mt-2 text-xl font-bold text-amber-800 sm:mt-3 sm:text-2xl">{formatMoney(averageHourlyRate)}</p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-violet-50 to-violet-100 p-4 shadow-sm">
            <p className="text-xs text-violet-700 sm:text-sm">Selected</p>
            <p className="mt-2 text-lg font-bold text-violet-800 sm:mt-3 sm:text-xl">{selectedEmployee ? selectedEmployee.fullName : '—'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Profile</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{editingId ? 'Edit employee' : 'Add employee'}</h2>
            </div>
            {editingId ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Editing</span>
            ) : null}
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input
                value={form.fullName}
                onChange={(event) => handleChange('fullName', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-500"
                placeholder="Nguyễn Văn A"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-500"
                placeholder="employee@company.com"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-500"
                placeholder="0909..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
              <input
                value={form.department}
                onChange={(event) => handleChange('department', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-500"
                placeholder="Engineering"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Position</label>
              <input
                value={form.position}
                onChange={(event) => handleChange('position', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-500"
                placeholder="Developer"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hourly rate</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.hourlyRate}
                onChange={(event) => handleChange('hourlyRate', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-500"
                placeholder="250000"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {editingId ? 'New password (optional)' : 'Employee password'}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleChange('password', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-500"
                placeholder={editingId ? 'Leave blank to keep current password' : 'At least 6 chars'}
                required={!editingId}
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => handleChange('isActive', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Active employee
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-400"
                >
                  {loading ? 'Saving...' : editingId ? 'Update employee' : 'Add employee'}
                </button>
              </div>
            </div>

            {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
          </form>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Overview</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Employee profile</h2>
            </div>
            {selectedEmployee ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {selectedEmployee.isActive ? 'Active' : 'Inactive'}
              </span>
            ) : null}
          </div>

          {selectedEmployee ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Selected employee</p>
                <p className="mt-2 text-xl font-bold text-slate-900">{selectedEmployee.fullName}</p>
                <p className="text-sm text-slate-600">{selectedEmployee.email}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Department</p>
                  <p className="mt-2 font-medium text-slate-800">{selectedEmployee.department || '—'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Position</p>
                  <p className="mt-2 font-medium text-slate-800">{selectedEmployee.position || '—'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hourly rate</p>
                  <p className="mt-2 font-medium text-slate-800">{formatMoney(selectedEmployee.hourlyRate ?? 250000)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Phone</p>
                  <p className="mt-2 font-medium text-slate-800">{selectedEmployee.phone || '—'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Select an employee to preview profile details.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Directory</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Employee list</h2>
          </div>
          {selectedEmployee ? (
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700">
              Selected: {selectedEmployee.fullName}
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[760px] text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Department</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Position</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Rate</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No employees yet.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className={selectedEmployeeId === employee.id ? 'bg-sky-50/60' : 'bg-white'}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{employee.fullName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{employee.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{employee.department || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{employee.position || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatMoney(employee.hourlyRate ?? 250000)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${employee.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          className="rounded-lg bg-sky-100 px-2.5 py-1.5 text-sky-700 hover:bg-sky-200"
                        >
                          Select
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(employee)}
                          className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-amber-700 hover:bg-amber-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(employee)}
                          className="rounded-lg bg-violet-100 px-2.5 py-1.5 text-violet-700 hover:bg-violet-200"
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(employee.id)}
                          className="rounded-lg bg-red-100 px-2.5 py-1.5 text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Timekeeping</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Attendance records</h2>
          </div>
          {selectedEmployee ? (
            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
              {selectedEmployee.fullName}
            </span>
          ) : null}
        </div>

        <form className="mb-6 grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2" onSubmit={handleAttendanceSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Check in</label>
            <input
              type="datetime-local"
              value={attendanceForm.checkIn}
              onChange={(event) => handleAttendanceChange('checkIn', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Check out</label>
            <input
              type="datetime-local"
              value={attendanceForm.checkOut}
              onChange={(event) => handleAttendanceChange('checkOut', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Total hours</label>
            <input
              type="number"
              step="0.1"
              value={attendanceForm.totalHours || totalHoursFromTimes}
              onChange={(event) => handleAttendanceChange('totalHours', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-sky-500"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-sky-500"
              placeholder="500000"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={attendanceForm.status}
              onChange={(event) => handleAttendanceChange('status', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-sky-500"
            >
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half day</option>
              <option value="HOLIDAY">Holiday</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
            <textarea
              value={attendanceForm.notes}
              onChange={(event) => handleAttendanceChange('notes', event.target.value)}
              className="min-h-[100px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-sky-500"
              placeholder="Add note..."
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={attendanceLoading || !selectedEmployeeId}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-400"
            >
              {attendanceLoading ? 'Saving...' : 'Add attendance'}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Check in</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Check out</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Hours</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Bonus</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Note</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {attendanceEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No attendance data yet.
                  </td>
                </tr>
              ) : (
                attendanceEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-sm text-slate-700">{new Date(entry.checkIn).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.checkOut ? new Date(entry.checkOut).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.totalHours ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.bonus ? formatMoney(entry.bonus) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.notes || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => handleDeleteAttendance(entry.id)}
                        className="rounded-lg bg-red-100 px-2.5 py-1.5 text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
