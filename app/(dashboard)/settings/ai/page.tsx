'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Coins,
  FileText,
  FormInput,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Page, PageActions, PageDescription, PageHeader, PageTitle } from '@/components/ui/page'
import { AI_PROVIDERS, type AIProvider } from '@/lib/ai/providers'
import {
  DEFAULT_AI_FALLBACK,
  DEFAULT_AI_PROMPTS,
  DEFAULT_AI_ROUTES,
  type AiFallbackConfig,
  type AiPromptsConfig,
  type AiRoutesConfig,
} from '@/lib/ai/ai-center-defaults'
import { settingsService } from '@/services'
import { toast } from 'sonner'

type PromptItem = {
  id: string
  valueKey: keyof AiPromptsConfig
  routeKey?: keyof AiRoutesConfig
  title: string
  description: string
  path: string
  variables: string[]
  rows?: number
  Icon: typeof FileText
}

type ProviderStatus = {
  isConfigured: boolean
  source: 'database' | 'env' | 'none'
  tokenPreview?: string | null
}

type AIConfigResponse = {
  provider: AIProvider
  model: string
  providers: {
    google: ProviderStatus
    openai: ProviderStatus
    anthropic: ProviderStatus
  }
  routes: AiRoutesConfig
  prompts: AiPromptsConfig
  fallback: AiFallbackConfig
}

const EMPTY_PROVIDER_STATUS: ProviderStatus = {
  isConfigured: false,
  source: 'none',
  tokenPreview: null,
}

const PROMPTS: PromptItem[] = [
  {
    id: 'template-short',
    valueKey: 'templateShort',
    routeKey: 'generateTemplate',
    title: 'Mensagem curta (WhatsApp)',
    description: 'Usado para gerar textos rápidos de campanha.',
    path: '/lib/ai/prompts/template-short.ts',
    variables: ['{{prompt}}', '{{1}}'],
    rows: 7,
    Icon: MessageSquareText,
  },
  {
    id: 'utility-templates',
    valueKey: 'utilityGenerationTemplate',
    routeKey: 'generateUtilityTemplates',
    title: 'Templates UTILITY (geração)',
    description: 'Gera templates aprováveis pela Meta usando variáveis.',
    path: '/lib/ai/prompts/utility-generator.ts',
    variables: ['{{prompt}}', '{{quantity}}', '{{language}}', '{{primaryUrl}}'],
    rows: 18,
    Icon: Wand2,
  },
  {
    id: 'ai-judge',
    valueKey: 'utilityJudgeTemplate',
    title: 'AI Judge (classificação)',
    description: 'Analisa se o template é UTILITY ou MARKETING e sugere correções.',
    path: '/lib/ai/prompts/utility-judge.ts',
    variables: ['{{header}}', '{{body}}'],
    rows: 18,
    Icon: ShieldCheck,
  },
  {
    id: 'flow-form',
    valueKey: 'flowFormTemplate',
    routeKey: 'generateFlowForm',
    title: 'MiniApp Form (JSON)',
    description: 'Gera o formulário para MiniApps (WhatsApp Flow) em JSON estrito.',
    path: '/lib/ai/prompts/flow-form.ts',
    variables: ['{{prompt}}', '{{titleHintBlock}}', '{{maxQuestions}}'],
    rows: 18,
    Icon: FormInput,
  },
]

const getProviderConfig = (providerId: AIProvider) =>
  AI_PROVIDERS.find((provider) => provider.id === providerId)

const getProviderLabel = (providerId: AIProvider) =>
  getProviderConfig(providerId)?.name ?? providerId

const getDefaultModelId = (providerId: AIProvider) =>
  getProviderConfig(providerId)?.models[0]?.id ?? ''

const getModelLabel = (providerId: AIProvider, modelId: string) => {
  const provider = getProviderConfig(providerId)
  return provider?.models.find((model) => model.id === modelId)?.name ?? modelId
}

const getSafeProvider = (provider?: string): AIProvider =>
  getProviderConfig(provider as AIProvider)?.id ?? 'google'

const getModelOptions = (providerId: AIProvider, currentModelId: string) => {
  const provider = getProviderConfig(providerId)
  const models = provider?.models ?? []
  if (currentModelId && !models.some((model) => model.id === currentModelId)) {
    return [...models, { id: currentModelId, name: currentModelId }]
  }
  return models
}

const normalizeProviderOrder = (order: AIProvider[]) => {
  const uniqueOrder = Array.from(new Set(order))
  const missing = AI_PROVIDERS.map((provider) => provider.id).filter(
    (provider) => !uniqueOrder.includes(provider)
  )
  return [...uniqueOrder, ...missing]
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'emerald' | 'amber' | 'red' | 'zinc'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
      : tone === 'amber'
        ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
        : tone === 'red'
          ? 'text-red-300 border-red-500/30 bg-red-500/10'
          : 'text-zinc-300 border-white/10 bg-white/5'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}

function MockSwitch({
  on,
  onToggle,
  disabled,
  label,
}: {
  on?: boolean
  onToggle?: (next: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onToggle?.(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
        on ? 'border-emerald-500/40 bg-emerald-500/20' : 'border-white/10 bg-white/5'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span
        className={`inline-block size-4 rounded-full transition ${
          on ? 'translate-x-6 bg-emerald-300' : 'translate-x-1 bg-white/50'
        }`}
      />
    </button>
  )
}

function PromptCard({
  item,
  value,
  onChange,
  routeEnabled,
  onToggleRoute,
}: {
  item: PromptItem
  value: string
  onChange: (next: string) => void
  routeEnabled?: boolean
  onToggleRoute?: (next: boolean) => void
}) {
  const Icon = item.Icon
  const [isOpen, setIsOpen] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Prompt copiado')
    } catch (error) {
      console.error('Failed to copy prompt:', error)
      toast.error('Nao foi possivel copiar o prompt')
    }
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 text-left">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white">
            <Icon className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{item.title}</div>
            <div className="mt-1 text-xs text-gray-400">{item.description}</div>
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-gray-400">
              {item.path}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {routeEnabled !== undefined && onToggleRoute && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{routeEnabled ? 'Ativa' : 'Desativada'}</span>
              <MockSwitch on={routeEnabled} onToggle={onToggleRoute} label="Ativar rota" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition hover:bg-white/10"
            aria-expanded={isOpen}
          >
            {isOpen ? 'Fechar' : 'Editar'}
            {isOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <div className="mt-4">
            <textarea
              className="min-h-[160px] w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-gray-200 outline-none transition focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10"
              rows={item.rows ?? 6}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
            <div className="flex flex-wrap gap-2">
              <span className="font-medium text-gray-300">Variáveis:</span>
              {item.variables.map((v) => (
                <span
                  key={v}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5"
                >
                  {v}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-white transition hover:bg-white/10"
              onClick={handleCopy}
            >
              Copiar prompt
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function AICenterPage() {
  const [providerStatuses, setProviderStatuses] = useState<AIConfigResponse['providers']>({
    google: EMPTY_PROVIDER_STATUS,
    openai: EMPTY_PROVIDER_STATUS,
    anthropic: EMPTY_PROVIDER_STATUS,
  })
  const [provider, setProvider] = useState<AIProvider>('google')
  const [model, setModel] = useState(() => getDefaultModelId('google'))
  const [routes, setRoutes] = useState<AiRoutesConfig>(DEFAULT_AI_ROUTES)
  const [prompts, setPrompts] = useState<AiPromptsConfig>(DEFAULT_AI_PROMPTS)
  const [fallback, setFallback] = useState<AiFallbackConfig>(DEFAULT_AI_FALLBACK)
  const [inlineKeyProvider, setInlineKeyProvider] = useState<AIProvider | null>(null)
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<AIProvider, string>>({
    google: '',
    openai: '',
    anthropic: '',
  })
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const orderedProviders = useMemo(
    () => normalizeProviderOrder(fallback.order),
    [fallback.order]
  )
  const hasSecondaryKey = useMemo(() => {
    return Object.entries(providerStatuses).some(([providerId, status]) => {
      return providerId !== provider && status.isConfigured
    })
  }, [providerStatuses, provider])
  const primaryProviderLabel = useMemo(() => getProviderLabel(provider), [provider])
  const primaryModelLabel = useMemo(
    () => (model ? getModelLabel(provider, model) : '—'),
    [provider, model]
  )
  const primaryProviderStatus = providerStatuses[provider] ?? EMPTY_PROVIDER_STATUS
  const primaryProviderConfigured = primaryProviderStatus.isConfigured

  const fallbackSummary = useMemo(() => {
    if (!fallback.enabled || orderedProviders.length === 0) {
      return 'Desativado'
    }
    return orderedProviders.map((item) => getProviderLabel(item)).join(' -> ')
  }, [fallback.enabled, orderedProviders])

  const primaryModelOptions = useMemo(
    () => getModelOptions(provider, model),
    [provider, model]
  )

  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const data = (await settingsService.getAIConfig()) as AIConfigResponse
      const nextProvider = getSafeProvider(data.provider)
      const nextModel = data.model?.trim() ? data.model : getDefaultModelId(nextProvider)
      const fallbackFromApi = data.fallback ?? DEFAULT_AI_FALLBACK
      const allowedProviders = AI_PROVIDERS.map((item) => item.id)
      const fallbackOrder = Array.isArray(fallbackFromApi.order)
        ? fallbackFromApi.order.filter((item) => allowedProviders.includes(item))
        : []
      const normalizedFallbackOrder = normalizeProviderOrder(
        fallbackOrder.length > 0 ? fallbackOrder : DEFAULT_AI_FALLBACK.order
      )
      const fallbackModels = {
        ...DEFAULT_AI_FALLBACK.models,
        ...(fallbackFromApi.models || {}),
      }

      setProvider(nextProvider)
      setModel(nextModel)
      setRoutes({ ...DEFAULT_AI_ROUTES, ...(data.routes ?? {}) })
      setPrompts({ ...DEFAULT_AI_PROMPTS, ...(data.prompts ?? {}) })
      setFallback({
        ...DEFAULT_AI_FALLBACK,
        ...fallbackFromApi,
        order: normalizedFallbackOrder,
        models: fallbackModels,
      })
      setProviderStatuses({
        google: data.providers?.google ?? EMPTY_PROVIDER_STATUS,
        openai: data.providers?.openai ?? EMPTY_PROVIDER_STATUS,
        anthropic: data.providers?.anthropic ?? EMPTY_PROVIDER_STATUS,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao carregar configuracoes de IA'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!hasSecondaryKey && fallback.enabled) {
      setFallback((current) => ({ ...current, enabled: false }))
    }
  }, [hasSecondaryKey, fallback.enabled])

  const handleProviderSelect = (nextProvider: AIProvider) => {
    setProvider(nextProvider)
    setModel(getDefaultModelId(nextProvider))
    setFallback((current) => {
      const currentOrder = normalizeProviderOrder(current.order)
      return {
        ...current,
        order: [nextProvider, ...currentOrder.filter((item) => item !== nextProvider)],
      }
    })
  }

  const handleFallbackMove = (target: AIProvider, direction: -1 | 1) => {
    setFallback((current) => {
      const currentOrder = normalizeProviderOrder(current.order)
      const index = currentOrder.indexOf(target)
      if (index < 0) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= currentOrder.length) return current
      const nextOrder = [...currentOrder]
      ;[nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]]
      return { ...current, order: nextOrder }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await settingsService.saveAIConfig({
        provider,
        model,
        routes,
        prompts,
        fallback,
      })
      toast.success('Configuracoes salvas')
      await loadConfig()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao salvar configuracoes'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRestore = () => {
    setProvider('google')
    setModel(getDefaultModelId('google'))
    setRoutes({ ...DEFAULT_AI_ROUTES })
    setPrompts({ ...DEFAULT_AI_PROMPTS })
    setFallback({ ...DEFAULT_AI_FALLBACK })
    setErrorMessage(null)
    toast.success('Padroes restaurados. Clique em Salvar para aplicar.')
  }

  const handleSaveKey = async (targetProvider: AIProvider) => {
    const apiKey = apiKeyDrafts[targetProvider].trim()
    if (!apiKey) {
      toast.error('Informe a chave de API')
      return
    }
    setIsSavingKey(true)
    try {
      await settingsService.saveAIConfig({
        apiKey,
        apiKeyProvider: targetProvider,
      })
      setApiKeyDrafts((current) => ({ ...current, [targetProvider]: '' }))
      setInlineKeyProvider(null)
      toast.success('Chave atualizada')
      await loadConfig()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar chave'
      toast.error(message)
    } finally {
      setIsSavingKey(false)
    }
  }

  return (
    <Page>
      <PageHeader>
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-300/70">
            <Sparkles className="size-4" />
            Central de IA
          </div>
          <PageTitle>Central de IA</PageTitle>
          <PageDescription>
            Escolha o modelo, publique as rotas. O resto fica invisível.
          </PageDescription>
        </div>
        <PageActions>
          <button
            type="button"
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleRestore}
            disabled={isLoading || isSaving}
          >
            Restaurar
          </button>
          <button
            type="button"
            className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </PageActions>
      </PageHeader>

      {errorMessage && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">Status</div>
            <StatusPill
              label={primaryProviderConfigured ? 'Ativo' : 'Sem chave'}
              tone={primaryProviderConfigured ? 'emerald' : 'amber'}
            />
          </div>
          <div className="mt-4 flex items-center gap-3 text-white">
            <Bot className="size-6 text-emerald-300" />
            <div>
              <div className="text-base font-semibold">{primaryProviderLabel}</div>
              <div className="text-xs text-gray-400">Modelo: {primaryModelLabel}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">Custo 30 dias</div>
            <Coins className="size-4 text-amber-300" />
          </div>
          <div className="mt-4 text-2xl font-semibold text-white">R$ 312,40</div>
          <div className="text-xs text-gray-400">Últimos 30 dias</div>
        </div>
      </div>

      <div className="space-y-6">
        <section className="glass-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">Modelo principal</h3>
              <p className="text-sm text-gray-400">Escolha o modelo para produção.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Fallback automático: {fallbackSummary}</span>
              <MockSwitch
                on={fallback.enabled}
                onToggle={(next) => setFallback((current) => ({ ...current, enabled: next }))}
                disabled={!hasSecondaryKey}
                label="Ativar fallback"
              />
              {!hasSecondaryKey && (
                <span className="text-[11px] text-amber-300/80">
                  Adicione outra chave para ativar.
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {orderedProviders.map((providerId, index) => {
              const item = getProviderConfig(providerId)
              if (!item) return null
              const isActive = item.id === provider
              const status = providerStatuses[item.id] ?? EMPTY_PROVIDER_STATUS
              const isInlineEditing = inlineKeyProvider === item.id
              const statusLabel = isActive
                ? status.isConfigured
                  ? 'Em uso'
                  : 'Sem chave'
                : status.isConfigured
                  ? 'Disponível'
                  : 'Inativa'
              const statusTone =
                status.isConfigured && isActive
                  ? 'emerald'
                  : status.isConfigured
                    ? 'zinc'
                    : 'red'
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 ${
                    isActive
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-white/10 bg-zinc-900/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col items-center gap-1 text-xs text-gray-500">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                        onClick={() => handleFallbackMove(item.id, -1)}
                        disabled={index === 0}
                        aria-label="Mover para cima"
                      >
                        <ChevronUp className="size-3" />
                      </button>
                      <span className="text-[11px] font-medium text-gray-400">{index + 1}</span>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                        onClick={() => handleFallbackMove(item.id, 1)}
                        disabled={index === orderedProviders.length - 1}
                        aria-label="Mover para baixo"
                      >
                        <ChevronDown className="size-3" />
                      </button>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{item.name}</div>
                        <div className="text-xs text-gray-400">
                          Modelo: {isActive ? primaryModelLabel : item.models[0]?.name ?? '—'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill label={statusLabel} tone={statusTone} />
                      {isActive ? (
                        <button
                          type="button"
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
                          onClick={() =>
                            setInlineKeyProvider((current) => (current === item.id ? null : item.id))
                          }
                        >
                          {isInlineEditing
                            ? 'Cancelar'
                            : status.isConfigured
                              ? 'Atualizar chave'
                              : 'Adicionar chave'}
                        </button>
                      ) : status.isConfigured ? (
                        <button
                          type="button"
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
                          onClick={() => handleProviderSelect(item.id)}
                        >
                          Definir como padrão
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
                          onClick={() =>
                            setInlineKeyProvider((current) => (current === item.id ? null : item.id))
                          }
                        >
                          {isInlineEditing ? 'Cancelar' : 'Adicionar chave'}
                        </button>
                      )}
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <div className="mt-4">
                      <label className="text-xs text-gray-500">Selecionar modelo</label>
                      <div className="relative mt-2">
                        <select
                          value={model}
                          onChange={(event) => {
                            const nextModel = event.target.value
                            setModel(nextModel)
                            setFallback((current) => ({
                              ...current,
                              models: {
                                ...current.models,
                                [provider]: nextModel,
                              },
                            }))
                          }}
                          disabled={!status.isConfigured}
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {primaryModelOptions.map((modelOption) => (
                            <option key={modelOption.id} value={modelOption.id}>
                              {modelOption.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {isInlineEditing && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <input
                        type="password"
                        placeholder="Chave de API"
                        value={apiKeyDrafts[item.id]}
                        onChange={(event) =>
                          setApiKeyDrafts((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500/40"
                      />
                      <button
                        type="button"
                        className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleSaveKey(item.id)}
                        disabled={isSavingKey || !apiKeyDrafts[item.id].trim()}
                      >
                        {isSavingKey ? 'Salvando...' : 'Salvar chave'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Wand2 className="size-4 text-emerald-300" />
                Prompts do sistema
              </div>
              <p className="text-sm text-gray-400">Edite os prompts sem sair daqui.</p>
            </div>
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              {PROMPTS.length} prompts configuráveis
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {PROMPTS.map((item) => (
              <PromptCard
                key={item.id}
                item={item}
                value={prompts[item.valueKey] ?? ''}
                onChange={(nextValue) =>
                  setPrompts((current) => ({
                    ...current,
                    [item.valueKey]: nextValue,
                  }))
                }
                routeEnabled={item.routeKey ? routes[item.routeKey] : undefined}
                onToggleRoute={
                  item.routeKey
                    ? (next) =>
                        setRoutes((current) => ({
                          ...current,
                          [item.routeKey as keyof AiRoutesConfig]: next,
                        }))
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      </div>
    </Page>
  )
}
