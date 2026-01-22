import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials';
import { normalizePhoneNumber } from '@/lib/phone-formatter';

const META_API_VERSION = 'v24.0';

/**
 * POST /api/messages/send-test
 * Envia uma mensagem de teste usando o template hello_world
 *
 * Body:
 * - to: número do destinatário
 * - credentials?: { phoneNumberId, accessToken } - opcional, usa credenciais salvas se não fornecido
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, credentials: providedCredentials } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Número do destinatário é obrigatório' },
        { status: 400 }
      );
    }

    // Normalizar número
    const normalizedPhone = normalizePhoneNumber(to);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Número de telefone inválido' },
        { status: 400 }
      );
    }

    // Obter credenciais (fornecidas ou salvas)
    let phoneNumberId: string;
    let accessToken: string;

    if (providedCredentials?.phoneNumberId && providedCredentials?.accessToken) {
      phoneNumberId = providedCredentials.phoneNumberId;
      accessToken = providedCredentials.accessToken;
    } else {
      const savedCredentials = await getWhatsAppCredentials();
      if (!savedCredentials?.phoneNumberId || !savedCredentials?.accessToken) {
        return NextResponse.json(
          { error: 'Credenciais não configuradas' },
          { status: 401 }
        );
      }
      phoneNumberId = savedCredentials.phoneNumberId;
      accessToken = savedCredentials.accessToken;
    }

    // Enviar mensagem usando template hello_world (template padrão da Meta)
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'template',
          template: {
            name: 'hello_world',
            language: {
              code: 'en_US',
            },
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || 'Erro ao enviar mensagem';
      const errorCode = data?.error?.code;

      // Erros comuns
      if (errorCode === 131026) {
        return NextResponse.json(
          { error: 'Número não está no WhatsApp ou bloqueou a empresa' },
          { status: 400 }
        );
      }

      if (errorCode === 132000) {
        return NextResponse.json(
          {
            error: 'Template hello_world não encontrado. Verifique se o template existe na sua conta.',
            details: data?.error,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: errorMessage, details: data?.error },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: data?.messages?.[0]?.id,
      to: normalizedPhone,
    });
  } catch (error: any) {
    console.error('Error sending test message:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao enviar mensagem' },
      { status: 500 }
    );
  }
}
