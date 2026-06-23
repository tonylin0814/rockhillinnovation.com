import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Rate provider unavailable" }, { status: 503 });
    }

    const data = await response.json();
    const rate: number | undefined = data?.rates?.CNY;

    if (!rate) {
      return NextResponse.json({ error: "CNY rate not found in response" }, { status: 503 });
    }

    return NextResponse.json({
      rate: Math.round(rate * 10000) / 10000,
      updatedAt: data.time_last_update_utc ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch exchange rate" }, { status: 503 });
  }
}
