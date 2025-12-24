export type StepImporter = {
  importer: () => Promise<unknown>;
  stepFunction: string;
};

export function getStepImporter(_actionType: string): StepImporter | null {
  return null;
}

export function getActionLabel(actionType: string): string {
  return actionType;
}
