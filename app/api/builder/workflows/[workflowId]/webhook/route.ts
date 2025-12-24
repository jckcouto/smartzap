import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST() {
  return NextResponse.json({
    executionId: nanoid(),
    status: "queued",
  });
}
