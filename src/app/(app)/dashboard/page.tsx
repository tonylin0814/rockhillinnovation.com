export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Command Center</p>
        <h1 className="mt-3 text-3xl font-semibold text-[#0d1b34]">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Trade activity, pending reviews, payment status, and Judy insights will appear here as the platform is built.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["Open Trades", "Pending Reviews", "Client Payments", "Supplier Payments"].map((label) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-4 text-3xl font-semibold text-[#0d1b34]">--</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-[#0d1b34] p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-slate-300">Rock Hill Innovation Inc. Ltd.</p>
        <h2 className="mt-2 text-2xl font-semibold">Global trade operations, ready for the next build phase.</h2>
      </div>
    </section>
  );
}
