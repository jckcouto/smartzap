'use client';

import React from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Minimize2,
  X,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboardingProgress } from './hooks/useOnboardingProgress';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: keyof ReturnType<typeof useOnboardingProgress>['progress']['checklistItems'];
  label: string;
  description?: string;
  actionLabel?: string;
  actionUrl?: string;
  isComplete: boolean;
}

interface OnboardingChecklistProps {
  tokenExpiresIn?: string | null;
  onNavigate?: (path: string) => void;
}

export function OnboardingChecklist({ tokenExpiresIn, onNavigate }: OnboardingChecklistProps) {
  const {
    progress,
    checklistProgress,
    shouldShowChecklist,
    minimizeChecklist,
    dismissChecklist,
    updateChecklistItem,
  } = useOnboardingProgress();

  if (!shouldShowChecklist || progress.isChecklistMinimized) {
    return null;
  }

  const items: ChecklistItem[] = [
    {
      id: 'credentials',
      label: 'Conectar credenciais do WhatsApp',
      isComplete: progress.checklistItems.credentials,
    },
    {
      id: 'testMessage',
      label: 'Enviar mensagem de teste',
      description: 'Verifique se o envio está funcionando',
      actionLabel: 'Testar',
      actionUrl: '/settings',
      isComplete: progress.checklistItems.testMessage,
    },
    {
      id: 'webhook',
      label: 'Configurar webhook',
      description: 'Receba notificações de entrega e leitura',
      actionLabel: 'Configurar',
      actionUrl: '/settings',
      isComplete: progress.checklistItems.webhook,
    },
    {
      id: 'permanentToken',
      label: 'Criar token permanente (System User)',
      description: 'Evite interrupções quando o token expirar',
      actionLabel: 'Criar',
      actionUrl: 'https://business.facebook.com/settings/system-users',
      isComplete: progress.checklistItems.permanentToken,
    },
  ];

  const showTokenWarning = tokenExpiresIn && !progress.checklistItems.permanentToken;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white">Complete sua configuração</h3>
          <span className="text-sm text-zinc-500">
            {checklistProgress.percentage}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => minimizeChecklist(true)}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Minimizar"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={dismissChecklist}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${checklistProgress.percentage}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg transition-colors',
              item.isComplete ? 'bg-zinc-800/30' : 'bg-zinc-800/50 hover:bg-zinc-800/70'
            )}
          >
            <div className="flex items-center gap-3">
              {item.isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-zinc-600 flex-shrink-0" />
              )}
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    item.isComplete ? 'text-zinc-500 line-through' : 'text-white'
                  )}
                >
                  {item.label}
                </p>
                {item.description && !item.isComplete && (
                  <p className="text-xs text-zinc-500">{item.description}</p>
                )}
              </div>
            </div>

            {!item.isComplete && item.actionLabel && (
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => {
                  if (item.actionUrl?.startsWith('http')) {
                    window.open(item.actionUrl, '_blank');
                  } else if (item.actionUrl && onNavigate) {
                    onNavigate(item.actionUrl);
                  }
                }}
              >
                {item.actionLabel}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Token warning */}
      {showTokenWarning && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-amber-200">
                Seu token expira em <strong>{tokenExpiresIn}</strong>.
                Crie um token permanente para evitar interrupções.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10 flex-shrink-0"
              onClick={() => {
                window.open('https://business.facebook.com/settings/system-users', '_blank');
              }}
            >
              Criar agora
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
