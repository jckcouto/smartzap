'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  ListPlus,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  Wand2,
} from 'lucide-react'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  FlowFormFieldType,
  FlowFormOption,
  FlowFormSpecV1,
  generateFlowJsonFromFormSpec,
  flowJsonToFormSpec,
  normalizeFlowFieldName,
  normalizeFlowFormSpec,
  validateFlowFormSpec,
} from '@/lib/flow-form'
import { FLOW_TEMPLATES } from '@/lib/flow-templates'

const FIELD_TYPE_LABEL: Record<FlowFormFieldType, string> = {
  short_text: 'Texto curto',
  long_text: 'Texto longo',
  email: 'E-mail',
  phone: 'Telefone',
  number: 'Número',
  date: 'Data',
  dropdown: 'Lista (dropdown)',
  single_choice: 'Escolha única',
  multi_choice: 'Múltipla escolha',
  optin: 'Opt-in (checkbox)',
}

function newField(type: FlowFormFieldType): any {
  const id = `q_${nanoid(8)}`
  const baseLabel = type === 'optin' ? 'Quero receber novidades' : 'Nova pergunta'
  const baseSlug = normalizeFlowFieldName(baseLabel) || 'campo'
  const suffix = nanoid(4).toLowerCase()
  const name = normalizeFlowFieldName(`${baseSlug}_${suffix}`) || `${baseSlug}_${suffix}`

  const f: any = {
    id,
    type,
    label: baseLabel,
    name,
    required: type === 'optin' ? false : true,
  }

  if (type === 'optin') {
    f.text = 'Quero receber mensagens sobre novidades e promoções.'
  }

  if (type === 'dropdown' || type === 'single_choice' || type === 'multi_choice') {
    f.options = [
      { id: 'opcao_1', title: 'Opção 1' },
      { id: 'opcao_2', title: 'Opção 2' },
    ]
    f.required = false
  }

  if (type === 'date') {
    f.required = true
  }

  return f
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function FlowFormBuilder(props: {
  flowName: string
  currentSpec: unknown
  isSaving: boolean
  showHeaderActions?: boolean
  showTechFields?: boolean
  registerActions?: (actions: { openAI: () => void; openTemplate: () => void; setScreenId: (value: string) => void }) => void
  onActionComplete?: () => void
  onSave: (patch: { spec: unknown; flowJson: unknown }) => void
  onPreviewChange?: (payload: {
    form: FlowFormSpecV1
    generatedJson: unknown
    issues: string[]
    dirty: boolean
  }) => void
}) {
  const initialForm = useMemo(() => {
    const s = (props.currentSpec as any) || {}
    return normalizeFlowFormSpec(s?.form, props.flowName)
  }, [props.currentSpec, props.flowName])

  const [form, setForm] = useState<FlowFormSpecV1>(initialForm)
  const [dirty, setDirty] = useState(false)

  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('')
  const [showIntro, setShowIntro] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  const showHeaderActions = props.showHeaderActions !== false
  const showTechFields = props.showTechFields !== false
  const questionRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (!props.registerActions) return
    props.registerActions({
      openAI: () => setAiOpen(true),
      openTemplate: () => {
        if (!selectedTemplateKey && FLOW_TEMPLATES.length > 0) {
          setSelectedTemplateKey(FLOW_TEMPLATES[0].key)
        }
        setTemplateOpen(true)
      },
      setScreenId: (value: string) => update({ screenId: value }),
    })
  }, [props, selectedTemplateKey])

  useEffect(() => {
    if (dirty) return
    setForm(initialForm)
  }, [dirty, initialForm])

  useEffect(() => {
    if (!props.flowName) return
    setForm((prev) => {
      if (prev.title === props.flowName) return prev
      return { ...prev, title: props.flowName }
    })
  }, [props.flowName])

  useEffect(() => {
    if (!lastAddedId) return
    const target = questionRefs.current[lastAddedId]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.focus()
    }
    setLastAddedId(null)
  }, [lastAddedId])

  useEffect(() => {
    if (!form.intro) return
    setShowIntro(true)
  }, [form.intro])

  const issues = useMemo(() => validateFlowFormSpec(form), [form])
  const generatedJson = useMemo(() => generateFlowJsonFromFormSpec(form), [form])

  useEffect(() => {
    props.onPreviewChange?.({
      form,
      generatedJson,
      issues,
      dirty,
    })
  }, [dirty, form, generatedJson, issues, props.onPreviewChange])

  const canSave = issues.length === 0 && dirty && !props.isSaving

  const generateWithAI = async () => {
    if (aiLoading) return
    if (!aiPrompt.trim() || aiPrompt.trim().length < 10) {
      toast.error('Descreva melhor o que você quer (mínimo 10 caracteres)')
      return
    }

    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/generate-flow-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          titleHint: props.flowName,
          maxQuestions: 10,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = (data?.error && String(data.error)) || 'Falha ao gerar formulário com IA'
        const details = data?.details ? `: ${String(data.details)}` : ''
        throw new Error(`${msg}${details}`)
      }

      const generatedForm = (data?.form || null) as FlowFormSpecV1 | null
      if (!generatedForm) throw new Error('Resposta inválida da IA (form ausente)')

      // Mantém o screenId atual, pois costuma ser usado no mapeamento/meta.
      setForm((prev) => ({ ...generatedForm, screenId: prev.screenId || generatedForm.screenId }))
      setDirty(true)
      toast.success('Formulário gerado! Revise e salve quando estiver pronto.')
      setAiOpen(false)
      props.onActionComplete?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar formulário com IA')
    } finally {
      setAiLoading(false)
    }
  }

  const update = (patch: Partial<FlowFormSpecV1>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const updateField = (idx: number, patch: any) => {
    setForm((prev) => {
      const fields = [...prev.fields]
      fields[idx] = { ...fields[idx], ...patch }
      return { ...prev, fields }
    })
    setDirty(true)
  }

  const addField = (type: FlowFormFieldType) => {
    const nextField = newField(type)
    setForm((prev) => ({ ...prev, fields: [...prev.fields, nextField] }))
    setDirty(true)
    setLastAddedId(nextField.id)
  }

  const duplicateField = (idx: number) => {
    setForm((prev) => {
      const f = prev.fields[idx]
      const copy = {
        ...f,
        id: `q_${nanoid(8)}`,
        name: normalizeFlowFieldName(`${f.name}_copy_${nanoid(3)}`) || `campo_${nanoid(4)}`,
      }
      const fields = [...prev.fields]
      fields.splice(idx + 1, 0, copy)
      return { ...prev, fields }
    })
    setDirty(true)
  }

  const removeField = (idx: number) => {
    setForm((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }))
    setDirty(true)
  }

  const save = () => {
    const baseSpec = (props.currentSpec && typeof props.currentSpec === 'object') ? (props.currentSpec as any) : {}
    const nextForm = { ...form, title: (props.flowName || form.title || 'Flow').trim() || 'Flow' }
    const nextSpec = { ...baseSpec, form: nextForm }

    props.onSave({
      spec: nextSpec,
      flowJson: generateFlowJsonFromFormSpec(nextForm),
    })
    setDirty(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        {showHeaderActions ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-zinc-950/40 hover:bg-white/5"
              onClick={() => setAiOpen(true)}
            >
              <Wand2 className="h-4 w-4" />
              Gerar com IA
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-zinc-950/40 hover:bg-white/5"
              onClick={() => {
                if (!selectedTemplateKey && FLOW_TEMPLATES.length > 0) {
                  setSelectedTemplateKey(FLOW_TEMPLATES[0].key)
                }
                setTemplateOpen(true)
              }}
            >
              Importar modelo
            </Button>
          </>
        ) : null}
      </div>

      <div className="space-y-4">
        {showIntro ? (
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Boas-vindas</label>
            <Textarea
              value={form.intro || ''}
              onChange={(e) => update({ intro: e.target.value })}
              className="min-h-20"
              placeholder="Ex: Preencha os dados abaixo."
            />
          </div>
        ) : null}

        {showTechFields ? (
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Screen ID (Meta)</label>
            <Input value={form.screenId} onChange={(e) => update({ screenId: e.target.value.toUpperCase() })} />
            <div className="text-[11px] text-gray-500 mt-1">Ex: CADASTRO, NPS, AGENDAMENTO</div>
          </div>
        ) : null}
      </div>

      {showTechFields ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
          <div className="text-sm font-semibold text-white">Status</div>
          <div className="mt-2 text-sm text-gray-400">
            {dirty ? 'Alterações não salvas' : 'Sincronizado'}
            {issues.length === 0 ? (
              <span className="text-emerald-300"> • pronto</span>
            ) : (
              <span className="text-amber-300"> • revisar</span>
            )}
          </div>

          <div className="mt-3 text-[11px] text-gray-500">
            Este modo cria o JSON no padrão usado pelos templates internos (sem endpoint).
          </div>

          <Button type="button" className="mt-3 w-full bg-white text-black hover:bg-gray-200" disabled={!canSave} onClick={save}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      ) : null}

      <div className="border-t border-white/10 pt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <ListPlus className="h-4 w-4" />
            Perguntas
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" className="bg-white text-black hover:bg-gray-200">
                <Plus className="h-4 w-4" />
                Adicionar pergunta
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white min-w-56">
              {Object.entries(FIELD_TYPE_LABEL).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => addField(key as FlowFormFieldType)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {issues.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-medium">Ajustes necessários</div>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-amber-200/80">
                {issues.slice(0, 6).map((i, idx) => (
                  <li key={`${i}__${idx}`}>{i}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {form.fields.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/40 px-6 py-8 text-center text-gray-400">
            <div className="text-sm text-gray-300">Crie a primeira pergunta para começar sua MiniApp.</div>
          </div>
        ) : (
          <div className="divide-y divide-white/10 mt-4">
            {form.fields.map((f, idx) => {
              const showOptions = f.type === 'dropdown' || f.type === 'single_choice' || f.type === 'multi_choice'
              return (
                <div key={f.id} className="py-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Pergunta</label>
                          <Input
                            value={f.label}
                            onChange={(e) => {
                              const nextLabel = e.target.value
                              const suggested = normalizeFlowFieldName(nextLabel)
                              updateField(idx, {
                                label: nextLabel,
                                // Só auto-ajusta se o usuário ainda não editou muito o name
                                name: f.name ? f.name : suggested,
                              })
                            }}
                            placeholder="Digite a pergunta"
                            ref={(el) => {
                              questionRefs.current[f.id] = el
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Tipo</label>
                          <Select
                            value={f.type}
                            onValueChange={(v) => {
                              const nextType = v as FlowFormFieldType
                              const base: any = { type: nextType }
                              if (nextType === 'optin') {
                                base.required = false
                                base.text = f.text || 'Quero receber mensagens.'
                                delete base.options
                              }
                              if (nextType === 'dropdown' || nextType === 'single_choice' || nextType === 'multi_choice') {
                                base.required = false
                                base.options = (f.options && f.options.length > 0) ? f.options : [
                                  { id: 'opcao_1', title: 'Opção 1' },
                                  { id: 'opcao_2', title: 'Opção 2' },
                                ]
                              }
                              if (nextType === 'date') {
                                base.required = true
                                delete base.options
                              }
                              updateField(idx, base)
                            }}
                          >
                            <SelectTrigger className="bg-zinc-950/40 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(FIELD_TYPE_LABEL).map(([k, label]) => (
                                <SelectItem key={k} value={k}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Identificador (name)</label>
                          <Input
                            value={f.name}
                            onChange={(e) => updateField(idx, { name: normalizeFlowFieldName(e.target.value) })}
                          />
                          <div className="text-[11px] text-gray-500 mt-1">Isso vira a chave no response_json.</div>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950/40 px-3 py-2">
                          <div>
                            <div className="text-xs font-medium text-gray-300">Obrigatório</div>
                            <div className="text-[11px] text-gray-500">O usuário precisa preencher</div>
                          </div>
                          <Switch
                            checked={!!f.required}
                            onCheckedChange={(checked) => updateField(idx, { required: checked })}
                            disabled={f.type === 'optin'}
                          />
                        </div>
                      </div>

                      {f.type === 'optin' ? (
                        <div className="mt-3">
                          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Texto do opt-in</label>
                          <Textarea
                            value={f.text || ''}
                            onChange={(e) => updateField(idx, { text: e.target.value })}
                            className="min-h-18"
                          />
                        </div>
                      ) : null}

                      {showOptions ? (
                        <div className="mt-3">
                          <div className="flex items-center justify-between gap-2">
                            <label className="block text-xs uppercase tracking-widest text-gray-500">Opções</label>
                            <Button
                              type="button"
                              variant="secondary"
                              className="bg-zinc-950/40 border border-white/10 text-gray-200 hover:text-white hover:bg-white/5"
                              onClick={() => {
                                const next = [...(f.options || [])]
                                const n = next.length + 1
                                next.push({ id: `opcao_${n}`, title: `Opção ${n}` })
                                updateField(idx, { options: next })
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Adicionar opção
                            </Button>
                          </div>

                          <div className="mt-2 space-y-2">
                            {(f.options || []).map((opt: FlowFormOption, oidx: number) => (
                              <div key={`${f.id}_${oidx}`} className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2 items-center">
                                <Input
                                  value={opt.id}
                                  onChange={(e) => {
                                    const next = [...(f.options || [])]
                                    next[oidx] = { ...next[oidx], id: normalizeFlowFieldName(e.target.value) || next[oidx].id }
                                    updateField(idx, { options: next })
                                  }}
                                  className="font-mono text-xs"
                                  placeholder="id"
                                />
                                <Input
                                  value={opt.title}
                                  onChange={(e) => {
                                    const next = [...(f.options || [])]
                                    next[oidx] = { ...next[oidx], title: e.target.value }
                                    updateField(idx, { options: next })
                                  }}
                                  placeholder="Título"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="border-white/10 bg-zinc-950/40 hover:bg-white/5"
                                  onClick={() => {
                                    const next = (f.options || []).filter((_, i) => i !== oidx)
                                    updateField(idx, { options: next })
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-zinc-950/40 hover:bg-white/5"
                        disabled={idx === 0}
                        onClick={() => {
                          setForm((prev) => ({ ...prev, fields: moveItem(prev.fields, idx, Math.max(0, idx - 1)) }))
                          setDirty(true)
                        }}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-zinc-950/40 hover:bg-white/5"
                        disabled={idx === form.fields.length - 1}
                        onClick={() => {
                          setForm((prev) => ({ ...prev, fields: moveItem(prev.fields, idx, Math.min(prev.fields.length - 1, idx + 1)) }))
                          setDirty(true)
                        }}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-zinc-950/40 hover:bg-white/5"
                        onClick={() => duplicateField(idx)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-500/20 bg-zinc-900 hover:bg-red-500/10"
                        onClick={() => removeField(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-widest text-gray-500">Botão (última ação)</label>
        <Input value={form.submitLabel} onChange={(e) => update({ submitLabel: e.target.value })} />
      </div>


      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Gerar Flow com IA</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Escreva em linguagem natural o que você quer coletar. A IA vai sugerir as perguntas e você pode editar antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="block text-xs text-gray-400">O que você quer no formulário?</label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="min-h-28 bg-zinc-900 border-white/10 text-white"
              placeholder='Ex: "Quero um formulário de pré-cadastro para uma turma. Pergunte nome, telefone, e-mail, cidade, faixa de horário preferida e um opt-in para receber mensagens."'
            />
            <div className="text-[11px] text-zinc-500">
              Observação: isso substitui as perguntas atuais do modo Formulário (você pode desfazer com Ctrl+Z apenas se ainda não salvou).
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-zinc-900 hover:bg-white/5"
              onClick={() => setAiOpen(false)}
              disabled={aiLoading}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={generateWithAI} disabled={aiLoading || aiPrompt.trim().length < 10}>
              {aiLoading ? 'Gerando…' : 'Gerar perguntas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar modelo pronto</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Isso substitui o formulário atual. Você pode editar depois.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
            {FLOW_TEMPLATES.map((tpl) => (
              <label
                key={tpl.key}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                  selectedTemplateKey === tpl.key
                    ? 'border-emerald-400/40 bg-emerald-500/10'
                    : 'border-white/10 bg-zinc-900/60 hover:bg-white/5'
                }`}
              >
                <input
                  type="radio"
                  name="flow_template"
                  className="mt-1 h-4 w-4 accent-emerald-400"
                  checked={selectedTemplateKey === tpl.key}
                  onChange={() => setSelectedTemplateKey(tpl.key)}
                />
                <div>
                  <div className="text-sm font-semibold text-white">{tpl.name}</div>
                  <div className="text-xs text-gray-400">{tpl.description}</div>
                </div>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-zinc-900 hover:bg-white/5"
              onClick={() => setTemplateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!selectedTemplateKey}
              onClick={() => {
                const tpl = FLOW_TEMPLATES.find((t) => t.key === selectedTemplateKey)
                if (!tpl) return
                const next = flowJsonToFormSpec(tpl.flowJson, props.flowName || 'Flow')
                setForm(next)
                setDirty(true)
                setTemplateOpen(false)
                toast.success('Modelo importado. Revise e salve quando estiver pronto.')
                props.onActionComplete?.()
              }}
            >
              Usar modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
