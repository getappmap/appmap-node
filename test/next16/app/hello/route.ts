import { NextResponse } from "next/server";

export function GET(): NextResponse {
  return NextResponse.json({ pid: process.pid });
}
