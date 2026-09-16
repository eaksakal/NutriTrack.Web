import client from './client';

// Zu jedem Wert seine Herkunft: "aus der Datenbank" heisst, er ueberschreibt die
// Umgebungsvariable. Ohne diese Unterscheidung raetselt man, warum ein Eintrag nicht wirkt.
export interface AiSettings {
  model: string;
  modelFromDatabase: boolean;
  thinkingLevel: string;
  thinkingLevelFromDatabase: boolean;
  maxOutputTokens: number;
  maxOutputTokensFromDatabase: boolean;
}

export interface AiProbeResult {
  statusCode: number;
  durationMs: number;
  model: string;
  thinkingLevel: string;
  rawBody: string;
}

export interface AiFailure {
  occurredAt: string;
  kind: string;
  model: string | null;
  thinkingLevel: string | null;
  durationMs: number | null;
  statusCode: number | null;
  reason: string;
}

// Ein leeres Feld bedeutet "zurueck zur Umgebungsvariable" - deshalb sind alle drei optional.
export interface UpdateAiSettings {
  model?: string;
  thinkingLevel?: string;
  maxOutputTokens?: number;
}

export const adminApi = {
  getSettings: () => client.get<AiSettings>('/api/admin/settings'),
  updateSettings: (data: UpdateAiSettings) => client.put<AiSettings>('/api/admin/settings', data),
  probe: () => client.post<AiProbeResult>('/api/admin/settings/probe'),
  getFailures: () => client.get<AiFailure[]>('/api/admin/failures'),
};
