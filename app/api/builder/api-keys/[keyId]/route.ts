import { NextResponse } from "next/server";
import { deleteApiKey } from "@/lib/builder/mock-api-keys";

type RouteParams = {
  params: { keyId: string };
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  deleteApiKey(params.keyId);
  return NextResponse.json({ success: true });
}
