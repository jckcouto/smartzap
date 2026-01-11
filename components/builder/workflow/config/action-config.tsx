"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { HelpCircle, Plus, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ConfigureConnectionOverlay } from "@/components/builder/overlays/add-connection-overlay";
import { AiGatewayConsentOverlay } from "@/components/builder/overlays/ai-gateway-consent-overlay";
import { useOverlay } from "@/components/builder/overlays/overlay-provider";
import { Button } from "@/components/builder/ui/button";
import { CodeEditor } from "@/components/builder/ui/code-editor";
import { IntegrationIcon } from "@/components/builder/ui/integration-icon";
import { IntegrationSelector } from "@/components/builder/ui/integration-selector";
import { Input } from "@/components/builder/ui/input";
import { Label } from "@/components/builder/ui/label";
import { cn } from "@/lib/builder/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/builder/ui/select";
import { Checkbox } from "@/components/builder/ui/checkbox";
import { TemplateBadgeInput } from "@/components/builder/ui/template-badge-input";
import { TemplateBadgeTextarea } from "@/components/builder/ui/template-badge-textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/builder/ui/tooltip";
import { aiGatewayStatusAtom } from "@/lib/builder/ai-gateway/state";
import {
  integrationsAtom,
  integrationsVersionAtom,
} from "@/lib/builder/integrations-store";
import type { IntegrationType } from "@/lib/builder/types/integration";
import type {
  CustomFieldDefinition,
  Template,
  TemplateButton,
  TemplateComponent,
} from "@/types";
import {
  findActionById,
  getActionsByCategory,
  getAllIntegrations,
  isFieldGroup,
  type ActionConfigField,
} from "@/lib/builder/plugins";
import { templateService } from "@/services/templateService";
import { customFieldService } from "@/services/customFieldService";
import { getTestContactLabel } from "@/lib/test-contact-display";
import { ActionConfigRenderer } from "./action-config-renderer";
import { SchemaBuilder, type SchemaField } from "./schema-builder";
import { WhatsAppPreview } from "./whatsapp-preview";

type ActionConfigProps = {
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: string) => void;
  disabled: boolean;
  isOwner?: boolean;
};

type ButtonDefinition = { id: string; title: string };

const BUTTON_PRESETS = [
  { id: "none", label: "Sem preset", titles: [] },
  { id: "yes_no", label: "Sim / Nao", titles: ["Sim", "Nao"] },
  { id: "learn_more", label: "Quero saber mais", titles: ["Quero saber mais"] },
  { id: "human", label: "Falar com humano", titles: ["Falar com humano"] },
];

type TemplateParamEntry = { key?: string; text?: string };
type TemplateButtonEntry = { index?: number; params?: Array<{ text?: string }> };
type TemplateSegment =
  | { type: "text"; value: string }
  | { type: "var"; key: string };

function parseJsonArraySafe<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function buttonParamToInput(raw: unknown): string {
  const entries = parseJsonArraySafe<TemplateButtonEntry>(raw);
  const first = entries.find((entry) => entry?.params?.[0]?.text);
  const text = first?.params?.[0]?.text;
  return text ? String(text) : "";
}

function paramsToMap(raw: unknown): Record<string, string> {
  const entries = parseJsonArraySafe<TemplateParamEntry>(raw);
  const map: Record<string, string> = {};
  entries.forEach((entry, index) => {
    const key = String(entry?.key || String(index + 1)).trim();
    const text = String(entry?.text || "").trim();
    if (!key || !text) return;
    map[key] = text;
  });
  return map;
}

function buildParamsFromMap(
  map: Record<string, string>,
  keys: string[],
  format: string
): TemplateParamEntry[] {
  const entries: TemplateParamEntry[] = [];
  if (format === "named") {
    for (const key of keys) {
      const value = String(map[key] || "").trim();
      if (!value) continue;
      entries.push({ key, text: value });
    }
    return entries;
  }

  for (const key of keys) {
    const value = String(map[key] || "").trim();
    if (!value) continue;
    entries.push({ key, text: value });
  }
  return entries;
}

function splitTemplateText(text: string, format: string): TemplateSegment[] {
  if (!text) return [];
  const pattern =
    format === "named"
      ? /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
      : /\{\{\s*(\d+)\s*\}\}/g;
  const segments: TemplateSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    segments.push({ type: "var", key: match[1] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

function buildButtonParamsFromInput(
  raw: string,
  index?: number | null
): TemplateButtonEntry[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return [
    {
      index: typeof index === "number" ? index : 0,
      params: [{ text: trimmed }],
    },
  ];
}

function extractPositionalKeys(text?: string): string[] {
  if (!text || !text.includes("{{")) return [];
  const matches = text.match(/\{\{(\d+)\}\}/g) || [];
  const numbers = new Set<number>();
  for (const m of matches) {
    const n = Number(m.replace(/[{}]/g, ""));
    if (Number.isFinite(n)) numbers.add(n);
  }
  return Array.from(numbers)
    .sort((a, b) => a - b)
    .map((n) => String(n));
}

function extractNamedKeys(text?: string): string[] {
  if (!text || !text.includes("{{")) return [];
  const matches = text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const names = new Set<string>();
  for (const m of matches) {
    const name = m.replace(/[{}]/g, "");
    if (name) names.add(name);
  }
  return Array.from(names);
}

function extractTemplateKeys(
  text: string | undefined,
  format: string
): string[] {
  return format === "named"
    ? extractNamedKeys(text)
    : extractPositionalKeys(text);
}

function getTemplateComponent(
  template: Template | undefined,
  type: TemplateComponent["type"]
): TemplateComponent | undefined {
  return template?.components?.find((component) => component.type === type);
}

function buttonHasDynamicParam(button: TemplateButton): boolean {
  const hasPlaceholder = (value?: string | string[]) => {
    if (!value) return false;
    if (Array.isArray(value)) {
      return value.some((entry) => typeof entry === "string" && entry.includes("{{"));
    }
    return value.includes("{{");
  };
  if (button.type === "URL" && typeof button.url === "string") {
    return button.url.includes("{{");
  }
  return hasPlaceholder(button.example);
}

function findFirstDynamicButtonIndex(
  template: Template | undefined
): number | null {
  if (!template?.components?.length) return null;
  let globalIndex = 0;
  for (const component of template.components) {
    if (component.type !== "BUTTONS") continue;
    const buttons = component.buttons || [];
    for (const button of buttons) {
      if (buttonHasDynamicParam(button)) {
        return globalIndex;
      }
      globalIndex += 1;
    }
  }
  return null;
}

function getButtonLabelByIndex(
  template: Template | undefined,
  targetIndex: number | null
): string {
  if (!template?.components?.length || targetIndex === null) return "";
  let globalIndex = 0;
  for (const component of template.components) {
    if (component.type !== "BUTTONS") continue;
    const buttons = component.buttons || [];
    for (const button of buttons) {
      if (globalIndex === targetIndex) {
        return String(button.text || "").trim();
      }
      globalIndex += 1;
    }
  }
  return "";
}

function normalizeButtonTitles(raw: unknown): string[] {
  const fallback: string[] = [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (item && typeof item === "object" ? (item as any).title : ""))
      .filter((title) => typeof title === "string")
      .slice(0, 3) as string[];
  }
  if (typeof raw !== "string" || raw.trim().length === 0) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed
      .map((item) => (item && typeof item === "object" ? (item as any).title : ""))
      .filter((title) => typeof title === "string")
      .slice(0, 3) as string[];
  } catch {
    return fallback;
  }
}

function slugifyButtonId(title: string): string {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized;
}

function buildButtonsFromTitles(titles: string[]): ButtonDefinition[] {
  const used = new Map<string, number>();
  const cleaned = titles
    .map((title) => String(title || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  return cleaned.map((title, index) => {
    const base = slugifyButtonId(title);
    const key = base || `button_${index + 1}`;
    const count = (used.get(key) ?? 0) + 1;
    used.set(key, count);
    const id = count > 1 ? `${key}_${count}` : key;
    return { id, title };
  });
}

function TemplatePreviewEditor({
  disabled,
  templateFormat,
  bodyText,
  headerText,
  footerText,
  bodyParamsMap,
  headerParamsMap,
  buttonParamIndex,
  buttonParamValue,
  buttonLabel,
  bodyKeys,
  headerKeys,
  systemFieldOptions,
  customFieldOptions,
  testContact,
  autoFillLabel,
  autoFillDisabled,
  onAutoFill,
  onUpdateBodyParam,
  onUpdateHeaderParam,
  onUpdateButtonParam,
}: {
  disabled: boolean;
  templateFormat: string;
  bodyText: string;
  headerText: string;
  footerText: string;
  bodyParamsMap: Record<string, string>;
  headerParamsMap: Record<string, string>;
  buttonParamIndex: number | null;
  buttonParamValue: string;
  buttonLabel: string;
  bodyKeys: string[];
  headerKeys: string[];
  systemFieldOptions: Array<{ label: string; token: string }>;
  customFieldOptions: Array<{ key: string; label: string }>;
  testContact: {
    name?: string;
    phone?: string;
    email?: string | null;
    custom_fields?: Record<string, unknown>;
  } | null;
  autoFillLabel: string;
  autoFillDisabled: boolean;
  onAutoFill: () => void;
  onUpdateBodyParam: (key: string, value: string) => void;
  onUpdateHeaderParam: (key: string, value: string) => void;
  onUpdateButtonParam: (value: string) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<{
    scope: "body" | "header" | "button";
    key?: string;
    id: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [flowDraft, setFlowDraft] = useState("");

  const bodySegments = useMemo(
    () => splitTemplateText(bodyText, templateFormat),
    [bodyText, templateFormat]
  );
  const headerSegments = useMemo(
    () => splitTemplateText(headerText, templateFormat),
    [headerText, templateFormat]
  );
  const footerSegments = useMemo(
    () => splitTemplateText(footerText, templateFormat),
    [footerText, templateFormat]
  );

  const slotAnchors = useMemo(() => {
    const map = new Map<string, string>();
    const register = (
      segments: TemplateSegment[],
      scope: "body" | "header"
    ) => {
      segments.forEach((segment, index) => {
        if (segment.type !== "var") return;
        const mapKey = `${scope}:${segment.key}`;
        if (!map.has(mapKey)) {
          map.set(mapKey, `${scope}-${segment.key}-${index}`);
        }
      });
    };
    register(headerSegments, "header");
    register(bodySegments, "body");
    return map;
  }, [bodySegments, headerSegments]);

  const slotOrder = useMemo(() => {
    const slots: Array<{
      scope: "header" | "body" | "button";
      key?: string;
      id: string;
    }> = [];
    if (headerKeys.length > 0) {
      const key = headerKeys[0];
      const anchorId = slotAnchors.get(`header:${key}`) || `header-${key}-0`;
      slots.push({ scope: "header", key, id: anchorId });
    }
    for (const key of bodyKeys) {
      const anchorId = slotAnchors.get(`body:${key}`) || `body-${key}-0`;
      slots.push({ scope: "body", key, id: anchorId });
    }
    if (buttonParamIndex !== null) {
      slots.push({ scope: "button", id: "button" });
    }
    return slots;
  }, [bodyKeys, buttonParamIndex, headerKeys, slotAnchors]);

  const getSlotValue = (slot: {
    scope: "body" | "header" | "button";
    key?: string;
  }) => {
    if (slot.scope === "button") return buttonParamValue || "";
    if (slot.scope === "header") {
      return slot.key ? headerParamsMap[slot.key] || "" : "";
    }
    return slot.key ? bodyParamsMap[slot.key] || "" : "";
  };

  const activeValue = activeSlot ? getSlotValue(activeSlot) : "";

  useEffect(() => {
    if (!activeSlot) {
      setSearchTerm("");
      setFlowDraft("");
      return;
    }
    setSearchTerm("");
    setFlowDraft(activeValue.includes("{{@") ? activeValue : "");
  }, [activeSlot, activeValue]);

  const resolveSystemToken = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (
      trimmed === "{{nome}}" ||
      trimmed === "{{name}}" ||
      trimmed === "{{contact.name}}"
    ) {
      return "{{contact.name}}";
    }
    if (
      trimmed === "{{telefone}}" ||
      trimmed === "{{phone}}" ||
      trimmed === "{{contact.phone}}"
    ) {
      return "{{contact.phone}}";
    }
    if (trimmed === "{{email}}" || trimmed === "{{contact.email}}") {
      return "{{contact.email}}";
    }
    return null;
  };

  const resolvePreviewValue = (raw: string): string => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";

    const normalizedSystem = resolveSystemToken(trimmed);
    if (normalizedSystem) {
      const systemLabel =
        systemFieldOptions.find((option) => option.token === normalizedSystem)
          ?.label || normalizedSystem;
      if (!testContact) return systemLabel;
      if (normalizedSystem === "{{contact.name}}") {
        return testContact.name?.trim() || systemLabel;
      }
      if (normalizedSystem === "{{contact.phone}}") {
        return testContact.phone?.trim() || systemLabel;
      }
      if (normalizedSystem === "{{contact.email}}") {
        return String(testContact.email || "").trim() || systemLabel;
      }
      return systemLabel;
    }

    const customMatch = trimmed.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
    if (customMatch) {
      const key = customMatch[1];
      const customLabel =
        customFieldOptions.find((option) => option.key === key)?.label || key;
      const customValue = testContact?.custom_fields?.[key];
      if (customValue !== undefined && customValue !== null) {
        return String(customValue);
      }
      return customLabel;
    }

    const flowMatch = trimmed.match(/^\{\{@[^:]+:([^}]+)\}\}$/);
    if (flowMatch) {
      return flowMatch[1];
    }

    return trimmed;
  };

  const handleActiveChange = (value: string) => {
    if (!activeSlot) return;
    if (activeSlot.scope === "button") {
      onUpdateButtonParam(value);
      return;
    }
    if (!activeSlot.key) return;
    if (activeSlot.scope === "header") {
      onUpdateHeaderParam(activeSlot.key, value);
      return;
    }
    onUpdateBodyParam(activeSlot.key, value);
  };

  const filledCount = useMemo(
    () =>
      slotOrder.filter((slot) => String(getSlotValue(slot)).trim().length > 0)
        .length,
    [slotOrder, bodyParamsMap, headerParamsMap, buttonParamValue]
  );
  const totalCount = slotOrder.length;
  const progressPct =
    totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  const focusNextSlot = () => {
    if (!slotOrder.length) return;
    if (!activeSlot) {
      const first = slotOrder.find(
        (slot) => String(getSlotValue(slot)).trim().length === 0
      );
      setActiveSlot(first || slotOrder[0]);
      return;
    }
    const currentIndex = slotOrder.findIndex(
      (slot) =>
        slot.scope === activeSlot.scope && slot.key === activeSlot.key
    );
    const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
    const ordered = [...slotOrder.slice(startIndex), ...slotOrder.slice(0, startIndex)];
    const next = ordered.find(
      (slot) => String(getSlotValue(slot)).trim().length === 0
    );
    setActiveSlot(next || ordered[0]);
  };

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const filteredSystem = systemFieldOptions.filter((option) => {
    if (!normalizedSearch) return true;
    return (
      option.label.toLowerCase().includes(normalizedSearch) ||
      option.token.toLowerCase().includes(normalizedSearch)
    );
  });
  const filteredCustom = customFieldOptions.filter((option) => {
    if (!normalizedSearch) return true;
    return (
      option.label.toLowerCase().includes(normalizedSearch) ||
      option.key.toLowerCase().includes(normalizedSearch)
    );
  });

  const renderSlotPicker = (
    slot: { scope: "body" | "header" | "button"; key?: string; id: string },
    displayValue: string
  ) => {
    const isActive = activeSlot?.id === slot.id;
    const rawValue = getSlotValue(slot);
    const placeholder =
      slot.scope === "button"
        ? "Clique para definir"
        : slot.key
          ? `{${slot.key}}`
          : "";
    return (
      <Popover
        open={isActive}
        onOpenChange={(open) => setActiveSlot(open ? slot : null)}
      >
        <PopoverTrigger asChild>
          <button
            className={cn(
            "inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-100 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/70",
            !rawValue && "text-emerald-200/70",
            isActive && "ring-1 ring-emerald-400/70"
          )}
            disabled={disabled}
            type="button"
          >
            {displayValue || placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 border border-white/10 bg-zinc-950 p-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <Input
              className="h-8 bg-zinc-900/60 text-xs text-white"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar campo..."
              value={searchTerm}
            />
            <Button
              onClick={() => {
                handleActiveChange("");
                setActiveSlot(null);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Limpar
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Sistema
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredSystem.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Nenhum campo encontrado.
                </span>
              ) : (
                filteredSystem.map((option) => (
                  <button
                    className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/20"
                    key={option.token}
                    onClick={() => {
                      handleActiveChange(option.token);
                      setActiveSlot(null);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Personalizado
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredCustom.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Nenhum campo encontrado.
                </span>
              ) : (
                filteredCustom.map((option) => (
                  <button
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/5"
                    key={option.key}
                    onClick={() => {
                      handleActiveChange(`{{${option.key}}}`);
                      setActiveSlot(null);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Variavel do fluxo
            </div>
            <TemplateBadgeInput
              className="bg-zinc-900/60 text-white"
              disabled={disabled}
              onChange={setFlowDraft}
              placeholder="Digite @ para escolher"
              value={flowDraft}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (!flowDraft.trim()) return;
                  handleActiveChange(flowDraft);
                  setActiveSlot(null);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Usar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderSegments = (
    segments: TemplateSegment[],
    scope: "body" | "header"
  ) =>
    segments.map((segment, index) => {
      if (segment.type === "text") {
        return <span key={`${scope}-text-${index}`}>{segment.value}</span>;
      }
      const map = scope === "header" ? headerParamsMap : bodyParamsMap;
      const value = map[segment.key] || "";
      const displayValue = resolvePreviewValue(value);
      const slotId = `${scope}-${segment.key}-${index}`;
      return (
        <span key={`${scope}-var-${segment.key}-${index}`}>
          {renderSlotPicker({ scope, key: segment.key, id: slotId }, displayValue)}
        </span>
      );
    });

  const buttonDisplayValue = resolvePreviewValue(buttonParamValue);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label className="ml-1">Clique no preview para preencher</Label>
          <div className="mt-1 text-xs text-muted-foreground">
            {filledCount}/{totalCount} preenchidos
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={autoFillDisabled || disabled}
            onClick={onAutoFill}
            size="sm"
            type="button"
            variant="outline"
            title={autoFillDisabled ? autoFillLabel : undefined}
          >
            Auto-preencher (contato teste)
          </Button>
          <Button
            disabled={disabled || totalCount === 0}
            onClick={focusNextSlot}
            size="sm"
            type="button"
            variant="outline"
          >
            Proximo campo
          </Button>
        </div>
      </div>
      {autoFillLabel && (
        <div className="text-xs text-muted-foreground">{autoFillLabel}</div>
      )}
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div
          className="h-1.5 rounded-full bg-emerald-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="rounded-xl border border-white/10 bg-black/50 p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Preview do WhatsApp
        </div>
        <div className="mt-3 space-y-2">
          {headerSegments.length > 0 && (
            <div
              className={cn(
                "max-w-[260px] whitespace-pre-line rounded-2xl rounded-bl-sm bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-white",
                "shadow-[0_0_24px_rgba(16,185,129,0.1)]"
              )}
            >
              {renderSegments(headerSegments, "header")}
            </div>
          )}
          <div
            className={cn(
              "max-w-[260px] whitespace-pre-line rounded-2xl rounded-bl-sm bg-emerald-500/10 px-4 py-3 text-sm text-white",
              "shadow-[0_0_24px_rgba(16,185,129,0.1)]"
            )}
          >
            {bodySegments.length > 0
              ? renderSegments(bodySegments, "body")
              : bodyText || "Preview do template"}
            {footerSegments.length > 0 && (
              <div className="mt-2 text-xs text-white/70">
                {renderSegments(footerSegments, "body")}
              </div>
            )}
          </div>
        </div>
        {buttonParamIndex !== null && (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>{buttonLabel || "Botao"}</span>
              {renderSlotPicker({ scope: "button", id: "button" }, buttonDisplayValue)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Database Query fields component
function DatabaseQueryFields({
  config,
  onUpdateConfig,
  disabled,
}: {
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
      <Label htmlFor="dbQuery">Consulta SQL</Label>
        <div className="overflow-hidden rounded-md border">
          <CodeEditor
            defaultLanguage="sql"
            height="150px"
            onChange={(value) => onUpdateConfig("dbQuery", value || "")}
            options={{
              minimap: { enabled: false },
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              fontSize: 12,
              readOnly: disabled,
              wordWrap: "off",
            }}
            value={(config?.dbQuery as string) || ""}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          A DATABASE_URL das integrações do projeto sera usada para executar
          essa consulta.
        </p>
      </div>
      <div className="space-y-2">
      <Label>Schema (opcional)</Label>
        <SchemaBuilder
          disabled={disabled}
          onChange={(schema) =>
            onUpdateConfig("dbSchema", JSON.stringify(schema))
          }
          schema={
            config?.dbSchema
              ? (JSON.parse(config.dbSchema as string) as SchemaField[])
              : []
          }
        />
      </div>
    </>
  );
}

// HTTP Request fields component
function HttpRequestFields({
  config,
  onUpdateConfig,
  disabled,
}: {
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
      <Label htmlFor="httpMethod">Metodo HTTP</Label>
        <Select
          disabled={disabled}
          onValueChange={(value) => onUpdateConfig("httpMethod", value)}
          value={(config?.httpMethod as string) || "POST"}
        >
          <SelectTrigger className="w-full" id="httpMethod">
            <SelectValue placeholder="Selecione o metodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
      <Label htmlFor="endpoint">URL</Label>
        <TemplateBadgeInput
          disabled={disabled}
          id="endpoint"
          onChange={(value) => onUpdateConfig("endpoint", value)}
          placeholder="https://api.example.com/endpoint or {{NodeName.url}}"
          value={(config?.endpoint as string) || ""}
        />
      </div>
      <div className="space-y-2">
      <Label htmlFor="httpHeaders">Cabecalhos (JSON)</Label>
        <div className="overflow-hidden rounded-md border">
          <CodeEditor
            defaultLanguage="json"
            height="100px"
            onChange={(value) => onUpdateConfig("httpHeaders", value || "{}")}
            options={{
              minimap: { enabled: false },
              lineNumbers: "off",
              scrollBeyondLastLine: false,
              fontSize: 12,
              readOnly: disabled,
              wordWrap: "off",
            }}
            value={(config?.httpHeaders as string) || "{}"}
          />
        </div>
      </div>
      <div className="space-y-2">
      <Label htmlFor="httpBody">Corpo (JSON)</Label>
        <div
          className={`overflow-hidden rounded-md border ${config?.httpMethod === "GET" ? "opacity-50" : ""}`}
        >
          <CodeEditor
            defaultLanguage="json"
            height="120px"
            onChange={(value) => onUpdateConfig("httpBody", value || "{}")}
            options={{
              minimap: { enabled: false },
              lineNumbers: "off",
              scrollBeyondLastLine: false,
              fontSize: 12,
              readOnly: config?.httpMethod === "GET" || disabled,
              domReadOnly: config?.httpMethod === "GET" || disabled,
              wordWrap: "off",
            }}
            value={(config?.httpBody as string) || "{}"}
          />
        </div>
        {config?.httpMethod === "GET" && (
          <p className="text-muted-foreground text-xs">
            Body desativado para requisicoes GET
          </p>
        )}
      </div>
    </>
  );
}

// Condition fields component
function ConditionFields({
  config,
  onUpdateConfig,
  disabled,
}: {
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="condition">Expressao de condicao</Label>
      <TemplateBadgeInput
        disabled={disabled}
        id="condition"
        onChange={(value) => onUpdateConfig("condition", value)}
        placeholder="e.g., 5 > 3, status === 200, {{PreviousNode.value}} > 100"
        value={(config?.condition as string) || ""}
      />
      <p className="text-muted-foreground text-xs">
        Enter a JavaScript expression that evaluates to true or false. You can
        use @ to reference previous node outputs.
      </p>
    </div>
  );
}

function DelayFields({
  config,
  onUpdateConfig,
  disabled,
}: {
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="delayMs">Atraso (ms)</Label>
      <Input
        disabled={disabled}
        id="delayMs"
        onChange={(e) => onUpdateConfig("delayMs", e.target.value)}
        placeholder="1000"
        value={(config?.delayMs as string) || ""}
      />
      <p className="text-muted-foreground text-xs">
        Wait before continuing to the next node.
      </p>
    </div>
  );
}

function VariableFields({
  config,
  onUpdateConfig,
  disabled,
  mode,
}: {
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: string) => void;
  disabled: boolean;
  mode: "set" | "get";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="variableKey">Chave da variável</Label>
      <Input
        disabled={disabled}
        id="variableKey"
        onChange={(e) => onUpdateConfig("variableKey", e.target.value)}
        placeholder="leadName"
        value={(config?.variableKey as string) || ""}
      />
      {mode === "set" && (
        <>
          <Label htmlFor="variableValue">Value</Label>
          <TemplateBadgeInput
            disabled={disabled}
            id="variableValue"
            onChange={(value) => onUpdateConfig("variableValue", value)}
            placeholder="Value or template"
            value={(config?.variableValue as string) || ""}
          />
        </>
      )}
      <p className="text-muted-foreground text-xs">
        {mode === "set"
          ? "Stores a value that can be used by later nodes."
          : "Reads a value stored earlier in the workflow."}
      </p>
    </div>
  );
}

function ExecutionFields({
  config,
  onUpdateConfig,
  disabled,
}: {
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Execução
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="retryCount">Tentativas</Label>
          <Input
            disabled={disabled}
            id="retryCount"
            onChange={(e) => onUpdateConfig("retryCount", e.target.value)}
            placeholder="0"
            value={(config?.retryCount as string) || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="retryDelayMs">Atraso (ms)</Label>
          <Input
            disabled={disabled}
            id="retryDelayMs"
            onChange={(e) => onUpdateConfig("retryDelayMs", e.target.value)}
            placeholder="500"
            value={(config?.retryDelayMs as string) || ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeoutMs">Timeout (ms)</Label>
          <Input
            disabled={disabled}
            id="timeoutMs"
            onChange={(e) => onUpdateConfig("timeoutMs", e.target.value)}
            placeholder="10000"
            value={(config?.timeoutMs as string) || ""}
          />
        </div>
      </div>
    </div>
  );
}

// System action fields wrapper - extracts conditional rendering to reduce complexity
function SystemActionFields({
  actionType,
  config,
  onUpdateConfig,
  disabled,
}: {
  actionType: string;
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: string) => void;
  disabled: boolean;
}) {
  switch (actionType) {
    case "HTTP Request":
      return (
        <HttpRequestFields
          config={config}
          disabled={disabled}
          onUpdateConfig={onUpdateConfig}
        />
      );
    case "Database Query":
      return (
        <DatabaseQueryFields
          config={config}
          disabled={disabled}
          onUpdateConfig={onUpdateConfig}
        />
      );
    case "Condition":
      return (
        <ConditionFields
          config={config}
          disabled={disabled}
          onUpdateConfig={onUpdateConfig}
        />
      );
    case "Delay":
      return (
        <DelayFields
          config={config}
          disabled={disabled}
          onUpdateConfig={onUpdateConfig}
        />
      );
    case "Set Variable":
      return (
        <VariableFields
          config={config}
          disabled={disabled}
          onUpdateConfig={onUpdateConfig}
          mode="set"
        />
      );
    case "Get Variable":
      return (
        <VariableFields
          config={config}
          disabled={disabled}
          onUpdateConfig={onUpdateConfig}
          mode="get"
        />
      );
    default:
      return null;
  }
}

// System actions that don't have plugins
const SYSTEM_ACTIONS: Array<{ id: string; label: string }> = [
  { id: "HTTP Request", label: "Requisicao HTTP" },
  { id: "Database Query", label: "Consulta ao banco" },
  { id: "Condition", label: "Condicao" },
];

const SYSTEM_ACTION_IDS = SYSTEM_ACTIONS.map((a) => a.id);

// System actions that need integrations (not in plugin registry)
const SYSTEM_ACTION_INTEGRATIONS: Record<string, IntegrationType> = {
  "Database Query": "database",
};

// Build category mapping dynamically from plugins + System
function useCategoryData() {
  return useMemo(() => {
    const pluginCategories = getActionsByCategory();

    // Build category map including System with both id and label
    const allCategories: Record<string, Array<{ id: string; label: string }>> = {
      Sistema: SYSTEM_ACTIONS,
    };

    for (const [category, actions] of Object.entries(pluginCategories || {})) {
      if (!Array.isArray(actions)) {
        continue;
      }
      allCategories[category] = actions.map((a) => ({
        id: a.id,
        label: a.label,
      }));
    }

    return allCategories;
  }, []);
}

// Get category for an action type (supports both new IDs, labels, and legacy labels)
function getCategoryForAction(actionType: string): string | null {
  // Check system actions first
  if (SYSTEM_ACTION_IDS.includes(actionType)) {
    return "Sistema";
  }

  // Use findActionById which handles legacy labels from plugin registry
  const action = findActionById(actionType);
  if (action?.category) {
    return action.category;
  }

  return null;
}

// Normalize action type to new ID format (handles legacy labels via findActionById)
function normalizeActionType(actionType: string): string {
  // Check system actions first - they use their label as ID
  if (SYSTEM_ACTION_IDS.includes(actionType)) {
    return actionType;
  }

  // Use findActionById which handles legacy labels and returns the proper ID
  const action = findActionById(actionType);
  if (action) {
    return action.id;
  }

  return actionType;
}

export function ActionConfig({
  config,
  onUpdateConfig,
  disabled,
  isOwner = true,
}: ActionConfigProps) {
  const actionType = (config?.actionType as string) || "";
  const categories = useCategoryData();
  const integrations = useMemo(() => getAllIntegrations(), []);

  const selectedCategory = actionType ? getCategoryForAction(actionType) : null;
  const [category, setCategory] = useState<string>(selectedCategory || "");
  const setIntegrationsVersion = useSetAtom(integrationsVersionAtom);
  const globalIntegrations = useAtomValue(integrationsAtom);
  const { push } = useOverlay();

  // AI Gateway managed keys state
  const aiGatewayStatus = useAtomValue(aiGatewayStatusAtom);

  // Sync category state when actionType changes (e.g., when switching nodes)
  useEffect(() => {
    const newCategory = actionType ? getCategoryForAction(actionType) : null;
    setCategory(newCategory || "");
  }, [actionType]);

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    // Auto-select the first action in the new category
    const firstAction = categories[newCategory]?.[0];
    if (firstAction) {
      onUpdateConfig("actionType", firstAction.id);
    }
  };

  const handleActionTypeChange = (value: string) => {
    onUpdateConfig("actionType", value);
  };

  // Adapter for plugin config components that expect (key, value: unknown)
  const handlePluginUpdateConfig = (key: string, value: unknown) => {
    onUpdateConfig(key, String(value));
  };

  // Get dynamic config fields for plugin actions
  const pluginAction = actionType ? findActionById(actionType) : null;
  const isSendTemplateAction = pluginAction?.slug === "send-template";
  const isSendButtonsAction = pluginAction?.slug === "send-buttons";
  const isWhatsappAction = pluginAction?.integration === "whatsapp";
  const templateNameValue = String(config?.templateName || "");
  const parameterFormat = String(config?.parameterFormat || "positional");
  const bodyValue = String(config?.body || "");
  const headerTextValue = String(config?.headerText || "");
  const footerValue = String(config?.footer || "");
  const [buttonPreset, setButtonPreset] = useState("none");
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(headerTextValue || footerValue)
  );

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: templateService.getAll,
    enabled: Boolean(isSendTemplateAction),
  });

  const { data: customFields = [] } = useQuery<CustomFieldDefinition[]>({
    queryKey: ["customFields", "contact"],
    queryFn: () => customFieldService.getAll("contact"),
    enabled: Boolean(isSendTemplateAction),
  });

  const { data: testContact } = useQuery<{
    name?: string;
    phone?: string;
    email?: string | null;
    custom_fields?: Record<string, unknown>;
  } | null>({
    queryKey: ["testContact"],
    queryFn: async () => {
      const response = await fetch("/api/settings/test-contact", {
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = await response.json().catch(() => null);
      if (!data || (data as any)?.error) return null;
      return data;
    },
    enabled: Boolean(isSendTemplateAction),
  });

  const templateOptions = useMemo(() => {
    const names = templates
      .map((template) => String(template?.name || "").trim())
      .filter(Boolean);
    const unique = Array.from(new Set(names));
    unique.sort((a, b) => a.localeCompare(b));
    return unique.map((name) => ({ label: name, value: name }));
  }, [templates]);

  const templateOptionsWithCurrent = useMemo(() => {
    if (!templateNameValue) return templateOptions;
    const exists = templateOptions.some(
      (option) => option.value === templateNameValue
    );
    if (exists) return templateOptions;
    return [
      { label: `${templateNameValue} (atual)`, value: templateNameValue },
      ...templateOptions,
    ];
  }, [templateNameValue, templateOptions]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.name === templateNameValue),
    [templates, templateNameValue]
  );

  const templateFormat =
    (selectedTemplate?.parameterFormat as string | undefined) ||
    parameterFormat ||
    "positional";
  const templateLanguage = selectedTemplate?.language || "";

  const bodyTemplateText = useMemo(() => {
    const bodyComponent = getTemplateComponent(selectedTemplate, "BODY");
    return bodyComponent?.text || selectedTemplate?.content || "";
  }, [selectedTemplate]);
  const headerTemplateText = useMemo(() => {
    const headerComponent = getTemplateComponent(selectedTemplate, "HEADER");
    if (!headerComponent || headerComponent.format !== "TEXT") {
      return "";
    }
    return headerComponent.text || "";
  }, [selectedTemplate]);
  const footerTemplateText = useMemo(() => {
    const footerComponent = getTemplateComponent(selectedTemplate, "FOOTER");
    return footerComponent?.text || "";
  }, [selectedTemplate]);

  const bodyParamKeys = useMemo(
    () =>
      extractTemplateKeys(
        `${bodyTemplateText}\n${footerTemplateText}`,
        templateFormat
      ),
    [bodyTemplateText, footerTemplateText, templateFormat]
  );
  const headerParamKeys = useMemo(
    () => extractTemplateKeys(headerTemplateText, templateFormat),
    [headerTemplateText, templateFormat]
  );
  const headerParamKeysForUi = useMemo(
    () => headerParamKeys.slice(0, 1),
    [headerParamKeys]
  );
  const buttonParamIndex = useMemo(
    () => findFirstDynamicButtonIndex(selectedTemplate),
    [selectedTemplate]
  );
  const hasTemplateParams =
    bodyParamKeys.length > 0 ||
    headerParamKeys.length > 0 ||
    buttonParamIndex !== null;

  const bodyParamsMap = useMemo(
    () => paramsToMap(config?.bodyParams),
    [config?.bodyParams]
  );
  const headerParamsMap = useMemo(
    () => paramsToMap(config?.headerParams),
    [config?.headerParams]
  );
  const buttonParamInput = useMemo(
    () => buttonParamToInput(config?.buttonParams),
    [config?.buttonParams]
  );
  const dynamicButtonLabel = useMemo(
    () => getButtonLabelByIndex(selectedTemplate, buttonParamIndex),
    [selectedTemplate, buttonParamIndex]
  );
  const systemFieldOptions = useMemo(
    () => [
      { label: "Nome do contato", token: "{{contact.name}}" },
      { label: "Telefone do contato", token: "{{contact.phone}}" },
      { label: "Email do contato", token: "{{contact.email}}" },
    ],
    []
  );
  const customFieldOptions = useMemo(
    () =>
      customFields
        .map((field) => ({
          key: String(field.key || "").trim(),
          label: String(field.label || field.key || "").trim(),
        }))
        .filter((field) => field.key && field.label),
    [customFields]
  );

  const testContactLabel = useMemo(() => {
    if (!testContact?.phone) return "";
    return getTestContactLabel(testContact as any);
  }, [testContact]);

  const autoFillHint = testContactLabel
    ? `Usando: ${testContactLabel}`
    : "Configure um contato teste em Configuracoes.";

  const pickTokenForKey = (
    key: string,
    fallbackTokens: string[],
    fallbackIndex: { value: number }
  ) => {
    const lower = key.toLowerCase();
    if (lower.includes("nome") || lower.includes("name")) {
      return "{{contact.name}}";
    }
    if (lower.includes("telefone") || lower.includes("phone")) {
      return "{{contact.phone}}";
    }
    if (lower.includes("email")) {
      return "{{contact.email}}";
    }
    if (customFieldOptions.some((option) => option.key === key)) {
      return `{{${key}}}`;
    }
    if (fallbackIndex.value < fallbackTokens.length) {
      const token = fallbackTokens[fallbackIndex.value];
      fallbackIndex.value += 1;
      return token;
    }
    return "";
  };

  const handleAutoFill = () => {
    const fallbackTokens = systemFieldOptions.map((option) => option.token);
    const fallbackIndex = { value: 0 };
    const nextBodyMap = { ...bodyParamsMap };
    const nextHeaderMap = { ...headerParamsMap };

    if (headerParamKeysForUi.length > 0) {
      const headerKey = headerParamKeysForUi[0];
      if (!nextHeaderMap[headerKey]) {
        const token = pickTokenForKey(
          headerKey,
          fallbackTokens,
          fallbackIndex
        );
        if (token) nextHeaderMap[headerKey] = token;
      }
    }

    bodyParamKeys.forEach((key) => {
      if (nextBodyMap[key]) return;
      const token = pickTokenForKey(key, fallbackTokens, fallbackIndex);
      if (token) nextBodyMap[key] = token;
    });

    const nextBodyParams = buildParamsFromMap(
      nextBodyMap,
      bodyParamKeys,
      templateFormat
    );
    onUpdateConfig("bodyParams", JSON.stringify(nextBodyParams));

    if (headerParamKeysForUi.length > 0) {
      const headerParams = buildParamsFromMap(
        nextHeaderMap,
        headerParamKeysForUi,
        templateFormat
      );
      const first = headerParams.length > 0 ? [headerParams[0]] : [];
      onUpdateConfig("headerParams", JSON.stringify(first));
    }
  };

  const updateBodyParamValue = (key: string, value: string) => {
    const nextMap = { ...bodyParamsMap };
    if (String(value || "").trim()) {
      nextMap[key] = value;
    } else {
      delete nextMap[key];
    }
    const keys = Array.from(new Set([...bodyParamKeys, key]));
    const params = buildParamsFromMap(nextMap, keys, templateFormat);
    onUpdateConfig("bodyParams", JSON.stringify(params));
  };

  const updateHeaderParamValue = (key: string, value: string) => {
    const nextMap = { ...headerParamsMap };
    if (String(value || "").trim()) {
      nextMap[key] = value;
    } else {
      delete nextMap[key];
    }
    const keys = Array.from(new Set([...headerParamKeysForUi, key]));
    const params = buildParamsFromMap(nextMap, keys, templateFormat);
    const first = params.length > 0 ? [params[0]] : [];
    onUpdateConfig("headerParams", JSON.stringify(first));
  };

  const pluginFields: ActionConfigField[] = useMemo(() => {
    if (!pluginAction) return [];
    if (!isSendTemplateAction && !isSendButtonsAction && !isWhatsappAction) {
      return pluginAction.configFields;
    }

    const filtered = pluginAction.configFields
      .map((field) => {
        if (isFieldGroup(field)) {
          const fields = field.fields.filter((inner) => {
            if (
              isSendTemplateAction &&
              [
                "templateName",
                "toSource",
                "to",
                "language",
                "parameterFormat",
                "bodyParams",
                "headerParams",
                "buttonParams",
              ].includes(inner.key)
            ) {
              return false;
            }
            if (
              isSendButtonsAction &&
              ["toSource", "to", "body", "headerText", "footer", "buttons"].includes(
                inner.key
              )
            ) {
              return false;
            }
            if (isWhatsappAction && ["toSource", "to"].includes(inner.key)) {
              return false;
            }
            return true;
          });
          return { ...field, fields };
        }
        return field;
      })
      .filter((field) => {
        if (isFieldGroup(field)) return field.fields.length > 0;
        if (
          isSendTemplateAction &&
          [
            "templateName",
            "toSource",
            "to",
            "language",
            "parameterFormat",
            "bodyParams",
            "headerParams",
            "buttonParams",
          ].includes(field.key)
        ) {
          return false;
        }
        if (
          isSendButtonsAction &&
          ["toSource", "to", "body", "headerText", "footer", "buttons"].includes(
            field.key
          )
        ) {
          return false;
        }
        if (isWhatsappAction && ["toSource", "to"].includes(field.key)) {
          return false;
        }
        return true;
      });

    return filtered;
  }, [isSendButtonsAction, isSendTemplateAction, isWhatsappAction, pluginAction]);

  const buttonTitles = useMemo(() => {
    const titles = normalizeButtonTitles(config?.buttons);
    while (titles.length < 3) {
      titles.push("");
    }
    return titles.slice(0, 3);
  }, [config?.buttons]);

  const hasButtons = useMemo(
    () => buildButtonsFromTitles(buttonTitles).length > 0,
    [buttonTitles]
  );
  const hasBody = bodyValue.trim().length > 0;
  const hasTooLongTitle = buttonTitles.some(
    (title) => String(title).trim().length > 20
  );
  const footerTooLong = footerValue.trim().length > 60;

  useEffect(() => {
    if (!isWhatsappAction) return;
    if (config?.toSource !== "inbound") {
      onUpdateConfig("toSource", "inbound");
    }
    if (config?.to) {
      onUpdateConfig("to", "");
    }
  }, [config?.to, config?.toSource, isWhatsappAction, onUpdateConfig]);

  useEffect(() => {
    if (!isSendTemplateAction) return;
    if (templateLanguage && config?.language !== templateLanguage) {
      onUpdateConfig("language", templateLanguage);
    }
    if (
      templateFormat &&
      config?.parameterFormat !== templateFormat
    ) {
      onUpdateConfig("parameterFormat", templateFormat);
    }
  }, [
    config?.language,
    config?.parameterFormat,
    isSendTemplateAction,
    onUpdateConfig,
    templateFormat,
    templateLanguage,
  ]);

  useEffect(() => {
    if (headerTextValue || footerValue) {
      setShowAdvanced(true);
    }
  }, [footerValue, headerTextValue]);

  const handleButtonTitleChange = (index: number, value: string) => {
    const nextTitles = [...buttonTitles];
    nextTitles[index] = value;
    const nextButtons = buildButtonsFromTitles(nextTitles);
    onUpdateConfig("buttons", JSON.stringify(nextButtons));
    setButtonPreset("none");
  };

  const handlePresetChange = (value: string) => {
    setButtonPreset(value);
    const preset = BUTTON_PRESETS.find((item) => item.id === value);
    if (!preset) return;
    const nextTitles = [...preset.titles, "", "", ""].slice(0, 3);
    const nextButtons = buildButtonsFromTitles(nextTitles);
    onUpdateConfig("buttons", JSON.stringify(nextButtons));
  };

  // Determine the integration type for the current action
  const integrationType: IntegrationType | undefined = useMemo(() => {
    if (!actionType) {
      return;
    }

    // Check system actions first
    if (SYSTEM_ACTION_INTEGRATIONS[actionType]) {
      return SYSTEM_ACTION_INTEGRATIONS[actionType];
    }

    // Check plugin actions
    const action = findActionById(actionType);
    return action?.integration as IntegrationType | undefined;
  }, [actionType]);

  // Check if AI Gateway managed keys should be offered (user can have multiple for different teams)
  const shouldUseManagedKeys =
    integrationType === "ai-gateway" &&
    aiGatewayStatus?.enabled &&
    aiGatewayStatus?.isVercelUser;

  // Check if there are existing connections for this integration type
  const hasExistingConnections = useMemo(() => {
    if (!integrationType) return false;
    return globalIntegrations.some((i) => i.type === integrationType);
  }, [integrationType, globalIntegrations]);

  const handleConsentSuccess = (integrationId: string) => {
    onUpdateConfig("integrationId", integrationId);
    setIntegrationsVersion((v) => v + 1);
  };

  const openConnectionOverlay = () => {
    if (integrationType) {
      push(ConfigureConnectionOverlay, {
        type: integrationType,
        onSuccess: (integrationId: string) => {
          setIntegrationsVersion((v) => v + 1);
          onUpdateConfig("integrationId", integrationId);
        },
      });
    }
  };

  const handleAddSecondaryConnection = () => {
    if (shouldUseManagedKeys) {
      push(AiGatewayConsentOverlay, {
        onConsent: handleConsentSuccess,
        onManualEntry: openConnectionOverlay,
      });
    } else {
      openConnectionOverlay();
    }
  };

  const showConnection = Boolean(
    integrationType && isOwner && integrationType !== "whatsapp"
  );
  const showExecutionFields = false;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label className="ml-1" htmlFor="actionCategory">
            Service
          </Label>
          <Select
            disabled={disabled}
            onValueChange={handleCategoryChange}
            value={category || undefined}
          >
            <SelectTrigger className="w-full" id="actionCategory">
            <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="System">
                <div className="flex items-center gap-2">
                  <Settings className="size-4" />
                  <span>Sistema</span>
                </div>
              </SelectItem>
              <SelectSeparator />
              {integrations.map((integration) => (
                <SelectItem key={integration.type} value={integration.label}>
                  <div className="flex items-center gap-2">
                    <IntegrationIcon
                      className="size-4"
                      integration={integration.type}
                    />
                    <span>{integration.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="ml-1" htmlFor="actionType">
            Ação
          </Label>
          <Select
            disabled={disabled || !category}
            onValueChange={handleActionTypeChange}
            value={normalizeActionType(actionType) || undefined}
          >
            <SelectTrigger className="w-full" id="actionType">
              <SelectValue placeholder="Selecione a ação" />
            </SelectTrigger>
            <SelectContent>
              {category &&
                categories[category]?.map((action) => (
                  <SelectItem key={action.id} value={action.id}>
                    {action.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showConnection && integrationType && (
        <div className="space-y-2">
          <div className="ml-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Label>Conexão</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chave de API ou credenciais OAuth deste servico</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {hasExistingConnections && (
              <Button
                className="size-6"
                disabled={disabled}
                onClick={handleAddSecondaryConnection}
                size="icon"
                variant="ghost"
              >
                <Plus className="size-4" />
              </Button>
            )}
          </div>
          <IntegrationSelector
            disabled={disabled}
            integrationType={integrationType}
            onChange={(id) => onUpdateConfig("integrationId", id)}
            value={(config?.integrationId as string) || ""}
          />
        </div>
      )}

      {/* System actions - hardcoded config fields */}
      <SystemActionFields
        actionType={(config?.actionType as string) || ""}
        config={config}
        disabled={disabled}
        onUpdateConfig={onUpdateConfig}
      />

      {actionType && showExecutionFields && (
        <ExecutionFields
          config={config}
          disabled={disabled}
          onUpdateConfig={onUpdateConfig}
        />
      )}

      {/* Plugin actions - declarative config fields */}
      {pluginAction && !SYSTEM_ACTION_IDS.includes(actionType) && (
        <div className="space-y-4">
          {isSendTemplateAction && (
            <div className="space-y-2">
              <Label className="ml-1" htmlFor="templateName">
                Nome do template
              </Label>
              {templateOptionsWithCurrent.length > 0 ? (
                <Select
                  disabled={disabled}
                  onValueChange={(value) => onUpdateConfig("templateName", value)}
                  value={templateNameValue}
                >
                  <SelectTrigger className="w-full" id="templateName">
                    <SelectValue placeholder="Selecione o template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templateOptionsWithCurrent.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  disabled={disabled}
                  id="templateName"
                  onChange={(e) =>
                    onUpdateConfig("templateName", e.target.value)
                  }
                  placeholder="welcome_message"
                  value={templateNameValue}
                />
              )}
              {templateOptionsWithCurrent.length === 0 &&
                !templatesLoading && (
                  <p className="text-muted-foreground text-xs">
                    Nenhum template encontrado. Sincronize em Templates para
                    popular a lista.
                  </p>
                )}
            </div>
          )}
          {isSendTemplateAction && hasTemplateParams && (
            <TemplatePreviewEditor
              bodyParamsMap={bodyParamsMap}
              bodyText={bodyTemplateText}
              buttonLabel={dynamicButtonLabel}
              buttonParamIndex={buttonParamIndex}
              buttonParamValue={buttonParamInput}
              bodyKeys={bodyParamKeys}
              customFieldOptions={customFieldOptions}
              disabled={disabled}
              footerText={footerTemplateText}
              headerParamsMap={headerParamsMap}
              headerText={headerTemplateText}
              headerKeys={headerParamKeysForUi}
              autoFillDisabled={!testContact?.phone}
              autoFillLabel={autoFillHint}
              onAutoFill={handleAutoFill}
              onUpdateBodyParam={updateBodyParamValue}
              onUpdateButtonParam={(value) => {
                const params = buildButtonParamsFromInput(
                  String(value || ""),
                  buttonParamIndex
                );
                onUpdateConfig("buttonParams", JSON.stringify(params));
              }}
              onUpdateHeaderParam={updateHeaderParamValue}
              systemFieldOptions={systemFieldOptions}
              testContact={testContact ?? null}
              templateFormat={templateFormat}
            />
          )}
          {isSendTemplateAction && !hasTemplateParams && templateNameValue && (
            <p className="text-muted-foreground text-xs">
              Este template nao exige variaveis.
            </p>
          )}
          {isSendButtonsAction && (
            <>
              <div className="space-y-2">
                <Label className="ml-1" htmlFor="body">
                  Corpo *
                </Label>
                <TemplateBadgeTextarea
                  disabled={disabled}
                  id="body"
                  onChange={(value) => onUpdateConfig("body", value)}
                  placeholder="Escolha uma opcao"
                  rows={3}
                  value={bodyValue}
                />
                {!hasBody && (
                  <p className="text-xs text-destructive">
                    Corpo e obrigatorio.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="ml-1">Presets</Label>
                <Select
                  disabled={disabled}
                  onValueChange={handlePresetChange}
                  value={buttonPreset}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha um preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTON_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="ml-1">Botoes *</Label>
                <div className="space-y-2">
                  {["Botao 1", "Botao 2", "Botao 3 (opcional)"].map(
                    (label, index) => (
                      <div className="space-y-1" key={label}>
                        <Label className="text-xs text-muted-foreground" htmlFor={`button-title-${index}`}>
                          {label}
                        </Label>
                        <Input
                          disabled={disabled}
                          id={`button-title-${index}`}
                          onChange={(e) =>
                            handleButtonTitleChange(index, e.target.value)
                          }
                          placeholder={
                            index === 0
                              ? "Sim"
                              : index === 1
                                ? "Nao"
                                : "Outro"
                          }
                          value={buttonTitles[index] || ""}
                        />
                      </div>
                    )
                  )}
                </div>
                {!hasButtons && (
                  <p className="text-xs text-destructive">
                    Adicione pelo menos 1 botao.
                  </p>
                )}
                {hasTooLongTitle && (
                  <p className="text-xs text-destructive">
                    Cada botao deve ter no maximo 20 caracteres.
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Maximo de 3 botoes. O ID e gerado automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={showAdvanced}
                    disabled={disabled}
                    onCheckedChange={(value) => {
                      const next = Boolean(value);
                      setShowAdvanced(next);
                      if (!next) {
                        onUpdateConfig("headerText", "");
                        onUpdateConfig("footer", "");
                      }
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    Mais opcoes (cabecalho e rodape)
                  </span>
                </div>
                {showAdvanced && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="headerText">Texto do cabecalho</Label>
                      <Input
                        disabled={disabled}
                        id="headerText"
                        onChange={(e) =>
                          onUpdateConfig("headerText", e.target.value)
                        }
                        placeholder="Opcional"
                        value={headerTextValue}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="footer">Rodape</Label>
                      <Input
                        disabled={disabled}
                        id="footer"
                        onChange={(e) =>
                          onUpdateConfig("footer", e.target.value)
                        }
                        placeholder="Opcional"
                        value={footerValue}
                      />
                      {footerTooLong && (
                        <p className="text-xs text-destructive">
                          Rodape deve ter no maximo 60 caracteres.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {(!isSendButtonsAction || pluginFields.length > 0) && (
            <ActionConfigRenderer
              config={config}
              disabled={disabled}
              fields={pluginFields}
              onUpdateConfig={handlePluginUpdateConfig}
            />
          )}
          {pluginAction.integration === "whatsapp" && !isSendTemplateAction && (
            <WhatsAppPreview
              actionType={actionType}
              config={config}
              template={selectedTemplate}
            />
          )}
        </div>
      )}
    </>
  );
}
