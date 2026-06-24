import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { downloadFromOneDrive } from "@/lib/onedrive";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fileUrl = searchParams.get("url");
  const filename = searchParams.get("name") ?? "document.pdf";

  if (!fileUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const result = await downloadFromOneDrive(decodeURIComponent(fileUrl));

  if (!result) {
    return new NextResponse("File not found or unavailable", { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Content-Type": result.mimeType,
    },
  });
}
