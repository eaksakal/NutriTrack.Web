import { useEffect, useState } from 'react';
import { mealsApi, type MealEntry } from '../api/meals';
import { MEAL_TYPES, mealTypeLabel, isMealType, type MealTypeName } from '../constants/mealTypes';
import { apiErrorMessage } from '../api/errors';

interface Props {
  /** Tag, auf den der Wiedereintrag gebucht wird — der, den das Dashboard gerade zeigt. */
  date: string;
  /** Nach einem Wiedereintrag: die Tagesliste dahinter neu laden. Das Overlay bleibt offen. */
  onAdded: () => void;
}

/**
 * Zuletzt Gegessenes als Ein-Klick-Vorlage. Der Server legt je Klick einen EIGENEN Eintrag an
 * (POST /api/meals/{id}/repeat) und erhoeht nicht die Menge des Originals: der zweite Kaffee ist
 * ein zweiter Kaffee, mit eigener Uhrzeit und eigener Mahlzeit.
 *
 * Die Liste steht als Akkordion ueber der KI-Eingabe und ist zugeklappt: der Normalfall ist das
 * Eintippen eines neuen Gerichts, die Vorlagen sind eine Abkuerzung fuer den Wiederholungsfall.
 */
export default function RecentMeals({ date, onAdded }: Props) {
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [ziele, setZiele] = useState<Record<string, MealTypeName>>({});
  const [laufend, setLaufend] = useState<string | null>(null);
  // Zuletzt uebernommene Zeile. Das Overlay bleibt offen, damit man mehrere Posten nacheinander
  // eintragen kann - ohne diese Rueckmeldung passierte auf dem Bildschirm sichtbar nichts.
  const [uebernommen, setUebernommen] = useState<string | null>(null);
  const [fehler, setFehler] = useState('');
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let abgebrochen = false;

    mealsApi.getRecent()
      .then(res => {
        if (abgebrochen) return;
        setEntries(res.data);
        // Vorbelegung ist die Mahlzeit des letzten Mals: meistens isst man dasselbe zur selben
        // Tageszeit, und wer es anders will, sieht die Auswahl direkt daneben.
        setZiele(Object.fromEntries(res.data.map(e => [
          e.id,
          isMealType(e.mealType) ? e.mealType : 'Snack',
        ])));
      })
      // Die Vorschlagsliste ist eine Zugabe: faellt sie aus, bleibt die KI-Eingabe darunter
      // benutzbar, und eine rote Meldung ueber etwas, das man nicht angefordert hat, hilft nicht.
      .catch(() => { if (!abgebrochen) setEntries([]); })
      .finally(() => { if (!abgebrochen) setLaedt(false); });

    return () => { abgebrochen = true; };
  }, []);

  const wiederholen = async (entry: MealEntry) => {
    setLaufend(entry.id);
    setFehler('');
    setUebernommen(null);
    try {
      await mealsApi.repeat(entry.id, { mealType: ziele[entry.id], date });
      setUebernommen(entry.id);
      onAdded();
    } catch (err) {
      setFehler(apiErrorMessage(err, 'Der Eintrag liess sich nicht übernehmen.'));
    } finally {
      setLaufend(null);
    }
  };

  if (laedt || entries.length === 0) return null;

  return (
    <details className="recent-meals">
      <summary className="recent-summary">
        <svg className="recent-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <h2>Zuletzt gegessen</h2>
        <span className="recent-count">{entries.length}</span>
      </summary>
      {fehler && <div className="error-msg">{fehler}</div>}
      <ul className="recent-list">
        {entries.map(entry => (
          <li key={entry.id} className="recent-item">
            <span className="recent-name">
              {entry.foodName}
              {entry.brand && <span className="brand"> ({entry.brand})</span>}
            </span>
            <span className="recent-meta">{entry.quantityInGrams}g · {Math.round(entry.calories)} kcal</span>
            <select
              className="recent-target"
              value={ziele[entry.id] ?? 'Snack'}
              aria-label={`Mahlzeit für ${entry.foodName}`}
              onChange={e => {
                if (isMealType(e.target.value)) setZiele(prev => ({ ...prev, [entry.id]: e.target.value as MealTypeName }));
              }}
            >
              {MEAL_TYPES.map(t => <option key={t} value={t}>{mealTypeLabel(t)}</option>)}
            </select>
            {uebernommen === entry.id && <span className="recent-done">eingetragen</span>}
            <button
              type="button"
              className="icon-btn recent-add"
              aria-label={`${entry.foodName} nochmal eintragen`}
              title="Nochmal eintragen"
              disabled={laufend !== null}
              onClick={() => wiederholen(entry)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
