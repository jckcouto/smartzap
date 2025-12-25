import type { ComponentType } from "react";
import type { IntegrationType } from "./types/integration";

export type SelectOption = {
  value: string;
  label: string;
};

export type ActionConfigFieldBase = {
  key: string;
  label: string;
  type:
    | "template-input"
    | "template-textarea"
    | "text"
    | "number"
    | "select"
    | "schema-builder";
  placeholder?: string;
  defaultValue?: string;
  example?: string;
  options?: SelectOption[];
  rows?: number;
  min?: number;
  required?: boolean;
  showWhen?: {
    field: string;
    equals: string;
  };
};

export type ActionConfigFieldGroup = {
  label: string;
  type: "group";
  fields: ActionConfigFieldBase[];
  defaultExpanded?: boolean;
};

export type ActionConfigField = ActionConfigFieldBase | ActionConfigFieldGroup;

export type OutputField = {
  field: string;
  description: string;
};

export type ResultComponentProps = {
  output: unknown;
  input?: unknown;
};

export type OutputDisplayConfig =
  | {
      type: "image" | "video" | "url";
      field: string;
    }
  | {
      type: "component";
      component: ComponentType<ResultComponentProps>;
    };

export type PluginAction = {
  slug: string;
  label: string;
  description: string;
  category: string;
  stepFunction: string;
  stepImportPath: string;
  configFields: ActionConfigField[];
  outputFields?: OutputField[];
  outputConfig?: OutputDisplayConfig;
  codegenTemplate?: string;
};

export type ActionWithFullId = PluginAction & {
  id: string;
  integration: IntegrationType;
};

export type IntegrationPlugin = {
  type: IntegrationType;
  label: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  formFields?: Array<{
    id: string;
    label: string;
    type: "text" | "password" | "url";
    placeholder?: string;
    helpText?: string;
    helpLink?: { text: string; url: string };
    configKey: string;
    envVar?: string;
  }>;
  actions: PluginAction[];
};

const integrations: IntegrationPlugin[] = [
  {
    type: "whatsapp",
    label: "WhatsApp",
    description: "Send WhatsApp messages",
    actions: [
      {
        slug: "send-message",
        label: "Send Message",
        description: "Send a text message",
        category: "WhatsApp",
        stepFunction: "sendMessageStep",
        stepImportPath: "whatsapp/send-message",
        configFields: [
          {
            key: "toSource",
            label: "Recipient",
            type: "select",
            options: [
              { label: "From inbound message", value: "inbound" },
              { label: "Manual number", value: "manual" },
            ],
            defaultValue: "inbound",
          },
          {
            key: "to",
            label: "To",
            type: "template-input",
            placeholder: "+5511999999999",
            showWhen: { field: "toSource", equals: "manual" },
          },
          {
            key: "message",
            label: "Message",
            type: "template-textarea",
            placeholder: "Type your message",
            required: true,
          },
          {
            key: "previewUrl",
            label: "Preview URL",
            type: "select",
            options: [
              { label: "Off", value: "false" },
              { label: "On", value: "true" },
            ],
          },
        ],
        outputFields: [{ field: "messageId", description: "Message ID" }],
      },
      {
        slug: "send-template",
        label: "Send Template",
        description: "Send a template message",
        category: "WhatsApp",
        stepFunction: "sendTemplateStep",
        stepImportPath: "whatsapp/send-template",
        configFields: [
          {
            key: "toSource",
            label: "Recipient",
            type: "select",
            options: [
              { label: "From inbound message", value: "inbound" },
              { label: "Manual number", value: "manual" },
            ],
            defaultValue: "inbound",
          },
          {
            key: "to",
            label: "To",
            type: "template-input",
            placeholder: "+5511999999999",
            showWhen: { field: "toSource", equals: "manual" },
          },
          {
            key: "templateName",
            label: "Template Name",
            type: "text",
            placeholder: "welcome_message",
            required: true,
          },
          {
            key: "language",
            label: "Language",
            type: "text",
            placeholder: "pt_BR",
            defaultValue: "pt_BR",
          },
          {
            key: "parameterFormat",
            label: "Parameter Format",
            type: "select",
            options: [
              { label: "Positional", value: "positional" },
              { label: "Named", value: "named" },
            ],
            defaultValue: "positional",
          },
          {
            key: "bodyParams",
            label: "Body Parameters (JSON)",
            type: "template-textarea",
            placeholder: '[{"key":"1","text":"John"}]',
            rows: 4,
          },
          {
            key: "headerParams",
            label: "Header Parameters (JSON)",
            type: "template-textarea",
            placeholder: '[{"key":"1","text":"Hello"}]',
            rows: 3,
          },
          {
            key: "buttonParams",
            label: "Button Parameters (JSON)",
            type: "template-textarea",
            placeholder: '[{"index":0,"params":[{"text":"https://example.com"}]}]',
            rows: 3,
          },
        ],
        outputFields: [{ field: "messageId", description: "Message ID" }],
      },
      {
        slug: "send-media",
        label: "Send Media",
        description: "Send an image, video, audio, or document",
        category: "WhatsApp",
        stepFunction: "sendMediaStep",
        stepImportPath: "whatsapp/send-media",
        configFields: [
          {
            key: "toSource",
            label: "Recipient",
            type: "select",
            options: [
              { label: "From inbound message", value: "inbound" },
              { label: "Manual number", value: "manual" },
            ],
            defaultValue: "inbound",
          },
          {
            key: "to",
            label: "To",
            type: "template-input",
            placeholder: "+5511999999999",
            showWhen: { field: "toSource", equals: "manual" },
          },
          {
            key: "mediaType",
            label: "Media Type",
            type: "select",
            options: [
              { label: "Image", value: "image" },
              { label: "Video", value: "video" },
              { label: "Audio", value: "audio" },
              { label: "Document", value: "document" },
              { label: "Sticker", value: "sticker" },
            ],
            defaultValue: "image",
          },
          {
            key: "mediaUrl",
            label: "Media URL",
            type: "template-input",
            placeholder: "https://example.com/file.png",
          },
          {
            key: "mediaId",
            label: "Media ID",
            type: "text",
            placeholder: "Use if already uploaded",
          },
          {
            key: "caption",
            label: "Caption",
            type: "template-textarea",
            placeholder: "Optional caption",
            rows: 3,
          },
          {
            key: "filename",
            label: "Filename",
            type: "text",
            placeholder: "document.pdf",
          },
        ],
        outputFields: [{ field: "messageId", description: "Message ID" }],
      },
      {
        slug: "send-buttons",
        label: "Buttons",
        description: "Send interactive reply buttons",
        category: "WhatsApp",
        stepFunction: "sendButtonsStep",
        stepImportPath: "whatsapp/send-buttons",
        configFields: [
          {
            key: "toSource",
            label: "Recipient",
            type: "select",
            options: [
              { label: "From inbound message", value: "inbound" },
              { label: "Manual number", value: "manual" },
            ],
            defaultValue: "inbound",
          },
          {
            key: "to",
            label: "To",
            type: "template-input",
            placeholder: "+5511999999999",
            showWhen: { field: "toSource", equals: "manual" },
          },
          {
            key: "body",
            label: "Body",
            type: "template-textarea",
            placeholder: "Choose an option",
            rows: 3,
            required: true,
          },
          {
            key: "headerText",
            label: "Header Text",
            type: "text",
            placeholder: "Optional header",
          },
          {
            key: "footer",
            label: "Footer",
            type: "text",
            placeholder: "Optional footer",
          },
          {
            key: "buttons",
            label: "Buttons (JSON)",
            type: "template-textarea",
            placeholder: '[{"id":"yes","title":"Yes"},{"id":"no","title":"No"}]',
            rows: 4,
            required: true,
          },
        ],
        outputFields: [{ field: "messageId", description: "Message ID" }],
      },
      {
        slug: "send-list",
        label: "List",
        description: "Send an interactive list",
        category: "WhatsApp",
        stepFunction: "sendListStep",
        stepImportPath: "whatsapp/send-list",
        configFields: [
          {
            key: "toSource",
            label: "Recipient",
            type: "select",
            options: [
              { label: "From inbound message", value: "inbound" },
              { label: "Manual number", value: "manual" },
            ],
            defaultValue: "inbound",
          },
          {
            key: "to",
            label: "To",
            type: "template-input",
            placeholder: "+5511999999999",
            showWhen: { field: "toSource", equals: "manual" },
          },
          {
            key: "body",
            label: "Body",
            type: "template-textarea",
            placeholder: "Select an option",
            rows: 3,
            required: true,
          },
          {
            key: "buttonText",
            label: "Button Text",
            type: "text",
            placeholder: "Options",
            required: true,
          },
          {
            key: "headerText",
            label: "Header Text",
            type: "text",
            placeholder: "Optional header",
          },
          {
            key: "footer",
            label: "Footer",
            type: "text",
            placeholder: "Optional footer",
          },
          {
            key: "sections",
            label: "Sections (JSON)",
            type: "template-textarea",
            placeholder:
              '[{"title":"Main","rows":[{"id":"1","title":"Option 1","description":"Details"}]}]',
            rows: 5,
            required: true,
          },
        ],
        outputFields: [{ field: "messageId", description: "Message ID" }],
      },
    ],
  },
];

function getSafeIntegrations(): IntegrationPlugin[] {
  return integrations.filter((integration) => Array.isArray(integration.actions));
}

export function isFieldGroup(
  field: ActionConfigField
): field is ActionConfigFieldGroup {
  return field.type === "group";
}

export function computeActionId(
  integration: IntegrationType,
  slug: string
): string {
  return `${integration}/${slug}`;
}

export function flattenConfigFields(
  fields: ActionConfigField[]
): ActionConfigFieldBase[] {
  const flattened: ActionConfigFieldBase[] = [];
  for (const field of fields) {
    if (isFieldGroup(field)) {
      flattened.push(...field.fields);
    } else {
      flattened.push(field);
    }
  }
  return flattened;
}

export function getAllIntegrations(): IntegrationPlugin[] {
  return getSafeIntegrations();
}

export function getIntegration(type: IntegrationType | undefined) {
  if (!type) return undefined;
  return getSafeIntegrations().find((integration) => integration.type === type);
}

export function getIntegrationLabels(): Record<string, string> {
  return getSafeIntegrations().reduce((acc, integration) => {
    acc[integration.type] = integration.label;
    return acc;
  }, {} as Record<string, string>);
}

export function getSortedIntegrationTypes(): IntegrationType[] {
  return getSafeIntegrations()
    .map((integration) => integration.type)
    .sort((a, b) => a.localeCompare(b));
}

export function getActionsByCategory(): Record<string, ActionWithFullId[]> {
  const categories: Record<string, ActionWithFullId[]> = {};

  for (const integration of getSafeIntegrations()) {
    const actions = Array.isArray(integration.actions)
      ? integration.actions
      : [];
    for (const action of actions) {
      const category = action.category || "Other";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({
        ...action,
        id: computeActionId(integration.type, action.slug),
        integration: integration.type,
      });
    }
  }

  return categories;
}

export function getAllActions(): ActionWithFullId[] {
  const categories = getActionsByCategory();
  return Object.values(categories).flat();
}

export function findActionById(actionId?: string): ActionWithFullId | undefined {
  if (!actionId) return undefined;
  return getAllActions().find(
    (action) =>
      action.id === actionId ||
      action.slug === actionId ||
      `${action.integration}/${action.slug}` === actionId
  );
}

export function getCredentialMapping(_type: IntegrationType) {
  return {};
}
