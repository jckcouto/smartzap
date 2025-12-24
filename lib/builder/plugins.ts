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
        stepImportPath: "send-message",
        configFields: [
          {
            key: "to",
            label: "To",
            type: "template-input",
            placeholder: "+5511999999999",
            required: true,
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
