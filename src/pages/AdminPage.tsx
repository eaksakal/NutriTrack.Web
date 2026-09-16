import { useEffect, useState, type FormEvent } from 'react';
import { adminApi, type AiSettings, type AiFailure, type AiProbeResult } from '../api/admin';
import { apiErrorMessage } from '../api/errors';

export default function AdminPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [failures, setFailures] = useState<AiFailure[]>([]);
  // Leer heisst "kein expliziter Wunsch" - dieselbe Notbremse wie bei den Textfeldern, nur als
  // eigene Auswahloption nachgebildet, weil ein <select> kein leeres Eingabefeld kennt.
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('');
  const [thinkingLevel, setThinkingLevel] = useState('');
  const [maxOutputTokens, setMaxOutputTokens] = useState('');
  const [probe, setProbe] = useState<AiProbeResult | null>(null);
  const [error, setError] = useState('');
  // Welche der beiden Aktionen laeuft - nicht nur OB eine laeuft. Ein einzelnes Bool haette beide
  // Knoepfe gesperrt, aber niemandem gesagt, ob gerade gespeichert oder getestet wird.
  const [busy, setBusy] = useState<'speichern' | 'testen' | null>(null);

  // Nur die Felder vorbelegen, die WIRKLICH gespeichert sind. Stuende der Wert aus der Umgebung
  // im Feld, machte das erste Speichern ihn unbemerkt zu einem gespeicherten - und die Notbremse
  // waere weg.
  const uebernehmen = (s: AiSettings) => {
    setSettings(s);
    setProvider(s.providerFromDatabase ? s.provider : '');
    setModel(s.modelFromDatabase ? s.model : '');
    setOpenRouterModel(s.openRouterModelFromDatabase ? s.openRouterModel : '');
    setThinkingLevel(s.thinkingLevelFromDatabase ? s.thinkingLevel : '');
    setMaxOutputTokens(s.maxOutputTokensFromDatabase ? String(s.maxOutputTokens) : '');
  };

  useEffect(() => {
    adminApi.getSettings().then(res => uebernehmen(res.data)).catch(err => setError(apiErrorMessage(err, 'Einstellungen nicht ladbar.')));
    adminApi.getFailures().then(res => setFailures(res.data)).catch(() => { /* Nebensache */ });
  }, []);

  const speichern = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Number('') ergibt 0 (unproblematisch, da leer -> undefined weiter unten), Number('abc')
    // NaN - und JSON.stringify macht aus NaN ein ausdrueckliches null statt das Feld wegzulassen.
    // Also vor dem Senden pruefen, nicht dem Backend die Reparatur ueberlassen.
    const maxOutputTokensTrimmed = maxOutputTokens.trim();
    const maxOutputTokensValue = maxOutputTokensTrimmed ? Number(maxOutputTokensTrimmed) : undefined;
    if (maxOutputTokensValue !== undefined && !Number.isFinite(maxOutputTokensValue)) {
      setError('Ausgabe-Token muss eine Zahl sein.');
      return;
    }

    setBusy('speichern');
    try {
      // Immer alle Felder mitschicken, auch die des gerade nicht gewaehlten Anbieters:
      // sie stehen unveraendert im State, solange ihr Eingabefeld nur ausgeblendet und nicht
      // entfernt ist. Wuerden wir sie beim Umschalten weglassen, gaelte "fehlendes Feld = zurueck
      // zur Umgebung" auch hier - und Geminis Modell ginge beim ersten Speichern unter OpenRouter verloren.
      const res = await adminApi.updateSettings({
        provider: provider || undefined,
        model: model.trim() || undefined,
        openRouterModel: openRouterModel.trim() || undefined,
        thinkingLevel: thinkingLevel.trim() || undefined,
        maxOutputTokens: maxOutputTokensValue,
      });
      uebernehmen(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Speichern fehlgeschlagen.'));
    } finally {
      setBusy(null);
    }
  };

  const testen = async () => {
    setBusy('testen');
    setError('');
    setProbe(null);
    try {
      const res = await adminApi.probe();
      setProbe(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Verbindungstest fehlgeschlagen.'));
    } finally {
      setBusy(null);
    }
    // Eigenes .catch(): scheitert nur das Nachladen der Liste, obwohl die Probe lief, soll das
    // nicht als Fehler ueber einem funktionierenden Ergebnis auftauchen (Nebensache wie beim
    // ersten Laden oben).
    adminApi.getFailures().then(res => setFailures(res.data)).catch(() => { /* Nebensache */ });
  };

  const herkunft = (ausDatenbank: boolean, wert: string | number) =>
    ausDatenbank ? 'gespeichert' : `aus der Umgebung: ${wert}`;

  const anbieterName = (p: string) => (p === 'openrouter' ? 'OpenRouter' : 'Google Gemini');

  // Solange die Auswahl auf "aus der Umgebung" steht (provider === ''), gilt fuer die Anzeige
  // trotzdem der tatsaechlich aktive Anbieter - sonst wuerden bei OpenRouter aus der Umgebung
  // faelschlich die Gemini-Felder erscheinen.
  const effectiveProvider = provider || settings?.provider || 'gemini';

  if (!settings && !error) return <p>Lädt…</p>;

  return (
    <div className="admin-page">
      <h1>KI-Einstellungen</h1>
      {error && <p className="error-msg">{error}</p>}

      {settings && (
        <form onSubmit={speichern} className="admin-form">
          <label>
            Anbieter
            {/* Die leere Option ist die Notbremse fuer ein <select>: sie steht fuer "kein
                expliziter Wunsch", genau wie ein geleertes Textfeld. Ohne sie wuerde jedes
                Speichern den Anbieter aus der Umgebung stillschweigend in der Datenbank festschreiben. */}
            <select value={provider} onChange={e => setProvider(e.target.value)}>
              <option value="">{`aus der Umgebung: ${anbieterName(settings.provider)}`}</option>
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
            </select>
            <small>{herkunft(settings.providerFromDatabase, anbieterName(settings.provider))}</small>
          </label>

          {effectiveProvider === 'gemini' ? (
            <>
              <label>
                Modell
                <input value={model} onChange={e => setModel(e.target.value)} placeholder={settings.model} />
                <small>{herkunft(settings.modelFromDatabase, settings.model)}</small>
              </label>

              <label>
                Denkstufe
                <input
                  value={thinkingLevel}
                  onChange={e => setThinkingLevel(e.target.value)}
                  placeholder={settings.thinkingLevel}
                />
                <small>{herkunft(settings.thinkingLevelFromDatabase, settings.thinkingLevel)}</small>
              </label>
            </>
          ) : (
            <label>
              OpenRouter-Modell
              <input
                value={openRouterModel}
                onChange={e => setOpenRouterModel(e.target.value)}
                placeholder={settings.openRouterModel}
              />
              <small>{herkunft(settings.openRouterModelFromDatabase, settings.openRouterModel)}</small>
              <small>
                Nur Modelle mit erzwungenem Schema funktionieren. Am 2026-09-16 waren das:
                nex-agi/nex-n2.5-pro:free, nex-agi/nex-n2.5-mini:free,
                dots-studio/dots-3-note-preview:free, nvidia/nemotron-3-super-120b-a12b:free,
                liquid/lfm-2.5-2.6b:free. Prüfe einen anderen Namen mit „Verbindung testen".
              </small>
            </label>
          )}

          <label>
            Ausgabe-Token
            <input
              type="number"
              value={maxOutputTokens}
              onChange={e => setMaxOutputTokens(e.target.value)}
              placeholder={String(settings.maxOutputTokens)}
            />
            <small>{herkunft(settings.maxOutputTokensFromDatabase, settings.maxOutputTokens)}</small>
          </label>

          <p className="hint">
            Ein leeres Feld bedeutet: der Wert aus der Umgebung gilt wieder.
          </p>

          <div className="admin-actions">
            <button type="submit" className="btn-primary" disabled={busy !== null}>
              {busy === 'speichern' ? 'Wird gespeichert...' : 'Speichern'}
            </button>
            <button type="button" className="btn-secondary" onClick={testen} disabled={busy !== null}>
              {busy === 'testen' ? 'Testet…' : 'Verbindung testen'}
            </button>
          </div>
        </form>
      )}

      {probe && (
        <section className="probe-result">
          <h2>Ergebnis der Probe</h2>
          <p>
            {/* Anbieter zuerst: bei einem Feature, dessen Zweck der Vergleich zweier Anbieter
                ist, gehoert hierhin, wer geantwortet hat. thinkingLevel via filter(Boolean)
                weggelassen statt unbedingt gerendert - sonst liest die Zeile bei OpenRouter
                "nex-agi/… ·  · Status 200" mit leerer Mitte, weil dort keine Denkstufe existiert. */}
            {[
              anbieterName(settings?.provider ?? 'gemini'),
              probe.model,
              probe.thinkingLevel,
              `Status ${probe.statusCode === 0 ? 'keine Antwort' : probe.statusCode}`,
              `${probe.durationMs} ms`,
            ].filter(Boolean).join(' · ')}
          </p>
          <pre>{probe.rawBody}</pre>
        </section>
      )}

      <section className="failures">
        <h2>Letzte Fehlschläge</h2>
        {failures.length === 0 ? (
          <p>Keine Fehlschläge aufgezeichnet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Zeitpunkt</th><th>Art</th><th>Anbieter</th><th>Modell</th><th>Dauer</th><th>Status</th><th>Grund</th></tr>
            </thead>
            <tbody>
              {failures.map((f, i) => (
                <tr key={i}>
                  <td>{new Date(f.occurredAt).toLocaleString('de-DE')}</td>
                  <td>{f.kind}</td>
                  <td>{f.provider ?? '–'}</td>
                  <td>{f.model ?? '–'}</td>
                  <td>{f.durationMs != null ? `${f.durationMs} ms` : '–'}</td>
                  <td>{f.statusCode ?? '–'}</td>
                  <td className="reason">{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
