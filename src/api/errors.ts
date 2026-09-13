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
  detail?: unknown;
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

// Der technische Grund, den die API in `detail` mitschickt (Zeitdeckel, HTTP-Status von Google,
// fehlender Schluessel). Er haengt an der freundlichen Meldung statt sie zu ersetzen: die eine
// sagt, was jetzt zu tun ist, der andere, warum es nicht ging. Ohne ihn sehen ein abgelaufener
// Schluessel und ein zu langsamer Dienst gleich aus - und man wartet auf etwas, das nie kommt.
function withDetail(message: string, detail: unknown): string {
  return isNonEmptyString(detail) && !message.includes(detail) ? `${message} (${detail})` : message;
}

/**
 * Liest die Fehlermeldung aus einer API-Antwort; `fallback` greift bei Netzwerkfehlern,
 * 500ern und leeren Antworten (z. B. dem 401 des Login-Endpunkts, der keinen Body hat).
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError<ApiErrorBody>(err)) return fallback;

  // Gar keine Antwort: die API selbst schweigt. Dann ist axios' eigene Diagnose alles, was es
  // gibt - "Network Error" gegen "timeout of 30000ms exceeded" trennt Dienst-aus von Dienst-lahm.
  if (!err.response) return withDetail(fallback, err.code ? `${err.code}: ${err.message}` : err.message);

  const data = err.response.data;
  if (!data || typeof data !== 'object') return withDetail(fallback, `HTTP ${err.response.status}`);

  if (isNonEmptyString(data.error)) return withDetail(data.error, data.detail);

  const messages = collectMessages(data.errors);
  return messages.length > 0 ? messages.join(' ') : withDetail(fallback, data.detail);
}
