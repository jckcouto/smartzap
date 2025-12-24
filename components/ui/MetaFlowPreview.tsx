'use client'

import React, { useMemo, useState } from 'react'
import { X, MoreVertical } from 'lucide-react'

type FlowComponent = Record<string, any>

type ParsedFlow = {
  version?: string
  screen?: {
    id?: string
    title?: string
    terminal?: boolean
    layout?: {
      type?: string
      children?: FlowComponent[]
    }
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function parseFlowJson(flowJson: unknown): ParsedFlow {
  if (!isPlainObject(flowJson)) return {}

  const screens = Array.isArray((flowJson as any).screens) ? (flowJson as any).screens : []
  const screen = screens[0]
  const layout = isPlainObject(screen?.layout) ? screen.layout : undefined

  return {
    version: typeof (flowJson as any).version === 'string' ? (flowJson as any).version : undefined,
    screen: isPlainObject(screen)
      ? {
          id: typeof screen.id === 'string' ? screen.id : undefined,
          title: typeof screen.title === 'string' ? screen.title : undefined,
          terminal: typeof screen.terminal === 'boolean' ? screen.terminal : undefined,
          layout: layout
            ? {
                type: typeof (layout as any).type === 'string' ? (layout as any).type : undefined,
                children: Array.isArray((layout as any).children) ? (layout as any).children : [],
              }
            : undefined,
        }
      : undefined,
  }
}

function s(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim()
}

function getFooter(children: FlowComponent[]): { label: string } {
  const footer = children.find((c) => c && c.type === 'Footer')
  const label = (footer ? s(footer.label, '') : '').trim() || 'Continue'
  return { label }
}

function renderBasicText(text: string, idx: number) {
  const t = stripMarkdown(text || '')
  if (!t) return null
  return (
    <div key={`bt_${idx}`} className="text-[14px] leading-snug text-zinc-100 whitespace-pre-wrap">
      {t}
    </div>
  )
}

function getOptions(comp: FlowComponent): Array<{ id?: string; title?: string }> {
  if (Array.isArray(comp['data-source'])) return comp['data-source'] as Array<{ id?: string; title?: string }>
  if (Array.isArray(comp.options)) return comp.options as Array<{ id?: string; title?: string }>
  return []
}

function renderTextEntry(comp: FlowComponent, idx: number, values: Record<string, any>, setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>) {
  const label = (s(comp.label, 'Campo') || 'Campo').trim()
  const inputType = s(comp['input-type'], '').trim()
  const name = s(comp.name, `field_${idx}`)
  const type = inputType === 'email' ? 'email' : inputType === 'phone' ? 'tel' : inputType === 'number' ? 'number' : 'text'
  const value = values[name] ?? ''
  return (
    <div key={`te_${idx}`} className="space-y-2">
      <div className="text-[14px] text-zinc-200">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.value }))}
        placeholder="Digite aqui"
        className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-[15px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
      />
    </div>
  )
}

function renderTextArea(comp: FlowComponent, idx: number, values: Record<string, any>, setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>) {
  const label = (s(comp.label, 'Campo') || 'Campo').trim()
  const name = s(comp.name, `field_${idx}`)
  const value = values[name] ?? ''
  return (
    <div key={`ta_${idx}`} className="space-y-2">
      <div className="text-[14px] text-zinc-200">{label}</div>
      <textarea
        value={value}
        onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.value }))}
        placeholder="Digite aqui"
        rows={3}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
      />
    </div>
  )
}

function renderOptIn(comp: FlowComponent, idx: number, values: Record<string, any>, setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>) {
  const text = (s(comp.text, '') || s(comp.label, '') || '').trim()
  if (!text) return null
  const name = s(comp.name, `optin_${idx}`)
  const checked = !!values[name]

  // Heurística simples pra ficar parecido com os prints: realçar “Leia mais”.
  const parts = text.split(/(Leia mais)/i)

  return (
    <label key={`oi_${idx}`} className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.checked }))}
        className="mt-1 h-5 w-5 rounded border border-white/30 bg-white/5 accent-emerald-400"
      />
      <div className="text-[15px] text-zinc-300 leading-snug">
        {parts.map((p, i) => {
          if (/^Leia mais$/i.test(p)) {
            return (
              <span key={i} className="text-emerald-400">
                {p}
              </span>
            )
          }
          return <React.Fragment key={i}>{p}</React.Fragment>
        })}
      </div>
    </label>
  )
}

function isRequiredSatisfied(comp: FlowComponent, values: Record<string, any>, idx: number): boolean {
  if (!comp?.required) return true
  const type = s(comp?.type, '')
  const name = s(comp.name, `field_${idx}`)
  const value = values[name]

  if (type === 'CheckboxGroup') return Array.isArray(value) && value.length > 0
  if (type === 'OptIn') return !!value
  return value !== undefined && value !== null && String(value).trim().length > 0
}

function renderRadioGroup(comp: FlowComponent, idx: number, values: Record<string, any>, setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>) {
  const label = (s(comp.label, '') || '').trim()
  const options = getOptions(comp)
  const name = s(comp.name, `radio_${idx}`)
  const selected = values[name] ?? ''

  return (
    <div key={`rg_${idx}`} className="space-y-3">
      {label ? <div className="text-[14px] text-zinc-200">{label}</div> : null}
      <div className="space-y-3">
        {(options.length ? options : [{ id: 'opcao_1', title: 'Opção 1' }]).map((o: any, j: number) => (
          <label key={`rg_${idx}_${j}`} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 cursor-pointer">
            <div className="text-[15px] text-zinc-300">{s(o?.title, 'Opção')}</div>
            <input
              type="radio"
              name={name}
              value={s(o?.id, s(o?.title, String(j)))}
              checked={selected === s(o?.id, s(o?.title, String(j)))}
              onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.value }))}
              className="h-5 w-5 accent-emerald-400"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function renderCheckboxGroup(comp: FlowComponent, idx: number, values: Record<string, any>, setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>) {
  const label = (s(comp.label, '') || '').trim()
  const options = getOptions(comp)
  const name = s(comp.name, `check_${idx}`)
  const selected = Array.isArray(values[name]) ? values[name] : []

  return (
    <div key={`cg_${idx}`} className="space-y-3">
      {label ? <div className="text-[14px] text-zinc-200">{label}</div> : null}
      <div className="space-y-3">
        {(options.length ? options : [{ id: 'opcao_1', title: 'Opção 1' }]).map((o: any, j: number) => (
          <label key={`cg_${idx}_${j}`} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 cursor-pointer">
            <div className="text-[15px] text-zinc-300">{s(o?.title, 'Opção')}</div>
            <input
              type="checkbox"
              value={s(o?.id, s(o?.title, String(j)))}
              checked={selected.includes(s(o?.id, s(o?.title, String(j))))}
              onChange={(e) => {
                const v = s(o?.id, s(o?.title, String(j)))
                setValues((prev) => {
                  const curr = Array.isArray(prev[name]) ? prev[name] : []
                  return {
                    ...prev,
                    [name]: e.target.checked ? [...curr, v] : curr.filter((x: string) => x !== v),
                  }
                })
              }}
              className="h-5 w-5 accent-emerald-400"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function renderDropdown(comp: FlowComponent, idx: number, values: Record<string, any>, setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>) {
  const label = (s(comp.label, '') || 'Select').trim()
  const options = getOptions(comp)
  const name = s(comp.name, `dropdown_${idx}`)
  const value = values[name] ?? ''
  return (
    <div key={`dd_${idx}`} className="space-y-2">
      <div className="text-[14px] text-zinc-200">{label}</div>
      <select
        value={value}
        onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.value }))}
        className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-[15px] text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
      >
        <option value="" disabled>
          Selecionar opção
        </option>
        {(options.length ? options : [{ id: 'opcao_1', title: 'Opção 1' }]).map((o: any, j: number) => (
          <option key={`dd_${idx}_${j}`} value={s(o?.id, s(o?.title, String(j)))}>
            {s(o?.title, 'Opção')}
          </option>
        ))}
      </select>
    </div>
  )
}

function renderDatePicker(comp: FlowComponent, idx: number, values: Record<string, any>, setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>) {
  const label = (s(comp.label, '') || 'Date').trim()
  const name = s(comp.name, `date_${idx}`)
  const value = values[name] ?? ''
  return (
    <div key={`dp_${idx}`} className="space-y-2">
      <div className="text-[14px] text-zinc-200">{label}</div>
      <input
        type="date"
        value={value}
        onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.value }))}
        className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-[15px] text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
      />
    </div>
  )
}

function renderComponent(
  comp: FlowComponent,
  idx: number,
  values: Record<string, any>,
  setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>,
) {
  const type = s(comp?.type, '')

  if (type === 'BasicText' || type === 'TextBody' || type === 'RichText') return renderBasicText(s(comp.text, ''), idx)
  if (type === 'TextArea') return renderTextArea(comp, idx, values, setValues)
  if (type === 'TextEntry' || type === 'TextInput') return renderTextEntry(comp, idx, values, setValues)
  if (type === 'OptIn') return renderOptIn(comp, idx, values, setValues)
  if (type === 'RadioButtonsGroup') return renderRadioGroup(comp, idx, values, setValues)
  if (type === 'CheckboxGroup') return renderCheckboxGroup(comp, idx, values, setValues)
  if (type === 'Dropdown') return renderDropdown(comp, idx, values, setValues)
  if (type === 'DatePicker') return renderDatePicker(comp, idx, values, setValues)

  return null
}

export function MetaFlowPreview(props: {
  flowJson: unknown
  className?: string
}) {
  const parsed = useMemo(() => parseFlowJson(props.flowJson), [props.flowJson])
  const [values, setValues] = useState<Record<string, any>>({})

  const children = parsed.screen?.layout?.children || []
  const footer = getFooter(children)

  const title = (parsed.screen?.title || 'Flow').trim() || 'Flow'

  return (
    <div className={`relative mx-auto w-[320px] h-160 rounded-[2.2rem] bg-zinc-950 border-8 border-zinc-900 shadow-2xl overflow-hidden ${props.className || ''}`}>
      {/* topo do "telefone" */}
      <div className="h-10 bg-zinc-950" />

      {/* modal do flow (como no WhatsApp) */}
      <div className="absolute inset-x-0 top-6 bottom-0 rounded-t-2xl bg-[#1f2223] border-t border-white/10 overflow-hidden">
        {/* topbar */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
          <button type="button" className="h-9 w-9 rounded-full hover:bg-white/5 flex items-center justify-center text-zinc-200">
            <X className="h-5 w-5" />
          </button>
          <div className="text-[18px] font-semibold text-zinc-100 truncate">{title}</div>
          <button type="button" className="h-9 w-9 rounded-full hover:bg-white/5 flex items-center justify-center text-zinc-200">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>

        {/* conteúdo */}
        <div className="px-5 py-5 space-y-6 overflow-auto" style={{ height: 'calc(100% - 14rem)' }}>
          {children.filter((c) => c?.type !== 'Footer').map((c, idx) => renderComponent(c, idx, values, setValues))}
        </div>

        {/* CTA + compliance */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 pt-4 bg-linear-to-t from-[#1f2223] via-[#1f2223] to-transparent">
          <button
            type="button"
            disabled={!children.filter((c) => c?.type !== 'Footer').every((c, idx) => isRequiredSatisfied(c, values, idx))}
            className="w-full h-12 rounded-2xl bg-white/10 text-white/80 text-[16px] font-semibold disabled:text-white/25 disabled:cursor-not-allowed"
          >
            {footer.label}
          </button>

          <div className="mt-4 text-center text-[14px] text-zinc-400">
            Gerenciada pela empresa. <span className="text-emerald-400">Saiba mais</span>
          </div>
          <div className="mt-1 text-center text-[10px] text-zinc-500">preview Meta • v{parsed.version || '—'}</div>
        </div>
      </div>
    </div>
  )
}

export default MetaFlowPreview
