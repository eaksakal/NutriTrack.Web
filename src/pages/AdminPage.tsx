import { useEffect, useState, type FormEvent } from 'react';
import { adminApi, type AiSettings, type AiFailure, type AiProbeResult } from '../api/admin';
import { apiErrorMessage } from '../api/errors';

export default function AdminPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [failures, setFailures] = useState<AiFailure[]>([]);
  const [model, setModel] = useState('');
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
    setModel(s.modelFromDatabase ? s.model : '');
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
      const res = await adminApi.updateSettings({
        model: model.trim() || undefined,
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

  if (!settings && !error) return <p>Lädt…</p>;

  return (
    <div className="admin-page">
      <h1>KI-Einstellungen</h1>
      {error && <p className="error-msg">{error}</p>}

      {settings && (
        <form onSubmit={speichern} className="admin-form">
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
            {probe.model} · {probe.thinkingLevel} · Status {probe.statusCode === 0 ? 'keine Antwort' : probe.statusCode}
            {' · '}{probe.durationMs} ms
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
              <tr><th>Zeitpunkt</th><th>Art</th><th>Modell</th><th>Dauer</th><th>Status</th><th>Grund</th></tr>
            </thead>
            <tbody>
              {failures.map((f, i) => (
                <tr key={i}>
                  <td>{new Date(f.occurredAt).toLocaleString('de-DE')}</td>
                  <td>{f.kind}</td>
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
