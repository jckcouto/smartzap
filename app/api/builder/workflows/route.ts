import { NextResponse } from "next/server";
import { listWorkflows } from "@/lib/builder/mock-workflow-store";

export async function GET() {
  return NextResponse.json(listWorkflows());
}
