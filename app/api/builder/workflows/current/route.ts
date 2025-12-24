import { NextResponse } from "next/server";
import {
  getCurrentWorkflow,
  saveCurrentWorkflow,
} from "@/lib/builder/mock-workflow-store";

export async function GET() {
  return NextResponse.json(getCurrentWorkflow());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const workflow = saveCurrentWorkflow(
    Array.isArray(body?.nodes) ? body.nodes : [],
    Array.isArray(body?.edges) ? body.edges : []
  );
  return NextResponse.json(workflow);
}
