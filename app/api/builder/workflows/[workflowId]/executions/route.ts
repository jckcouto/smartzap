import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type RouteParams = {
  params: Promise<{ workflowId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { workflowId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("workflow_builder_executions")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json([]);
  }

  const mapped = (data || []).map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    userId: null,
    status: row.status,
    input: row.input,
    output: row.output,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.finished_at,
    duration: null,
  }));

  return NextResponse.json(mapped);
}

export async function POST() {
  return NextResponse.json({ success: true });
}
