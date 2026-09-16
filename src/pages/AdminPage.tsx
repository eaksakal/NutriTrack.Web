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
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setError('');
    try {
      const res = await adminApi.updateSettings({
        model: model.trim() || undefined,
        thinkingLevel: thinkingLevel.trim() || undefined,
        maxOutputTokens: maxOutputTokens.trim() ? Number(maxOutputTokens) : undefined,
      });
      uebernehmen(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Einstellungen nicht ladbar.'));
    } finally {
      setBusy(false);
    }
  };

  const testen = async () => {
    setBusy(true);
    setError('');
    setProbe(null);
    try {
      const res = await adminApi.probe();
      setProbe(res.data);
      const aktuell = await adminApi.getFailures();
      setFailures(aktuell.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Einstellungen nicht ladbar.'));
    } finally {
      setBusy(false);
    }
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
            <button type="submit" disabled={busy}>Speichern</button>
            <button type="button" onClick={testen} disabled={busy}>Verbindung testen</button>
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
