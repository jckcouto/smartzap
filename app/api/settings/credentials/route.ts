import { NextRequest, NextResponse } from 'next/server'
import { settingsDb } from '@/lib/supabase-db'

// Credentials are stored in Supabase settings table
// Environment variables are used as fallback (read-only)

interface WhatsAppCredentials {
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  displayPhoneNumber?: string
  verifiedName?: string
}

// GET - Fetch credentials from DB, fallback to Env
export async function GET() {
  try {
    // 1. Try to get from DB
    const dbSettings = await settingsDb.getAll()

    let phoneNumberId = dbSettings.phoneNumberId
    let businessAccountId = dbSettings.businessAccountId
    let accessToken = dbSettings.accessToken
    let source = 'db'

    // 2. Fallback to Env if missing in DB
    if (!phoneNumberId || !businessAccountId || !accessToken) {
      phoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_ID || ''
      businessAccountId = businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''
      accessToken = accessToken || process.env.WHATSAPP_TOKEN || ''
      source = 'env_fallback'
    }

    if (phoneNumberId && businessAccountId && accessToken) {
      // Fetch display phone number from Meta API
      let displayPhoneNumber: string | undefined
      let verifiedName: string | undefined

      try {
        const metaResponse = await fetch(
          `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        )
        if (metaResponse.ok) {
          const metaData = await metaResponse.json()
          displayPhoneNumber = metaData.display_phone_number
          verifiedName = metaData.verified_name
        }
      } catch {
        // Ignore errors, just won't have display number
      }

      return NextResponse.json({
        source,
        phoneNumberId,
        businessAccountId,
        displayPhoneNumber,
        verifiedName,
        hasToken: true,
        tokenPreview: '••••••••••',
        isConnected: true,
      })
    }

    // Not configured
    return NextResponse.json({
      source: 'none',
      isConnected: false,
    })
  } catch (error) {
    console.error('Error fetching credentials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    )
  }
}

// POST - Validate AND Save credentials to DB
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumberId, businessAccountId, accessToken } = body

    if (!phoneNumberId || !businessAccountId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields: phoneNumberId, businessAccountId, accessToken' },
        { status: 400 }
      )
    }

    // Validate token by making a test call to Meta API
    const testResponse = await fetch(
      `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!testResponse.ok) {
      const error = await testResponse.json()
      return NextResponse.json(
        {
          error: 'Invalid credentials - Meta API rejected the token',
          details: error.error?.message || 'Unknown error'
        },
        { status: 401 }
      )
    }

    const phoneData = await testResponse.json()

    // Save to Database (Persist across refreshes)
    await settingsDb.saveAll({
      phoneNumberId,
      businessAccountId,
      accessToken,
      isConnected: true
    })

    return NextResponse.json({
      success: true,
      phoneNumberId,
      businessAccountId,
      displayPhoneNumber: phoneData.display_phone_number,
      verifiedName: phoneData.verified_name,
      qualityRating: phoneData.quality_rating,
      message: 'Credentials verified and saved successfully.'
    })
  } catch (error) {
    console.error('Error validating credentials:', error)
    return NextResponse.json(
      { error: 'Failed to validate credentials' },
      { status: 500 }
    )
  }
}

// DELETE - Clear credentials from DB
export async function DELETE() {
  try {
    await settingsDb.saveAll({
      phoneNumberId: '',
      businessAccountId: '',
      accessToken: '',
      isConnected: false
    })

    return NextResponse.json({
      success: true,
      message: 'Credentials removed from database.'
    })
  } catch (error) {
    console.error('Error deleting credentials:', error)
    return NextResponse.json(
      { error: 'Failed to delete credentials' },
      { status: 500 }
    )
  }
}
