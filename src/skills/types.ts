export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  triggers: string[];
  model?: string;
  tools?: string[];
  prompt: string;
}

export interface SkillEntry {
  name: string;
  description: string;
  dirPath: string;
  manifest?: SkillManifest;
  loaded: boolean;
}
