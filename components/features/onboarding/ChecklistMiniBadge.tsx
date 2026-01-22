'use client';

import React from 'react';
import { ClipboardList } from 'lucide-react';
import { useOnboardingProgress } from './hooks/useOnboardingProgress';
import { cn } from '@/lib/utils';

interface ChecklistMiniBadgeProps {
  onClick?: () => void;
}

export function ChecklistMiniBadge({ onClick }: ChecklistMiniBadgeProps) {
  const {
    progress,
    checklistProgress,
    shouldShowChecklist,
    minimizeChecklist,
  } = useOnboardingProgress();

  // Mostra o badge se:
  // 1. O checklist deveria estar visível mas está minimizado, OU
  // 2. O checklist foi dismissado mas ainda tem itens pendentes
  const shouldShowBadge =
    (shouldShowChecklist && progress.isChecklistMinimized) ||
    (progress.isChecklistDismissed && checklistProgress.percentage < 100);

  if (!shouldShowBadge) {
    return null;
  }

  const pendingCount = checklistProgress.total - checklistProgress.completed;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Se clicou e estava minimizado, expande
      if (progress.isChecklistMinimized) {
        minimizeChecklist(false);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative p-2 rounded-lg transition-colors',
        'text-zinc-400 hover:text-white hover:bg-zinc-800',
        pendingCount > 0 && 'text-amber-400 hover:text-amber-300'
      )}
      title={`${pendingCount} tarefa${pendingCount !== 1 ? 's' : ''} pendente${pendingCount !== 1 ? 's' : ''}`}
    >
      <ClipboardList className="w-5 h-5" />

      {/* Badge com número */}
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center">
          {pendingCount}
        </span>
      )}
    </button>
  );
}
