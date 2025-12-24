import { NextResponse } from "next/server";
import { ensureWorkflow } from "@/lib/builder/mock-workflow-store";

type RouteParams = {
  params: { workflowId: string };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const workflow = ensureWorkflow(params.workflowId);
  return NextResponse.json({
    name: workflow.name,
    workflow,
  });
}
