import { NextResponse } from "next/server";
import { createWorkflow } from "@/lib/builder/mock-workflow-store";
import { validateWorkflowSchema } from "@/lib/shared/workflow-schema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const validation = validateWorkflowSchema(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid workflow", details: validation.errors },
      { status: 400 }
    );
  }
  const workflow = createWorkflow({
    name: body?.name,
    description: body?.description,
    nodes: Array.isArray(body?.nodes) ? body.nodes : [],
    edges: Array.isArray(body?.edges) ? body.edges : [],
    visibility: body?.visibility,
  });
  return NextResponse.json(workflow);
}
