import { settingsDb } from '@/lib/supabase-db'

interface VerifyTokenOptions {
    readonly?: boolean
}

/**
 * Get or generate webhook verify token
 * 
 * @param options.readonly If true, will NOT generate a new token if missing (prevents race conditions)
 */
export async function getVerifyToken(options: VerifyTokenOptions = {}): Promise<string> {
    const { readonly = false } = options

    try {
        // 1. Try Supabase settings (Primary - "Source of Truth")
        console.log('🔍 getVerifyToken: Checking DB...')
        const storedToken = await settingsDb.get('webhook_verify_token')
        if (storedToken) {
            console.log('✅ getVerifyToken: Found in DB:', storedToken)
            return storedToken
        }

        // 2. Try Environment Variable (Fallback)
        if (process.env.WEBHOOK_VERIFY_TOKEN) {
            console.log('ℹ️ getVerifyToken: Using ENV fallback')
            return process.env.WEBHOOK_VERIFY_TOKEN.trim()
        }

        // 3. If Read-Only, stop here
        if (readonly) {
            console.warn('⚠️ getVerifyToken: Token missing and Read-Only. Failing.')
            return 'token-not-found-readonly'
        }

        // 4. Generate New Token
        const newToken = crypto.randomUUID()
        console.log('🔑 getVerifyToken: Generating new:', newToken)
        await settingsDb.set('webhook_verify_token', newToken)

        // Safety: Verify it was written (Consistency check)
        const check = await settingsDb.get('webhook_verify_token')
        if (check !== newToken) {
            console.error('💥 getVerifyToken: Write failed consistency check!')
        }

        return newToken

    } catch (err) {
        console.error('💥 getVerifyToken Error:', err)
        return process.env.WEBHOOK_VERIFY_TOKEN?.trim() || 'error-retrieving-token'
    }
}
