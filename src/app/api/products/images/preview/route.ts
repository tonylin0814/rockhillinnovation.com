import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { downloadFromOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const url = new URL(request.url).searchParams.get("url");

  if (!url || !url.startsWith("https://") || url.includes("mock.sharepoint.com")) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .contains("product_images", [{ url }])
    .limit(1)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const downloaded = await downloadFromOneDrive(url);

  if (!downloaded) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  return new Response(new Uint8Array(downloaded.buffer), {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": downloaded.mimeType,
    },
  });
}
