import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi, MAX_MESSAGES, type ChatMessage, type NutrientEstimate, type ParsedItem } from '../api/ai';
import type { PanelProps } from '../components/PanelProps';
import { apiErrorMessage } from '../api/errors';
import type { FoodItem } from '../api/food';
import { mealsApi, quantityError, MAX_QUANTITY_IN_GRAMS } from '../api/meals';
import { MEAL_TYPES, mealTypeLabel, isMealType, type MealTypeName } from '../constants/mealTypes';

const MAX_MESSAGE_LENGTH = 2000;

/** Zustand der Bestaetigungsmaske je Posten - der Vorschlag der KI bleibt daneben unveraendert
 *  stehen, damit ein Zurueckstellen der Menge jederzeit moeglich ist. */
interface Draft {
  selected: boolean;
  quantityInGrams: number;
  mealType: MealTypeName;
  candidateIndex: number;
}

/**
 * Naehrwerte je 100 g fuer eine Zeile: der gewaehlte OpenFoodFacts-Treffer schlaegt die
 * Schaetzung. Geraten wird nur dort, wo es sonst gar keinen Eintrag gaebe.
 */
function nutrientsOf(item: ParsedItem, draft: Draft): FoodItem | NutrientEstimate | null {
  return item.candidates[draft.candidateIndex] ?? item.estimate;
}

const caloriesFor = (item: ParsedItem, draft: Draft) => {
  const nutrients = nutrientsOf(item, draft);
  if (!nutrients) return 0;
  return Math.round(nutrients.calories * draft.quantityInGrams / 100);
};

/**
 * Kurzwort fuer die Herkunft der Naehrwerte. "geschaetzt" waere fuer ein Grundnahrungsmittel
 * irrefuehrend: 89 kcal fuer eine Banane sind kein Schaetzwert, sondern der Standardwert. Wer
 * nicht weiss, warum eine Zahl so ist, misstraut ihr - und traegt sie dann gar nicht erst ein.
 */
function herkunft(source: ParsedItem['source']): string {
  switch (source) {
    case 'openfoodfacts':
      return 'Markenprodukt';
    case 'generic':
      return 'Standardwert';
    default:
      return 'geschätzt';
  }
}

export default function AiEntryPage({ date, onDone, embedded }: PanelProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const send = async (e: SyntheticEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    // Gekuerzt auf die letzten MAX_MESSAGES Eintraege, statt den Faden wachsen zu lassen: der
    // Server lehnt mehr mit 400 ab, und weil die Eingabe zu diesem Zeitpunkt schon im Verlauf
    // steht, koennte er danach nur noch weiter wachsen - jeder Folgeversuch scheiterte mit
    // derselben Meldung. Der aelteste Teil des Gespraechs ist der entbehrlichste.
    const asked: ChatMessage = { role: 'user', text };
    const history: ChatMessage[] = [...messages, asked].slice(-MAX_MESSAGES);
    setMessages(history);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const res = await aiApi.parseMeal(history);
      setNotice(res.data.notice);

      if (res.data.question) {
        // Rueckfrage: sie wandert als Assistenten-Nachricht in denselben Faden, damit die
        // Antwort des Nutzers den Zusammenhang mitschickt - der Server erinnert sich nicht.
        const answer: ChatMessage = { role: 'assistant', text: res.data.question };
        setMessages([...history, answer].slice(-MAX_MESSAGES));
        setItems([]);
        setDrafts([]);
      } else {
        setItems(res.data.items);
        setDrafts(res.data.items.map(item => ({
          selected: true,
          quantityInGrams: item.quantityInGrams,
          // Der Mahlzeitentyp kommt als blosser String aus der API; der Guard grenzt ihn auf
          // die vier Werte ein, die POST /api/meals akzeptiert.
          mealType: isMealType(item.mealType) ? item.mealType : 'Snack',
          candidateIndex: 0,
        })));
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Die KI-Erfassung hat nicht geklappt.'));
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (index: number, patch: Partial<Draft>) =>
    setDrafts(prev => prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));

  /** Setzt die Seite auf den Anfangszustand zurueck - einschliesslich des Gespraechsfadens.
   *  Ohne das Leeren von `messages` waere das Zuruecksetzen nur halb: der naechste Versuch
   *  schleppte den alten Verlauf mit, obwohl der Nutzer sichtbar von vorn anfaengt. */
  const reset = () => {
    setMessages([]);
    setInput('');
    setItems([]);
    setDrafts([]);
    setNotice(null);
    setError('');
  };

  const submit = async () => {
    const chosen = items.map((item, index) => ({ item, draft: drafts[index], index }))
      .filter(row => row.draft?.selected);

    if (chosen.length === 0) {
      setError('Setz mindestens einen Haken.');
      return;
    }

    // Dieselbe Mengenregel wie im Server, vor dem Rundlauf: sonst laeuft die Schleife los und
    // bricht mitten in der Liste ab, obwohl die Eingabe nie eine Chance hatte.
    const invalid = chosen
      .map(row => quantityError(row.draft.quantityInGrams))
      .find(message => message !== null);
    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);
    setError('');
    const failed: string[] = [];
    const saved: number[] = [];

    for (const { item, draft, index } of chosen) {
      const source = item.candidates[draft.candidateIndex] ?? null;
      const nutrients = source ?? item.estimate;
      if (!nutrients) {
        failed.push(item.label);
        continue;
      }

      try {
        await mealsApi.create({
          foodName: source?.name ?? item.label,
          brand: source?.brand,
          barcode: source?.barcode,
          calories: nutrients.calories,
          protein: nutrients.protein,
          carbohydrates: nutrients.carbohydrates,
          fat: nutrients.fat,
          fiber: nutrients.fiber ?? undefined,
          sugar: nutrients.sugar ?? undefined,
          saturatedFat: nutrients.saturatedFat ?? undefined,
          sodium: nutrients.sodium ?? undefined,
          // Mikronaehrstoffe gibt es nur aus OpenFoodFacts - die KI schaetzt sie bewusst nicht.
          vitaminA: source?.vitaminA,
          vitaminC: source?.vitaminC,
          vitaminD: source?.vitaminD,
          calcium: source?.calcium,
          iron: source?.iron,
          potassium: source?.potassium,
          quantityInGrams: draft.quantityInGrams,
          mealType: draft.mealType,
          // Ohne Datum entscheidet der Server (heute). Das Overlay reicht den Tag durch, den
          // die Datumsnavigation des Dashboards gerade zeigt - so laesst sich Gestriges nachtragen.
          date,
        });
        saved.push(index);
      } catch {
        // Ein fehlgeschlagener Posten darf die uebrigen nicht mitreissen: der Nutzer hat
        // moeglicherweise zehn Zeilen bestaetigt, und neun davon sind sauber durchgelaufen.
        failed.push(item.label);
      }
    }

    setSaving(false);

    if (failed.length > 0) {
      // Die gelungenen Zeilen verlieren ihren Haken. Ohne das legte ein zweiter Anlauf sie
      // ein zweites Mal an - der Nutzer sieht ja nicht, welche schon im Tagebuch stehen.
      setDrafts(prev => prev.map((draft, i) =>
        (saved.includes(i) ? { ...draft, selected: false } : draft)));
      setError(`Nicht übernommen: ${failed.join(', ')}`);
      return;
    }

    if (onDone) {
      onDone();
      return;
    }

    navigate('/');
  };

  const totalCalories = items.reduce(
    (sum, item, index) => (drafts[index]?.selected ? sum + caloriesFor(item, drafts[index]) : sum),
    0
  );

  return (
    <div className="ai-entry">
      {!embedded && <h1>Per Text erfassen</h1>}
      <p className="ai-hint">
        Schreib einfach, was du gegessen hast &mdash; zum Beispiel &bdquo;2 Br&ouml;tchen mit Gouda und ein Kaffee&ldquo;.
      </p>

      {messages.length > 0 && (
        <div className="ai-thread">
          {messages.map((message, index) => (
            <div key={index} className={`ai-message ai-message-${message.role}`}>
              {message.text}
            </div>
          ))}
          {loading && <div className="ai-message ai-message-assistant">Denkt nach...</div>}
        </div>
      )}

      {/* Steht ausserhalb des Posten-Blocks: waehrend einer Rueckfrageschleife ist `items` leer,
          und genau dann braucht der Nutzer einen Weg aus dem Gespraech heraus - vorher half nur
          ein Neuladen der Seite. */}
      {messages.length > 0 && (
        <button
          type="button"
          className="btn-secondary ai-reset"
          onClick={reset}
          disabled={loading || saving}
        >
          Neues Gespr&auml;ch
        </button>
      )}

      {error && <div className="error-msg">{error}</div>}
      {notice && <div className="ai-notice">{notice}</div>}

      <form onSubmit={send} className="ai-input">
        <textarea
          value={input}
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Was hast du gegessen?"
          onChange={e => setInput(e.target.value)}
          // Enter schickt ab, Shift+Enter setzt eine neue Zeile. In einer Textarea loeste Enter
          // sonst gar nichts aus - das Feld soll mehrere Zeilen fassen, ohne dass man fuer jede
          // Eingabe zur Maus greifen muss.
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
          {loading ? 'Sendet...' : 'Senden'}
        </button>
      </form>

      {items.length > 0 && (
        <div className="ai-confirm">
          <h2>Erkannte Posten</h2>
          <table className="ai-table">
            <thead>
              <tr>
                <th></th>
                <th>Posten</th>
                <th>Menge (g)</th>
                <th>Mahlzeit</th>
                <th>Kalorien</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const draft = drafts[index];
                if (!draft) return null;

                return (
                  <tr key={index} className={draft.selected ? undefined : 'ai-row-off'}>
                    <td>
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        aria-label={`${item.label} übernehmen`}
                        onChange={e => updateDraft(index, { selected: e.target.checked })}
                      />
                    </td>
                    <td>
                      <div className="ai-item-label">
                        {item.candidates[draft.candidateIndex]?.name ?? item.label}
                        <span className={`ai-badge ai-badge-${item.source}`}>
                          {herkunft(item.source)}
                        </span>
                      </div>
                      {item.candidates.length > 1 && (
                        <select
                          className="ai-candidate"
                          value={draft.candidateIndex}
                          aria-label={`Treffer für ${item.label} wählen`}
                          onChange={e => updateDraft(index, { candidateIndex: Number(e.target.value) })}
                        >
                          {item.candidates.map((candidate, candidateIndex) => (
                            <option key={candidateIndex} value={candidateIndex}>
                              {candidate.name}{candidate.brand ? ` - ${candidate.brand}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        value={draft.quantityInGrams}
                        min={1}
                        max={MAX_QUANTITY_IN_GRAMS}
                        aria-label={`Menge für ${item.label}`}
                        onChange={e => updateDraft(index, { quantityInGrams: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <select
                        value={draft.mealType}
                        aria-label={`Mahlzeit für ${item.label}`}
                        onChange={e => {
                          if (isMealType(e.target.value)) updateDraft(index, { mealType: e.target.value });
                        }}
                      >
                        {MEAL_TYPES.map(t => <option key={t} value={t}>{mealTypeLabel(t)}</option>)}
                      </select>
                    </td>
                    <td className="ai-calories">{caloriesFor(item, draft)} kcal</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Summe</td>
                <td className="ai-calories">{totalCalories} kcal</td>
              </tr>
            </tfoot>
          </table>

          <div className="ai-actions">
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Wird übernommen...' : 'Übernehmen'}
            </button>
            <button className="btn-secondary" onClick={reset} disabled={saving}>Verwerfen</button>
          </div>
        </div>
      )}
    </div>
  );
}
