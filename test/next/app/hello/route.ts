import { NextResponse } from "next/server";

export function GET(): NextResponse {
  return NextResponse.json({ message: "Hello from appmap-node next.js test project" });
}
