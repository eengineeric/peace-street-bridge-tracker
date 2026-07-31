import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { scanNews } from "@/lib/news";

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json(await scanNews());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed." },
      { status: 500 },
    );
  }
}
