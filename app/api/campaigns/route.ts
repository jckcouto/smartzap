import { NextResponse } from 'next/server'
import { campaignDb, campaignContactDb } from '@/lib/supabase-db'
import { CreateCampaignSchema, validateBody, formatZodErrors } from '@/lib/api-validation'

// Force dynamic - NO caching at all
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/campaigns
 * List all campaigns from Supabase (NO CACHE - always fresh)
 */
export async function GET() {
  try {
    const campaigns = await campaignDb.getAll()
    return NextResponse.json(campaigns, {
      headers: {
        // Disable ALL caching
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Failed to fetch campaigns:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar campanhas' },
      { status: 500 }
    )
  }
}

interface CreateCampaignBody {
  name: string
  templateName: string
  recipients: number
  scheduledAt?: string
  selectedContactIds?: string[]
  contacts?: { name: string; phone: string; email?: string | null; custom_fields?: Record<string, unknown> }[]
  templateVariables?: { header: string[], body: string[], buttons?: Record<string, string> }  // Meta API structure
}

/**
 * POST /api/campaigns
 * Create a new campaign with contacts
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const validation = validateBody(CreateCampaignSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: formatZodErrors(validation.error) },
        { status: 400 }
      )
    }

    const data = validation.data

    // Create campaign with template variables
    const campaign = await campaignDb.create({
      name: data.name,
      templateName: data.templateName,
      recipients: data.recipients,
      scheduledAt: data.scheduledAt,
      templateVariables: data.templateVariables,  // Now properly validated by Zod
    })

    // If contacts were provided, add them to campaign_contacts
    if (data.contacts && data.contacts.length > 0) {
      await campaignContactDb.addContacts(
        campaign.id,
        data.contacts.map((c) => ({
          contactId: c.contactId || c.id || (c as any).contact_id,
          phone: c.phone,
          name: c.name || '',
          email: c.email || null,
          // Snapshot Pattern: persist custom fields at campaign creation time
          custom_fields: c.custom_fields || {},
        }))
      )
    }

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error('Failed to create campaign:', error)
    return NextResponse.json(
      { error: 'Falha ao criar campanha' },
      { status: 500 }
    )
  }
}
