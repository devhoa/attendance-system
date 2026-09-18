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
  const [email, setEmail] = useState('admin@attendance.local');
  const [password, setPassword] = useState('Admin@123');
  const [role, setRole] = useState<'EMPLOYEE'>('EMPLOYEE');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [token, setToken] = useState<string | null>(localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'employees'>('dashboard');

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
                placeholder="admin@attendance.local"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none transition focus:border-sky-500"
                placeholder={mode === 'login' ? 'Admin@123' : 'At least 6 chars'}
              />
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
        {activeTab === 'dashboard' && <Dashboard dashboard={dashboard} user={user} />}
        {activeTab === 'attendance' && <Attendance token={token} userRole={user?.role ?? 'ADMIN'} />}
        {canManageEmployees && activeTab === 'employees' && <Employees token={token} />}
      </main>
    </div>
  );
}
