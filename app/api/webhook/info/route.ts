import { NextResponse } from 'next/server'
import { settingsDb } from '@/lib/supabase-db'

import { getVerifyToken } from '@/lib/verify-token'

export async function GET() {
  // Build webhook URL - prioritize Vercel Production URL
  let webhookUrl: string

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    webhookUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}/api/webhook`
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL.trim()}/api/webhook`
  } else if (process.env.VERCEL_URL) {
    webhookUrl = `https://${process.env.VERCEL_URL.trim()}/api/webhook`
  } else {
    webhookUrl = 'http://localhost:3000/api/webhook'
  }

  const webhookToken = await getVerifyToken()

  // Stats are now tracked in Supabase (campaign_contacts table)
  // No Redis stats anymore

  return NextResponse.json({
    webhookUrl,
    webhookToken,
    stats: null, // Stats removed - use campaign details page instead
  })
}
