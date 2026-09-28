import { useEffect, useState } from 'react';
import { fetchDashboardSummary, loginUser, registerUser } from './api';
import Attendance from './pages/Attendance';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import { fetchCurrentUser } from './api';

type DashboardSummary = {
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
};

const STORAGE_KEY = 'attendance-token';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'EMPLOYEE'>('EMPLOYEE');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [token, setToken] = useState<string | null>(localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'employees'>('dashboard');
  const [jumpToAttendanceDate, setJumpToAttendanceDate] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setDashboard(null);
      return;
    }

    const loadDashboard = async () => {
      try {
        const currentUser = await fetchCurrentUser(token);
        setUser(currentUser.user);

        const data = await fetchDashboardSummary(token);
        setDashboard(data);
      } catch (err) {
        setError((err as Error).message);
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
        setDashboard(null);
      }
    };

    void loadDashboard();
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = mode === 'login'
        ? await loginUser(email, password)
        : await registerUser(email, password, 'EMPLOYEE');
      localStorage.setItem(STORAGE_KEY, response.token);
      setToken(response.token);
      setUser(response.user);
      setError('');
      setMode('login');
      if (response.user.role !== 'ADMIN' && response.user.role !== 'MANAGER' && response.user.role !== 'HR') {
        setActiveTab('attendance');
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    setDashboard(null);
    setActiveTab('dashboard');
  };

  const canManageEmployees = user ? ['ADMIN', 'MANAGER', 'HR'].includes(user.role) : false;

  if (!token || !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">Attendance System</h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === 'login' ? 'Sign in to access the dashboard.' : 'Create a new employee account.'}
          </p>

          <div className="mt-4 flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Register
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                Tài khoản mới sẽ được tạo với vai trò <span className="font-semibold">Employee</span>.
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none transition focus:border-sky-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 pr-11 outline-none transition focus:border-sky-500"
                  placeholder={mode === 'login' ? 'Enter your password' : 'At least 6 chars'}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-700"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path d="M3 3l18 18" />
                      <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
                      <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.12 17.12 0 0 1-4.04 5.18M6.61 6.61A16.97 16.97 0 0 0 2 12s3.5 7 10 7a11.54 11.54 0 0 0 5.16-1.39" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-600 px-4 py-3 font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-400"
            >
              {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold sm:text-xl">Attendance System</p>
              <p className="text-[10px] text-slate-300 sm:text-xs">Welcome, {user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 sm:px-3 sm:py-2 sm:text-sm"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:shadow-none sm:border-none sm:bg-transparent sm:px-0 sm:py-0">
        <div className="mx-auto flex max-w-7xl items-center justify-around gap-1.5 sm:justify-center sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-semibold transition sm:min-w-[120px] sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <span className="text-base sm:text-lg">📊</span>
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-semibold transition sm:min-w-[120px] sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${activeTab === 'attendance' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <span className="text-base sm:text-lg">🕒</span>
            <span>Attendance</span>
          </button>
          {canManageEmployees ? (
            <button
              type="button"
              onClick={() => setActiveTab('employees')}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-semibold transition sm:min-w-[120px] sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${activeTab === 'employees' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="text-base sm:text-lg">👥</span>
              <span>Employees</span>
            </button>
          ) : null}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-10">
        {activeTab === 'dashboard' && (
          <Dashboard
            dashboard={dashboard}
            user={user}
            selectedDate={selectedCalendarDate}
            onSelectDate={(dateKey) => {
              setSelectedCalendarDate(dateKey);
              setJumpToAttendanceDate(dateKey);
              setActiveTab('attendance');
            }}
          />
        )}
        {activeTab === 'attendance' && (
          <Attendance
            token={token}
            userRole={user?.role ?? 'ADMIN'}
            jumpToDate={jumpToAttendanceDate}
            onDateHandled={() => {
              setJumpToAttendanceDate(null);
            }}
          />
        )}
        {canManageEmployees && activeTab === 'employees' && <Employees token={token} />}
      </main>
    </div>
  );
}
