/**
 * AI Suggest API Route - AI SDK v6 Pattern
 * Generates a suggested response for operators WITHOUT sending to WhatsApp
 * Used by the AI Co-pilot feature in the inbox
 */

import { streamText, tool } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase-server'
import { inboxDb } from '@/lib/inbox/inbox-db'
import type { AIAgent, InboxConversation } from '@/types'

// Allow up to 30 seconds for AI generation
export const maxDuration = 30

// =============================================================================
// Schemas
// =============================================================================

const requestSchema = z.object({
  conversationId: z.string().uuid(),
})

const suggestResponseSchema = z.object({
  suggestion: z.string().describe('A sugestão de resposta para o operador'),
  sentiment: z
    .enum(['positive', 'neutral', 'negative', 'frustrated'])
    .describe('Sentimento detectado na última mensagem do cliente'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Nível de confiança na sugestão'),
  notes: z
    .string()
    .optional()
    .describe('Notas ou observações para o operador sobre como personalizar a resposta'),
})

type SuggestResponse = z.infer<typeof suggestResponseSchema>

// =============================================================================
// Helper Functions
// =============================================================================

async function getAgent(agentId: string): Promise<AIAgent | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (error || !data) return null
  return data as AIAgent
}

async function getDefaultAgent(): Promise<AIAgent | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('is_active', true)
    .eq('is_default', true)
    .single()

  if (error || !data) return null
  return data as AIAgent
}

function buildSuggestPrompt(agent: AIAgent, conversation: InboxConversation): string {
  const contactName = conversation.contact?.name || 'Cliente'

  return `${agent.system_prompt}

CONTEXTO DA CONVERSA:
- Nome do cliente: ${contactName}
- Telefone: ${conversation.phone}
- Prioridade: ${conversation.priority || 'normal'}
- Total de mensagens: ${conversation.total_messages}

MODO: SUGESTÃO PARA OPERADOR
Você está ajudando um operador humano a responder ao cliente.
Gere uma SUGESTÃO de resposta que o operador pode usar, editar ou adaptar.

INSTRUÇÕES:
1. Gere uma resposta natural e empática em português do Brasil
2. Analise o sentimento da última mensagem do cliente
3. Forneça notas úteis para o operador personalizar a resposta se necessário
4. NÃO inclua saudações genéricas como "Olá!" se a conversa já está em andamento

IMPORTANTE: Use a ferramenta "suggest" para enviar sua sugestão.`
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { conversationId } = parsed.data

    // Get conversation with messages
    const conversation = await inboxDb.getConversation(conversationId)
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get agent (from conversation or default)
    let agent: AIAgent | null = null
    if (conversation.ai_agent_id) {
      agent = await getAgent(conversation.ai_agent_id)
    }
    if (!agent) {
      agent = await getDefaultAgent()
    }
    if (!agent) {
      return new Response(
        JSON.stringify({ error: 'No AI agent configured' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get recent messages for context
    const { messages } = await inboxDb.listMessages(conversationId, { limit: 10 })

    // Convert messages to AI format
    const aiMessages = messages
      .filter((m) => m.message_type !== 'internal_note')
      .map((m) => ({
        role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }))

    // Get API key
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create model
    const google = createGoogleGenerativeAI({ apiKey })
    const modelId = agent.model || 'gemini-2.5-flash'
    const model = google(modelId)

    // Capture structured response
    let suggestion: SuggestResponse | undefined

    // Use streamText with tool for structured output
    const result = streamText({
      model,
      system: buildSuggestPrompt(agent, conversation),
      messages: aiMessages,
      tools: {
        suggest: tool({
          description: 'Envia uma sugestão de resposta para o operador.',
          inputSchema: suggestResponseSchema,
          execute: async (params) => {
            suggestion = params
            return params
          },
        }),
      },
      toolChoice: 'required',
      temperature: 0.7,
      maxOutputTokens: 1024,
    })

    // Consume stream to trigger tool execution
    for await (const _part of result.fullStream) {
      // Just consume
    }

    if (!suggestion) {
      throw new Error('No suggestion generated')
    }

    return new Response(
      JSON.stringify({
        suggestion: suggestion.suggestion,
        sentiment: suggestion.sentiment,
        confidence: suggestion.confidence,
        notes: suggestion.notes,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[POST /api/inbox/suggest]', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
