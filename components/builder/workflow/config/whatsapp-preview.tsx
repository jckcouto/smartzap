"use client";

import { cn } from "@/lib/builder/útils";

type PreviewProps = {
  actionType: string;
  config: Record<string, unknown>;
};

function getPreviewText(actionType: string, config: Record<string, unknown>) {
  switch (actionType) {
    case "Send Message":
    case "Ask Question":
    case "whatsapp/send-message":
    case "whatsapp/ask-question":
      return String(config.message || "").trim() || "Preview da mensagem";
    case "Send Template":
    case "whatsapp/send-template": {
      const name =
        String(config.templateName || "").trim() || "nome_do_template";
      return `Template: ${name}`;
    }
    case "Buttons":
    case "whatsapp/send-buttons":
      return String(config.body || "").trim() || "Escolha uma opcao";
    case "List":
    case "whatsapp/send-list":
      return String(config.body || "").trim() || "Selecione um item";
    case "Send Media":
    case "whatsapp/send-media":
      return (
        String(config.caption || "").trim() ||
        "Mensagem de midia (imagem/video/documento)"
      );
    default:
      return "";
  }
}

function parseButtons(raw: unknown): Array<{ id?: string; title?: string }> {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSections(raw: unknown): Array<{ rows?: Array<{ title?: string }> }> {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function WhatsAppPreview({ actionType, config }: PreviewProps) {
  const text = getPreviewText(actionType, config);
  if (!text) return null;

  const buttons = parseButtons(config.buttons);
  const sections = parseSections(config.sections);

  return (
    <div className="rounded-xl border border-white/10 bg-black/60 p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        Preview do WhatsApp
      </div>
      <div className="mt-3 space-y-2">
        <div
          className={cn(
            "max-w-[260px] rounded-2xl rounded-bl-sm bg-emerald-500/10 px-4 py-3 text-sm text-white",
            "shadow-[0_0_24px_rgba(16,185,129,0.1)]"
          )}
        >
          {text}
        </div>

        {buttons.length > 0 && (
          <div className="space-y-2">
            {buttons.slice(0, 3).map((button, index) => (
              <div
                className="max-w-[260px] rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-xs text-white/80"
                key={`${button.id || button.title}-${index}`}
              >
                {button.title || "Botao"}
              </div>
            ))}
          </div>
        )}

        {sections.length > 0 && (
          <div className="max-w-[260px] rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white/70">
            {sections
              .flatMap((section) => section.rows || [])
              .slice(0, 3)
              .map((row, index) => (
                <div key={`${row.title}-${index}`}>{row.title || "Item"}</div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
