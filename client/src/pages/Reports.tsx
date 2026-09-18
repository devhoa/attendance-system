export default function Reports() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
      <p className="mt-2 text-sm text-slate-500">Generate summaries and audit employee attendance data.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ['Monthly summary', 'Generated'],
          ['Late arrivals', '14 records'],
          ['Attendance trends', 'Updated today'],
        ].map(([title, detail]) => (
          <div key={title} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-700">{title}</p>
            <p className="mt-2 text-sm text-slate-500">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
