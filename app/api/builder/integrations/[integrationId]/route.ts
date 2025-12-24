import { NextResponse } from "next/server";

type RouteParams = {
  params: { integrationId: string };
};

export async function GET(_request: Request, { params }: RouteParams) {
  return NextResponse.json({
    id: params.integrationId,
    name: "Integration",
    type: "custom",
    config: {},
  });
}

export async function PUT(_request: Request, { params }: RouteParams) {
  return NextResponse.json({
    id: params.integrationId,
    name: "Integration",
    type: "custom",
    config: {},
  });
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}
