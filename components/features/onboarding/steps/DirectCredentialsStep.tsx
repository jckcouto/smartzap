'use client';

import React, { useState } from 'react';
import { ArrowLeft, Loader2, CheckCircle2, PartyPopper, HelpCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { settingsService } from '@/services/settingsService';

interface DirectCredentialsStepProps {
  credentials: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
  };
  onCredentialsChange: (credentials: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
  }) => void;
  onComplete: () => Promise<void>;
  onBack: () => void;
}

export function DirectCredentialsStep({
  credentials,
  onCredentialsChange,
  onComplete,
  onBack,
}: DirectCredentialsStepProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [validationInfo, setValidationInfo] = useState<{
    displayPhoneNumber?: string;
    verifiedName?: string;
  } | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const canTest =
    credentials.phoneNumberId.trim() &&
    credentials.businessAccountId.trim() &&
    credentials.accessToken.trim();

  const handleTest = async () => {
    setIsTesting(true);
    setIsValid(false);
    setValidationInfo(null);

    try {
      const result = await settingsService.testConnection({
        phoneNumberId: credentials.phoneNumberId,
        businessAccountId: credentials.businessAccountId,
        accessToken: credentials.accessToken,
      });

      setIsValid(true);
      setValidationInfo({
        displayPhoneNumber: result.displayPhoneNumber ?? undefined,
        verifiedName: result.verifiedName ?? undefined,
      });

      toast.success('Credenciais válidas!', {
        description: result.verifiedName
          ? `${result.displayPhoneNumber} • ${result.verifiedName}`
          : result.displayPhoneNumber,
      });
    } catch (error: any) {
      toast.error('Credenciais inválidas', {
        description: error?.message || 'Verifique os dados informados',
      });
    } finally {
      setIsTesting(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <h2 className="text-xl font-semibold text-white">Conectar Credenciais</h2>
      </div>

      {/* Campos */}
      <div className="space-y-4">
        {/* Phone Number ID */}
        <div className="space-y-2">
          <Label htmlFor="phoneNumberId" className="flex items-center gap-2">
            Phone Number ID
            <span className="text-red-400">*</span>
          </Label>
          <Input
            id="phoneNumberId"
            placeholder="123456789012345"
            value={credentials.phoneNumberId}
            onChange={(e) => {
              onCredentialsChange({ ...credentials, phoneNumberId: e.target.value });
              setIsValid(false);
            }}
            className="font-mono"
          />
          <p className="text-xs text-zinc-500">
            Encontrado em: App Dashboard → WhatsApp → API Setup
          </p>
        </div>

        {/* Business Account ID */}
        <div className="space-y-2">
          <Label htmlFor="businessAccountId" className="flex items-center gap-2">
            WhatsApp Business Account ID
            <span className="text-red-400">*</span>
          </Label>
          <Input
            id="businessAccountId"
            placeholder="987654321098765"
            value={credentials.businessAccountId}
            onChange={(e) => {
              onCredentialsChange({ ...credentials, businessAccountId: e.target.value });
              setIsValid(false);
            }}
            className="font-mono"
          />
          <p className="text-xs text-zinc-500">
            Encontrado em: App Dashboard → WhatsApp → API Setup
          </p>
        </div>

        {/* Access Token */}
        <div className="space-y-2">
          <Label htmlFor="accessToken" className="flex items-center gap-2">
            Access Token
            <span className="text-red-400">*</span>
          </Label>
          <Input
            id="accessToken"
            type="password"
            placeholder="EAAG..."
            value={credentials.accessToken}
            onChange={(e) => {
              onCredentialsChange({ ...credentials, accessToken: e.target.value });
              setIsValid(false);
            }}
            className="font-mono"
          />
          <p className="text-xs text-zinc-500">
            💡 Use um System User Token para não expirar
          </p>
        </div>
      </div>

      {/* Info de validação */}
      {validationInfo && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
            <div className="text-sm">
              <p className="text-emerald-200 font-medium">Credenciais válidas</p>
              <p className="text-emerald-200/70">
                {validationInfo.displayPhoneNumber}
                {validationInfo.verifiedName && ` • ${validationInfo.verifiedName}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Link de ajuda */}
      <a
        href="https://developers.facebook.com/apps/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        Abrir Meta for Developers
      </a>

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        {!isValid ? (
          <Button
            className="flex-1"
            onClick={handleTest}
            disabled={!canTest || isTesting}
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              'Testar Conexão'
            )}
          </Button>
        ) : (
          <Button
            className="flex-1"
            onClick={handleComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <PartyPopper className="w-4 h-4 mr-2" />
                Conectar e Continuar
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
