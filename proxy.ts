import { NextRequest, NextResponse } from 'next/server'
import {
    verifyApiKey,
    verifyAdminAccess,
    isAdminEndpoint,
    isPublicEndpoint,
    unauthorizedResponse,
    forbiddenResponse
} from '@/lib/auth'

export const config = {
    matcher: [
        // Match all pages except static files and _next
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

// Routes that don't require user authentication
const PUBLIC_PAGES = ['/login', '/setup', '/debug-auth', '/f']
const PUBLIC_API_ROUTES = ['/api/auth', '/api/webhook', '/api/health', '/api/system', '/api/setup', '/api/debug', '/api/database', '/api/campaign/workflow', '/api/account/alerts', '/api/public/lead-forms', '/api/builder']

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // Session cookie can exist even when SETUP_COMPLETE env isn't set (dev/local).
    // If the user has a valid session, we should not force them back into the setup wizard.
    const sessionCookie = request.cookies.get('smartzap_session')

    // Handle OPTIONS requests for CORS preflight.
    // Alguns scripts (ex.: Vercel feedback/toolbar) disparam OPTIONS/HEAD mesmo em páginas.
    // Deixar isso cair no roteamento padrão pode virar 400 e poluir o console.
    if (request.method === 'OPTIONS') {
        const origin = request.headers.get('origin')
        const reqHeaders = request.headers.get('access-control-request-headers')

        return new NextResponse(null, {
            status: 204,
            headers: {
                ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
                'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
                'Access-Control-Allow-Headers': reqHeaders || 'Content-Type, Authorization',
                ...(origin ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
                'Access-Control-Max-Age': '86400',
                'Vary': 'Origin, Access-Control-Request-Headers',
            },
        })
    }

    // ==========================================================================
    // BOOTSTRAP CHECK - Redirect to setup if not configured
    // ==========================================================================
    const hasMasterPassword = !!process.env.MASTER_PASSWORD

    // ==========================================================================
    // SETUP LOCKDOWN (produção)
    // - Após o setup, ninguém “anônimo” deveria conseguir abrir o wizard
    // - As APIs de setup também não devem ficar abertas após concluído
    //   (exceto com sessão ou admin key)
    // ==========================================================================
    // Em produção, se já existe MASTER_PASSWORD, o setup não pode ser público.
    // Isso protege mesmo quando SETUP_COMPLETE não estiver setado corretamente.
    const shouldLockSetup = process.env.NODE_ENV === 'production' && hasMasterPassword
    const isSetupPage = pathname === '/setup' || pathname.startsWith('/setup/')
    const isSetupApi = pathname.startsWith('/api/setup')

    if (shouldLockSetup && (isSetupPage || isSetupApi)) {
        // Para páginas: exige sessão (login)
        if (isSetupPage) {
            if (!sessionCookie?.value) {
                const loginUrl = new URL('/login', request.url)
                loginUrl.searchParams.set('reason', 'setup_locked')
                loginUrl.searchParams.set('redirect', pathname)
                return NextResponse.redirect(loginUrl)
            }
        }

        // Para APIs: permite sessão OU admin key
        if (isSetupApi) {
            if (sessionCookie?.value) {
                return NextResponse.next()
            }

            const adminAuth = await verifyAdminAccess(request)
            if (!adminAuth.valid) {
                return unauthorizedResponse('Setup API bloqueada após setup. Faça login ou use SMARTZAP_ADMIN_KEY.')
            }
            return NextResponse.next()
        }
    }

    // If not configured and not already on setup, redirect immediately
    if (!hasMasterPassword) {
        if (!pathname.startsWith('/setup') && !pathname.startsWith('/api')) {
            const setupUrl = new URL('/setup/start', request.url)
            return NextResponse.redirect(setupUrl)
        }
    }

    // If configured but setup not complete (company info missing), go to wizard.
    // IMPORTANT:
    // - Não force o wizard aqui. Em dev/local, a completude do setup pode ser detectada via DB,
    //   enquanto SETUP_COMPLETE é uma env que pode não refletir o estado real.
    // - Para ser mais “à prova de falhas”, sempre deixe o usuário cair em /login quando não houver
    //   sessão, e deixe o /login decidir (via /api/auth/status) se precisa mandar para o wizard.
    // - Se existir session cookie, deixa passar.
    //
    // Obs: o redirect para /login já é feito mais abaixo para páginas protegidas; então aqui só
    // evitamos empurrar o usuário para /setup/wizard?resume=true baseado apenas em env.

    // If configured and on OLD bootstrap setup, redirect to login or new start?
    // Actually, if configured, we might want to allow /setup/start if user WANTS to fix envs.
    // But generally, the legacy logic redirected to login.
    // Let's REMOVE the forced redirect to login if /setup/bootstrap is visited, 
    // because we renamed it to /setup/start and we want to allow re-configuration if needed.
    // However, we should block /setup/bootstrap (old) to avoid 404? No, it's 404 anyway.

    // ==========================================================================
    // API Routes - Use API Key authentication
    // ==========================================================================
    if (pathname.startsWith('/api/')) {
        // Auth endpoints are always public
        if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
            return NextResponse.next()
        }

        // Public endpoints don't require authentication
        if (isPublicEndpoint(pathname)) {
            return NextResponse.next()
        }

        // Admin endpoints require admin-level access
        if (isAdminEndpoint(pathname)) {
            const adminAuth = await verifyAdminAccess(request)

            if (!adminAuth.valid) {
                return adminAuth.error?.includes('Admin')
                    ? forbiddenResponse(adminAuth.error)
                    : unauthorizedResponse(adminAuth.error)
            }

            return NextResponse.next()
        }

        // Check for user session cookie (for browser API calls)
        if (sessionCookie?.value) {
            // Session exists, allow request (validation happens in API route)
            return NextResponse.next()
        }

        // All other API endpoints require at least API key
        const authResult = await verifyApiKey(request)

        if (!authResult.valid) {
            return unauthorizedResponse(authResult.error)
        }

        return NextResponse.next()
    }

    // ==========================================================================
    // Page Routes - Use Session Cookie authentication
    // ==========================================================================

    // Public pages don't require authentication
    if (PUBLIC_PAGES.some(page => pathname.startsWith(page))) {
        return NextResponse.next()
    }

    // No session cookie - redirect to login
    if (!sessionCookie?.value) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // Session cookie exists - allow access (validation happens in layout)
    return NextResponse.next()
}
