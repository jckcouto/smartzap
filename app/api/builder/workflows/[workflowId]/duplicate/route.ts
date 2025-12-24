import { NextResponse } from "next/server";
import { duplicateWorkflow } from "@/lib/builder/mock-workflow-store";

type RouteParams = {
  params: { workflowId: string };
};

export async function POST(_request: Request, { params }: RouteParams) {
  const workflow = duplicateWorkflow(params.workflowId);
  return NextResponse.json(workflow);
}
