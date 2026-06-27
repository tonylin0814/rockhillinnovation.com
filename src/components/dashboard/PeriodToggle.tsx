"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function PeriodToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") ?? "year";

  function setPeriod(value: "year" | "all") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
      <button
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          period === "year" ? "bg-white text-[#0d1b34] shadow-sm" : "text-slate-500 hover:text-[#0d1b34]"
        }`}
        onClick={() => setPeriod("year")}
        type="button"
      >
        Year
      </button>
      <button
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          period === "all" ? "bg-white text-[#0d1b34] shadow-sm" : "text-slate-500 hover:text-[#0d1b34]"
        }`}
        onClick={() => setPeriod("all")}
        type="button"
      >
        All Time
      </button>
    </div>
  );
}
