import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/auth";
import { importRpdCsv } from "@/lib/rpd";

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = (await request.json()) as { csv?: string; sourceFile?: string };
    if (!body.csv?.trim()) return NextResponse.json({ error: "No CSV data supplied." }, { status: 400 });
    return NextResponse.json(await importRpdCsv(body.csv, body.sourceFile || "RPD export.csv"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "RPD import failed." }, { status: 500 });
  }
}
