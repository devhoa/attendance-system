export default function Login() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-2 text-sm text-slate-500">Sign in to your attendance dashboard.</p>

      <form className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none ring-0 transition focus:border-sky-500"
            placeholder="admin@attendance.local"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none transition focus:border-sky-500"
            placeholder="Admin@123"
          />
        </div>

        <button className="w-full rounded-xl bg-sky-600 px-4 py-3 font-medium text-white transition hover:bg-sky-500">
          Sign in
        </button>
      </form>
    </div>
  );
}
