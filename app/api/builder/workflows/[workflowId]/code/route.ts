import { NextResponse } from "next/server";

type RouteParams = {
  params: { workflowId: string };
};

export async function GET(_request: Request, { params }: RouteParams) {
  return NextResponse.json({
    code: `export async function workflow${params.workflowId}() {\n  "use workflow";\n}\n`,
    workflowName: "Workflow",
  });
}
