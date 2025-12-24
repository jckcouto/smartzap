import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { CreateTemplateSchema } from '@/lib/whatsapp/validators/template.schema'
import { templateService } from '@/lib/whatsapp/template.service'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  try {
    const { data, error } = await supabase
      .from('templates')
      .select('id,name,components,status')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Rascunho não encontrado' }, { status: 404 })
    }

    if (data.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Apenas rascunhos (DRAFT) podem ser enviados.' }, { status: 400 })
    }

    const spec = data.components

    // Valida e normaliza para o contrato atual
    const parsed = CreateTemplateSchema.parse(spec)

    // Cria na Meta (Cloud API)
    const result = await templateService.create(parsed as any)

    // Atualiza o registro local para sair de "Rascunhos Manuais"
    const now = new Date().toISOString()

    // Regra de UX/Produto:
    // assim que enviamos para a Meta, o template entra em "Em análise" (PENDING).
    // O status real (APPROVED/REJECTED) virá pela sincronização com a Meta.
    const nextStatus = 'PENDING'
    const update: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
    }

    // Tentativa (schema novo)
    ;(update as any).meta_id = result.id

    const attempt1 = await supabase
      .from('templates')
      .update(update as any)
      .eq('id', id)

    if (attempt1.error) {
      const msg = String(attempt1.error.message || '')
      const missingMetaId = msg.includes('meta_id') && (msg.includes('column') || msg.includes('does not exist'))
      if (!missingMetaId) {
        return NextResponse.json({ error: attempt1.error.message }, { status: 500 })
      }

      // Fallback schema antigo
      const { meta_id, ...legacy } = update as any
      const attempt2 = await supabase.from('templates').update(legacy).eq('id', id)
      if (attempt2.error) {
        return NextResponse.json({ error: attempt2.error.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      name: result.name,
      id: result.id,
      status: nextStatus,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
