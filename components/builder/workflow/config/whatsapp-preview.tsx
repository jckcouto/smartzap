"use client";

import { cn } from "@/lib/builder/utils";

type PreviewProps = {
  actionType: string;
  config: Record<string, unknown>;
};

function getPreviewText(actionType: string, config: Record<string, unknown>) {
  switch (actionType) {
    case "Send Message":
    case "whatsapp/send-message":
      return String(config.message || "").trim() || "Your message preview";
    case "Send Template":
    case "whatsapp/send-template": {
      const name = String(config.templateName || "").trim() || "template_name";
      return `Template: ${name}`;
    }
    case "Buttons":
    case "whatsapp/send-buttons":
      return String(config.body || "").trim() || "Choose an option";
    case "List":
    case "whatsapp/send-list":
      return String(config.body || "").trim() || "Select an item";
    case "Send Media":
    case "whatsapp/send-media":
      return (
        String(config.caption || "").trim() ||
        "Media message (image/video/document)"
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
        WhatsApp Preview
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
                {button.title || "Button"}
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
