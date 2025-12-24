import { NextResponse } from "next/server";
import { ensureWorkflow } from "@/lib/builder/mock-workflow-store";
import { validateWorkflowSchema } from "@/lib/shared/workflow-schema";

type RouteParams = {
  params: { workflowId: string };
};

export async function POST(_request: Request, { params }: RouteParams) {
  const workflow = ensureWorkflow(params.workflowId);
  const validation = validateWorkflowSchema(workflow);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid workflow", details: validation.errors },
      { status: 400 }
    );
  }

  return NextResponse.json({
    status: "queued",
    workflowId: params.workflowId,
    executionId: `exec_${Date.now()}`,
  });
}
