import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch stats from Supabase
    const { data, error } = await supabase
      .from('campaigns')
      .select('sent, delivered, read, failed, status')

    if (error) throw error

    // Calculate aggregates
    let totalSent = 0
    let totalDelivered = 0
    let totalRead = 0
    let totalFailed = 0
    let activeCampaigns = 0

      const activeStatuses = new Set([
        'enviando',
        'agendado',
        'sending',
        'scheduled',
      ])

      ; (data || []).forEach(row => {
        totalSent += row.sent || 0
        totalDelivered += row.delivered || 0
        totalRead += row.read || 0
        totalFailed += row.failed || 0
        const status = String(row.status || '').trim().toLowerCase()
        if (activeStatuses.has(status)) {
          activeCampaigns++
        }
      })

    // Calculate delivery rate
    const deliveryRate = totalSent > 0
      ? Math.round((totalDelivered / totalSent) * 100)
      : 0

    return NextResponse.json(
      {
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        activeCampaigns,
        deliveryRate,
      },
      {
        headers: {
          // Dashboard precisa refletir mudanças em tempo real (realtime/polling).
          // Cache em CDN faz os indicadores parecerem “travados” até um hard refresh.
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
