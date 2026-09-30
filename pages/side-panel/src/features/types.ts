// Shared view types for the side panel (frozen message contract — view only)

export type Turn = {
  id: string;
  speaker: string;
  text: string;
  parts: string[];
};

export type SuggestionOpt = {
  label: string;
  en: string;
  vi: string;
};

export type Suggestion = {
  options: SuggestionOpt[];
  heard: string;
  intent: string;
  latencyMs: number;
};

export type ScenarioInfo = {
  id: string;
  name: string;
  detail?: string;
};

export type Translation = {
  vi?: string;
  origin?: string;
  pending?: boolean;
  error?: string;
};
