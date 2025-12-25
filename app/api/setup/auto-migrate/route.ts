import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs' // Force Node.js runtime to access filesystem

function getBearerToken(req: NextRequest): string | null {
    const h = req.headers.get('authorization') || req.headers.get('Authorization')
    if (!h) return null
    const m = h.match(/^Bearer\s+(.+)$/i)
    return m?.[1]?.trim() || null
}

function isAuthorized(req: NextRequest): boolean {
    // Security: this endpoint can execute SQL using the Supabase service role key.
    // Require a server-side shared secret to prevent anonymous triggering in production.
    const secret = (process.env.SMARTZAP_ADMIN_KEY || process.env.SMARTZAP_API_KEY || '').trim()
    if (!secret) return process.env.NODE_ENV !== 'production'

    const q = req.nextUrl.searchParams.get('key')?.trim()
    if (q && q === secret) return true

    const token = getBearerToken(req)
    if (token && token === secret) return true

    return false
}

function isMissingRelationError(err: unknown): boolean {
    const e = err as any
    const msg = String(e?.message ?? '')
    const details = String(e?.details ?? '')
    const hint = String(e?.hint ?? '')
    const combined = `${msg}\n${details}\n${hint}`.toLowerCase()
    return (
        combined.includes('does not exist') ||
        combined.includes('relation') ||
        combined.includes('42p01')
    )
}

async function execSql(supabase: any, sql: string): Promise<{ ok: true } | { ok: false; error: any }> {
    // Tentativa 1: contrato antigo (sql_query)
    const r1 = await supabase.rpc('exec_sql', { sql_query: sql })
    if (!r1?.error) return { ok: true }

    // Tentativa 2: contrato alternativo (sql)
    const r2 = await supabase.rpc('exec_sql', { sql })
    if (!r2?.error) return { ok: true }

    return { ok: false, error: r2.error ?? r1.error }
}

export async function GET(req: NextRequest) {
    try {
        if (!isAuthorized(req)) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Supabase not configured' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        })

        // Check if tables exist
        const { error: checkError } = await supabase
            .from('settings')
            .select('key')
            .limit(1)

        // If settings table exists, skip migration
        if (!checkError) {
            return NextResponse.json({
                success: true,
                message: 'Database already initialized',
                migrated: false
            })
        }

        // Se o erro não for "tabela não existe", não assumimos que o DB está vazio.
        // Pode ser auth/config/etc.
        if (!isMissingRelationError(checkError)) {
            return NextResponse.json(
                {
                    error: 'Falha ao verificar se o banco já está inicializado. Não foi possível confirmar que o DB está vazio.',
                    ...(process.env.NODE_ENV !== 'production'
                        ? { details: (checkError as any)?.message ?? String(checkError) }
                        : {}),
                },
                { status: 500 }
            )
        }

        // Tables don't exist, run migration
        console.log('Running database migration...')

        // Baseline canônico: supabase/migrations/0001_initial_schema.sql
        const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '0001_initial_schema.sql')
        const sql = await fs.readFile(sqlPath, 'utf-8')

        const result = await execSql(supabase, sql)
        if (!result.ok) {
            return NextResponse.json(
                {
                    error: 'Falha ao executar migração via RPC (exec_sql). Rode o SQL manualmente no Supabase SQL Editor.',
                    details: result.error?.message ?? String(result.error),
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Database migrated successfully',
            migrated: true
        })

    } catch (error) {
        console.error('Auto-migration error:', error)
        return NextResponse.json(
            {
                error: 'Migration failed',
                ...(process.env.NODE_ENV !== 'production'
                    ? { details: error instanceof Error ? error.message : String(error) }
                    : {}),
            },
            { status: 500 }
        )
    }
}
