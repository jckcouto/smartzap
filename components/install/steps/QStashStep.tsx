'use client';

import { useState, useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { StepCard } from '../StepCard';
import { ServiceIcon } from '../ServiceIcon';
import { TokenInput } from '../TokenInput';
import { ValidatingOverlay } from '../ValidatingOverlay';
import { SuccessCheckmark } from '../SuccessCheckmark';

interface QStashStepProps {
  onComplete: (data: { token: string; signingKey: string }) => void;
}

/**
 * Step 4: Coleta do QStash Token e Signing Key.
 *
 * Campos:
 * - QStash Token: formato JWT ou prefixo qstash_
 * - Current Signing Key: prefixo sig_ (para verificar callbacks)
 *
 * Auto-submit quando ambos os campos estão válidos.
 */
export function QStashStep({ onComplete }: QStashStepProps) {
  const [token, setToken] = useState('');
  const [signingKey, setSigningKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref para evitar validação dupla
  const hasTriggeredRef = useRef(false);

  // Valida formato do QStash token
  const isValidToken = (t: string): boolean => {
    const trimmed = t.trim();
    // JWT format (3 parts) ou prefixo qstash_
    return trimmed.split('.').length === 3 || trimmed.startsWith('qstash_');
  };

  // Valida formato da signing key
  const isValidSigningKey = (k: string): boolean => {
    const trimmed = k.trim();
    return trimmed.startsWith('sig_') && trimmed.length >= 30;
  };

  const canSubmit =
    token.trim().length >= 30 &&
    isValidToken(token) &&
    signingKey.trim().length >= 30 &&
    isValidSigningKey(signingKey);

  const handleValidate = async () => {
    if (validating || success) return;

    if (!isValidToken(token)) {
      setError('Token QStash inválido (deve ser JWT ou começar com qstash_)');
      return;
    }

    if (!isValidSigningKey(signingKey)) {
      setError('Signing Key inválida (deve começar com sig_)');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      // Valida token via API
      const res = await fetch('/api/installer/qstash/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          signingKey: signingKey.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Credenciais QStash inválidas');
      }

      setSuccess(true);
    } catch (err) {
      // Se API retornar 404, valida só o formato e prossegue
      if (err instanceof Error && err.message.includes('404')) {
        setSuccess(true);
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao validar');
        hasTriggeredRef.current = false; // Permite tentar novamente
      }
    } finally {
      setValidating(false);
    }
  };

  // Auto-submit quando ambos os campos estão válidos
  useEffect(() => {
    if (canSubmit && !validating && !success && !error && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      const timer = setTimeout(handleValidate, 800);
      return () => clearTimeout(timer);
    }
  }, [canSubmit, validating, success, error]);

  const handleSuccessComplete = () => {
    onComplete({
      token: token.trim(),
      signingKey: signingKey.trim(),
    });
  };

  // Show success state
  if (success) {
    return (
      <StepCard glowColor="orange">
        <SuccessCheckmark
          message="QStash configurado!"
          onComplete={handleSuccessComplete}
        />
      </StepCard>
    );
  }

  return (
    <StepCard glowColor="orange" className="relative">
      <ValidatingOverlay
        isVisible={validating}
        message="Verificando QStash..."
        subMessage="Validando credenciais"
      />

      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        <ServiceIcon service="qstash" size="lg" />

        {/* Title */}
        <h2 className="mt-4 text-xl font-semibold text-zinc-100">
          Configure filas de mensagens
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Token e Signing Key do Upstash QStash
        </p>

        {/* Token Input */}
        <div className="w-full mt-6">
          <TokenInput
            label="QStash Token"
            value={token}
            onChange={(v) => {
              setToken(v);
              setError(null);
              hasTriggeredRef.current = false; // Reset para permitir nova tentativa
            }}
            placeholder="eyJVc2VySUQi... ou qstash_..."
            minLength={30}
            accentColor="orange"
            showCharCount={false}
          />
        </div>

        {/* Signing Key Input */}
        <div className="w-full mt-4">
          <TokenInput
            label="Current Signing Key"
            value={signingKey}
            onChange={(v) => {
              setSigningKey(v);
              setError(null);
              hasTriggeredRef.current = false; // Reset para permitir nova tentativa
            }}
            placeholder="sig_xxxxxxxxxxxxxxxx"
            minLength={30}
            accentColor="orange"
            showCharCount={false}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        {/* Help link */}
        <a
          href="https://console.upstash.com/qstash"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-orange-400 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Onde encontrar no console Upstash?
        </a>
      </div>
    </StepCard>
  );
}
