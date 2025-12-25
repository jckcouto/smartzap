import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs' // Force Node.js runtime to access filesystem

const isProd = process.env.NODE_ENV === 'production'
const log = (...args: any[]) => {
    if (!isProd) console.log(...args)
}

async function resolveMigrationsDir(): Promise<{ dir: string; files: string[] }> {
    // Fonte única de verdade: supabase/migrations
    // O diretório `lib/migrations` pode existir apenas como legado/mirror; não é caminho oficial.
    const supabaseDir = path.join(process.cwd(), 'supabase/migrations')
    const legacyDir = path.join(process.cwd(), 'lib/migrations')

    const tryRead = async (dir: string) => {
        const entries = await fs.readdir(dir)
        const files = entries
            .filter((f) => f.toLowerCase().endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b))
        return { dir, files }
    }

    try {
        return await tryRead(supabaseDir)
    } catch (e) {
        // Se ainda existir legado, damos uma mensagem clara para migração de pasta.
        try {
            const legacy = await tryRead(legacyDir)
            if (legacy.files.length) {
                throw new Error(
                    `Migrations canônicas não encontradas em ${supabaseDir}. ` +
                    `Foi encontrado legado em ${legacyDir}, mas este caminho não é mais oficial. ` +
                    `Mova as migrations para supabase/migrations.`
                )
            }
        } catch {
            // ignore
        }
        throw e
    }
}

function getNumericPrefix(fileName: string): string | null {
    const m = /^\d{4}/.exec(fileName)
    return m ? m[0] : null
}

function validateMigrationFilenames(files: string[]): { ok: true } | { ok: false; error: string } {
    const prefixToFiles = new Map<string, string[]>()
    const invalid: string[] = []

    for (const f of files) {
        const prefix = getNumericPrefix(f)
        if (!prefix) {
            invalid.push(f)
            continue
        }
        const arr = prefixToFiles.get(prefix) ?? []
        arr.push(f)
        prefixToFiles.set(prefix, arr)
    }

    const duplicates = Array.from(prefixToFiles.entries()).filter(([, arr]) => arr.length > 1)
    if (invalid.length || duplicates.length) {
        const parts: string[] = []
        if (invalid.length) {
            parts.push(`Arquivos sem prefixo numérico de 4 dígitos: ${invalid.join(', ')}`)
        }
        if (duplicates.length) {
            parts.push(
                'Prefixos duplicados encontrados:\n' +
                duplicates.map(([p, arr]) => `- ${p}: ${arr.join(', ')}`).join('\n')
            )
        }
        return {
            ok: false,
            error:
                'Ambiguidade de ordem/versão em migrations. ' +
                'Renomeie para prefixos únicos (ex.: 0001_, 0002_, ...).\n' +
                parts.join('\n')
        }
    }

    return { ok: true }
}

export async function POST(request: NextRequest) {
    let client: Client | null = null
    let fullSql = ''

    try {
        // Security: this endpoint accepts a database connection string and can run destructive actions.
        // Only allow during initial installation; after setup is complete, it must be blocked.
        if (process.env.SETUP_COMPLETE === 'true') {
            return NextResponse.json(
                { error: 'Setup já concluído. Endpoint de migração está desativado.' },
                { status: 403 }
            )
        }

        const { connectionString, action } = await request.json()

        if (!connectionString) {
            return NextResponse.json(
                { error: 'Connection string is required' },
                { status: 400 }
            )
        }

        // Connect to database
        client = new Client({
            connectionString,
            ssl: { rejectUnauthorized: false } // Required for Supabase (and most cloud PGs)
        })

        await client.connect()

        // Handle Nuclear Reset if requested
        if (action === 'reset') {
            log('☢️ NUCLEAR RESET TRIGGERED ☢️')
            await client.query(`
                DROP SCHEMA public CASCADE;
                CREATE SCHEMA public;
                GRANT ALL ON SCHEMA public TO postgres;
                GRANT ALL ON SCHEMA public TO public;
            `)
        }

        // Handle Check logic
        if (action === 'check') {
            const res = await client.query(`
                SELECT count(*) FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            `)
            const count = parseInt(res.rows[0].count)
            return NextResponse.json({
                success: true,
                exists: count > 0,
                count
            })
        }

        // Guard-rail: nunca aplicar migrations em DB não-vazio (a menos que seja reset)
        // Isso evita "não fazer merda" em staging/prod por engano.
        if (action !== 'reset') {
            const res = await client.query(`
                SELECT count(*) FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
            `)
            const count = parseInt(res.rows[0].count)
            if (count > 0) {
                return NextResponse.json(
                    {
                        error:
                            'Banco já possui tabelas no schema public. ' +
                            'Por segurança, o bootstrap de migrations só roda em banco vazio.',
                        hint: 'Use action="check" para inspecionar ou crie um banco novo.'
                    },
                    { status: 409 }
                )
            }
        }

        // Read SQL files (default 'migrate' action)
        const resolved = await resolveMigrationsDir()
        if (!resolved.files.length) {
            return NextResponse.json(
                { error: `Nenhuma migration .sql encontrada em ${resolved.dir}` },
                { status: 500 }
            )
        }

        const validation = validateMigrationFilenames(resolved.files)
        if (!validation.ok) {
            return NextResponse.json({ error: validation.error }, { status: 400 })
        }

        for (const file of resolved.files) {
            const filePath = path.join(resolved.dir, file)
            const content = await fs.readFile(filePath, 'utf-8')
            fullSql += `\n\n-- === MIGRATION: ${file} ===\n\n` + content + '\n'
        }

        // Split statements simply by semicolon to execute individually or as big block?
        // Postgres driver can often handle multiple statements, but let's try one big block or split?
        // 'pg' allows multiple statements in one query call usually.

        // Execute SQL
        await client.query(fullSql)

        return NextResponse.json({ success: true, message: 'Migrações aplicadas com sucesso!' })

    } catch (error: any) {
        console.error('Migration error:', error)

        let errorMessage = error.message
        const debug: Record<string, any> = {}

        // Extra debug only in dev to avoid leaking SQL details in production
        if (process.env.NODE_ENV !== 'production') {
            const posRaw = error?.position
            const pos = typeof posRaw === 'string' || typeof posRaw === 'number' ? Number(posRaw) : NaN
            if (Number.isFinite(pos) && fullSql) {
                // Postgres error.position is 1-based
                const idx = Math.max(0, pos - 1)
                const start = Math.max(0, idx - 160)
                const end = Math.min(fullSql.length, idx + 160)
                debug.errorPosition = pos
                debug.sqlSnippet = fullSql.slice(start, end)
            }
        }

        // Help user debug connection issues
        if (error.code === 'ENOTFOUND' && error.hostname?.includes('supabase.co')) {
            errorMessage = `Não foi possível conectar ao banco de dados (${error.hostname}). 
            Se você estiver usando a conexão direta (porta 5432), ela pode ser apenas IPv6. 
            Tente usar a Connection String do "Connection Pooler" (porta 6543, domínio *.pooler.supabase.com).`
        }

        return NextResponse.json(
            {
                error: `Erro na migração: ${errorMessage}`,
                ...(Object.keys(debug).length ? { debug } : {})
            },
            { status: 500 }
        )
    } finally {
        if (client) {
            await client.end().catch(console.error)
        }
    }
}
