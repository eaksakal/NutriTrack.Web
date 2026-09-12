import { isAxiosError } from 'axios';

// Die API antwortet je nach Fehlerfall in ZWEI Formen: Identity-Validierungsfehler kommen als
// { errors: [...] } (Results.BadRequest mit einer Liste), fachliche Einzelfehler dagegen als
// { error: "..." } - darunter der 409-Konflikt bei bereits vergebener E-Mail, also der mit
// Abstand haeufigste Fehler auf der Registrierungsseite. Wer nur eine der beiden Formen liest,
// verschluckt genau diesen Fall und zeigt eine generische Meldung. Deshalb liegt die Auswertung
// hier zentral, statt in jeder Seite erneut (und erneut unvollstaendig) zu entstehen.
interface ApiErrorBody {
  error?: unknown;
  errors?: unknown;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

// ASP.NET serialisiert Fehlerlisten je nach Aufrufweg als flaches Array (Results.BadRequest)
// oder als Feld-zu-Meldungen-Wörterbuch (Results.ValidationProblem). Beides endet hier als
// eine Liste anzeigbarer Saetze, damit ein spaeterer Wechsel im Backend die Anzeige nicht kippt.
function collectMessages(errors: unknown): string[] {
  if (Array.isArray(errors)) {
    return errors.filter(isNonEmptyString);
  }
  if (errors && typeof errors === 'object') {
    return Object.values(errors).flatMap(value =>
      Array.isArray(value) ? value.filter(isNonEmptyString) : isNonEmptyString(value) ? [value] : []
    );
  }
  return [];
}

/**
 * Liest die Fehlermeldung aus einer API-Antwort; `fallback` greift bei Netzwerkfehlern,
 * 500ern und leeren Antworten (z. B. dem 401 des Login-Endpunkts, der keinen Body hat).
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError<ApiErrorBody>(err)) return fallback;

  const data = err.response?.data;
  if (!data || typeof data !== 'object') return fallback;

  if (isNonEmptyString(data.error)) return data.error;

  const messages = collectMessages(data.errors);
  return messages.length > 0 ? messages.join(' ') : fallback;
}
