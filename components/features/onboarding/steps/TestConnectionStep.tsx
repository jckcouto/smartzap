'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Send, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepHeader } from './StepHeader';
import { toast } from 'sonner';
import { settingsService } from '@/services/settingsService';

interface TestConnectionStepProps {
  credentials: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
  };
  onComplete: () => Promise<void>;
  onBack: () => void;
  stepNumber: number;
  totalSteps: number;
}

type ValidationStatus = 'idle' | 'loading' | 'success' | 'error';

interface ValidationResult {
  phoneNumberId: ValidationStatus;
  businessAccountId: ValidationStatus;
  accessToken: ValidationStatus;
  displayPhoneNumber?: string;
  verifiedName?: string;
  tokenExpiresIn?: string;
}

export function TestConnectionStep({
  credentials,
  onComplete,
  onBack,
  stepNumber,
  totalSteps,
}: TestConnectionStepProps) {
  const [validation, setValidation] = useState<ValidationResult>({
    phoneNumberId: 'idle',
    businessAccountId: 'idle',
    accessToken: 'idle',
  });
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Validar credenciais ao montar
  useEffect(() => {
    validateCredentials();
  }, []);

  const validateCredentials = async () => {
    setValidation({
      phoneNumberId: 'loading',
      businessAccountId: 'loading',
      accessToken: 'loading',
    });

    try {
      const result = await settingsService.testConnection({
        phoneNumberId: credentials.phoneNumberId,
        businessAccountId: credentials.businessAccountId,
        accessToken: credentials.accessToken,
      });

      setValidation({
        phoneNumberId: 'success',
        businessAccountId: 'success',
        accessToken: 'success',
        displayPhoneNumber: result.displayPhoneNumber ?? undefined,
        verifiedName: result.verifiedName ?? undefined,
        tokenExpiresIn: '~24h', // Token temporário
      });
    } catch (error: any) {
      // Tentar identificar qual credencial falhou
      const errorMsg = error?.message?.toLowerCase() || '';

      if (errorMsg.includes('token') || errorMsg.includes('oauth')) {
        setValidation(prev => ({
          ...prev,
          phoneNumberId: 'success',
          businessAccountId: 'success',
          accessToken: 'error',
        }));
      } else if (errorMsg.includes('phone') || errorMsg.includes('número')) {
        setValidation(prev => ({
          ...prev,
          phoneNumberId: 'error',
          businessAccountId: 'success',
          accessToken: 'success',
        }));
      } else {
        setValidation({
          phoneNumberId: 'error',
          businessAccountId: 'error',
          accessToken: 'error',
        });
      }

      toast.error('Erro ao validar credenciais', {
        description: error?.message || 'Verifique os dados informados',
      });
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      toast.error('Digite um número de telefone');
      return;
    }

    setIsSendingTest(true);
    try {
      // Enviar mensagem de teste usando template hello_world
      const response = await fetch('/api/messages/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testPhone,
          credentials: {
            phoneNumberId: credentials.phoneNumberId,
            accessToken: credentials.accessToken,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagem');
      }

      setTestSent(true);
      toast.success('Mensagem enviada!', {
        description: 'Verifique o WhatsApp do número informado',
      });
    } catch (error: any) {
      toast.error('Erro ao enviar teste', {
        description: error?.message,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete();
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsCompleting(false);
    }
  };

  const allValid =
    validation.phoneNumberId === 'success' &&
    validation.businessAccountId === 'success' &&
    validation.accessToken === 'success';

  const StatusIcon = ({ status }: { status: ValidationStatus }) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-zinc-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <StepHeader
        stepNumber={stepNumber}
        totalSteps={totalSteps}
        title="Testar Conexão"
        onBack={onBack}
      />

      {/* Status de validação */}
      <div className="p-4 rounded-xl bg-zinc-800/50 space-y-3">
        <p className="text-sm text-zinc-400 mb-3">Status da conexão:</p>

        <div className="flex items-center justify-between">
          <span className="text-zinc-300">Phone Number ID</span>
          <div className="flex items-center gap-2">
            <StatusIcon status={validation.phoneNumberId} />
            <span className="text-sm text-zinc-400">
              {validation.phoneNumberId === 'success' ? 'válido' : validation.phoneNumberId === 'error' ? 'inválido' : '...'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-300">Business Account ID</span>
          <div className="flex items-center gap-2">
            <StatusIcon status={validation.businessAccountId} />
            <span className="text-sm text-zinc-400">
              {validation.businessAccountId === 'success' ? 'válido' : validation.businessAccountId === 'error' ? 'inválido' : '...'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-300">Access Token</span>
          <div className="flex items-center gap-2">
            <StatusIcon status={validation.accessToken} />
            <span className="text-sm text-zinc-400">
              {validation.accessToken === 'success'
                ? `válido (expira em ${validation.tokenExpiresIn})`
                : validation.accessToken === 'error'
                  ? 'inválido'
                  : '...'}
            </span>
          </div>
        </div>

        {validation.displayPhoneNumber && (
          <div className="pt-2 mt-2 border-t border-zinc-700">
            <p className="text-sm text-zinc-400">
              Número: <span className="text-white">{validation.displayPhoneNumber}</span>
            </p>
            {validation.verifiedName && (
              <p className="text-sm text-zinc-400">
                Nome: <span className="text-white">{validation.verifiedName}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Teste de envio (opcional) */}
      {allValid && (
        <div className="p-4 rounded-xl border border-zinc-700 space-y-3">
          <Label className="text-zinc-300">
            📱 Enviar mensagem de teste <span className="text-zinc-500">(opcional)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="+55 11 99999-9999"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              disabled={isSendingTest}
            />
            <Button
              variant="outline"
              onClick={handleSendTest}
              disabled={isSendingTest || !testPhone.trim()}
            >
              {isSendingTest ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          {testSent && (
            <p className="text-sm text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Mensagem enviada com sucesso!
            </p>
          )}
        </div>
      )}

      {/* Botão de conclusão */}
      <Button
        className="w-full"
        size="lg"
        onClick={handleComplete}
        disabled={!allValid || isCompleting}
      >
        {isCompleting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <PartyPopper className="w-4 h-4 mr-2" />
            Concluir e ir para o Dashboard
          </>
        )}
      </Button>
    </div>
  );
}
