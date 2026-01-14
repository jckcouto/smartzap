'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { WizardStepCredentialsProps } from './types';

export function WizardStepCredentials({
  calendarCredsStatus,
  calendarCredsLoading,
  calendarCredsSaving,
  calendarClientIdDraft,
  calendarClientSecretDraft,
  calendarBaseUrl,
  calendarBaseUrlDraft,
  calendarBaseUrlEditing,
  calendarRedirectUrl,
  calendarClientIdValid,
  calendarClientSecretValid,
  calendarCredsFormValid,
  calendarCredsSourceLabel,
  setCalendarClientIdDraft,
  setCalendarClientSecretDraft,
  setCalendarBaseUrlDraft,
  setCalendarBaseUrlEditing,
  handleSaveCalendarCreds,
  handleRemoveCalendarCreds,
  handleCopyCalendarValue,
}: WizardStepCredentialsProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">1) Credenciais</div>
          <div className="text-xs text-gray-400">Cole o Client ID e o Client Secret.</div>
          {calendarCredsStatus && (
            <div className="mt-1 text-[11px] text-gray-500">Fonte: {calendarCredsSourceLabel}</div>
          )}
        </div>
        {calendarCredsStatus?.isConfigured && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">Pronto</span>
        )}
      </div>

      {calendarCredsLoading ? (
        <div className="mt-3 text-xs text-gray-400">Carregando credenciais...</div>
      ) : (
        <>
          {!calendarCredsStatus?.isConfigured && (
            <div className="mt-3 text-xs text-gray-500">
              Ainda nao configurado.
            </div>
          )}
          {calendarCredsStatus?.source === 'env' && (
            <div className="mt-2 text-[11px] text-amber-200">
              Credenciais vindas do servidor. Salvar aqui sobrescreve no banco.
            </div>
          )}

          <div className="mt-3 rounded-lg border border-white/10 bg-black/40 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
              <span>URL detectada do app</span>
              <button
                type="button"
                onClick={() => setCalendarBaseUrlEditing(!calendarBaseUrlEditing)}
                className="text-emerald-200 hover:text-emerald-100"
              >
                {calendarBaseUrlEditing ? 'OK' : 'Editar'}
              </button>
            </div>
            {calendarBaseUrlEditing ? (
              <input
                type="text"
                value={calendarBaseUrlDraft}
                onChange={(e) => setCalendarBaseUrlDraft(e.target.value)}
                className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-white font-mono"
                placeholder="https://app.seudominio.com"
              />
            ) : (
              <div className="mt-2 text-xs text-white font-mono break-all">{calendarBaseUrl || 'https://seu-dominio.com'}</div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-200 hover:text-emerald-100"
            >
              <ExternalLink size={12} />
              Google Cloud Console
            </a>
            <span className="text-gray-600">|</span>
            <a
              href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-200 hover:text-emerald-100"
            >
              <ExternalLink size={12} />
              Ativar Calendar API
            </a>
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-[11px] text-gray-400">
            <div className="text-[11px] font-semibold text-gray-300">Checklist rapido</div>
            <div className="mt-2 space-y-1">
              <div>1. Ative a Google Calendar API.</div>
              <div>2. Crie credenciais OAuth (aplicacao web).</div>
              <div>3. Cole o Redirect URI abaixo.</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              <div className="text-[11px] text-gray-400">Client ID</div>
              <input
                type="text"
                value={calendarClientIdDraft}
                onChange={(e) => setCalendarClientIdDraft(e.target.value)}
                className="mt-1 w-full bg-transparent text-sm text-white font-mono outline-none"
                placeholder="ex: 1234.apps.googleusercontent.com"
              />
              {!calendarClientIdValid && (
                <div className="mt-1 text-[11px] text-amber-200">Use um Client ID valido.</div>
              )}
            </div>
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              <div className="text-[11px] text-gray-400">Client Secret</div>
              <input
                type="password"
                value={calendarClientSecretDraft}
                onChange={(e) => setCalendarClientSecretDraft(e.target.value)}
                className="mt-1 w-full bg-transparent text-sm text-white font-mono outline-none"
                placeholder="cole seu secret"
              />
              {!calendarClientSecretValid && (
                <div className="mt-1 text-[11px] text-amber-200">Secret parece curto demais.</div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
              <span>Cole em "URIs de redirecionamento autorizados" no Google Cloud</span>
              <button
                type="button"
                onClick={() => handleCopyCalendarValue(calendarRedirectUrl, 'Redirect URI')}
                className="text-emerald-200 hover:text-emerald-100"
              >
                Copiar
              </button>
            </div>
            <div className="mt-2 text-xs text-white font-mono break-all">{calendarRedirectUrl}</div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            {calendarCredsStatus?.source === 'db' && calendarCredsStatus?.isConfigured && (
              <button
                type="button"
                onClick={handleRemoveCalendarCreds}
                disabled={calendarCredsSaving}
                className="h-9 px-4 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-200 hover:bg-red-500/20 transition-colors"
              >
                Remover
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveCalendarCreds}
              disabled={calendarCredsSaving || !calendarCredsFormValid}
              className="h-9 px-4 rounded-lg bg-emerald-500/90 text-white text-xs font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {calendarCredsSaving ? 'Salvando...' : 'Salvar credenciais'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
