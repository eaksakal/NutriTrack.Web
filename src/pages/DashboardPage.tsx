import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  mealsApi,
  quantityError,
  MAX_QUANTITY_IN_GRAMS,
  type DailySummary,
  type MealEntry,
  type PeriodSummary,
} from '../api/meals';
import { goalsApi, type Goals } from '../api/goals';
import { MEAL_TYPES, mealTypeLabel, isMealType, type MealTypeName } from '../constants/mealTypes';
import { apiErrorMessage } from '../api/errors';
import { formatNutrient, type NutrientUnit } from '../utils/nutrients';
import EntryOverlay from '../components/EntryOverlay';

type ViewMode = 'day' | 'week' | 'month';

const VIEW_LABELS: Record<ViewMode, string> = {
  day: 'Tag',
  week: 'Woche',
  month: 'Monat',
};

// Ausgeschrieben statt ueber toLocaleDateString: die Beschriftung soll in jedem Browser gleich
// aussehen und nicht davon abhaengen, welche Sprachdaten dort mitgeliefert sind.
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const WEEKDAY_LETTERS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Datum und Uhrzeit sind in der API fachlich LOKALE Zeit (MealEndpoints.LocalToday, DateTime.Now).
// toISOString() rechnet dagegen nach UTC: in Europe/Berlin stand hier zwischen Mitternacht und
// 01/02 Uhr noch der Vortag, waehrend ein neu angelegter Eintrag den lokalen Tag bekommt - der
// Eintrag war damit direkt nach dem Speichern unsichtbar. Deshalb die lokalen Datumsfelder.
function formatDate(date: Date): string {
  // Jahr ebenfalls auf vier Stellen: ohne das Padding liefert ein Jahr unter 1000 einen String,
  // der kein ISO-Datum mehr ist ("202-09-13") - und isValidIsoDate vergleicht genau dagegen.
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Gegenstueck zu formatDate: `new Date('2026-09-12')` waere UTC-Mitternacht und liefe damit in
// dieselbe Zeitzonenfalle wie oben, aus den Feldern gebaut bleibt das Datum ortsgebunden.
function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const datum = new Date(year, month - 1, day);
  // new Date(2, ...) meint das Jahr 1902, nicht 2: der Konstruktor bildet 0-99 auf 1900+ ab.
  // setFullYear hebt das auf. Ohne diese Zeile scheitert isValidIsoDate an jedem Jahr unter 100,
  // und genau solche Zwischenwerte meldet ein <input type="date">, waehrend man die Jahreszahl
  // tippt ("0002-09-13", "0020-09-13", ...) - das Feld liesse sich dann nicht mehr von Hand
  // ausfuellen, weil jeder Anschlag verworfen wuerde.
  datum.setFullYear(year);
  return datum;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ein <input type="date"> laesst sich leeren, und der Browser meldet dann den leeren String.
 * Uebernommen wuerde daraus ueber parseDate ein Invalid Date und ueber formatDate der String
 * "NaN-NaN-NaN" - die API antwortet darauf mit 400, und das Datum bliebe dauerhaft kaputt,
 * weil jeder weitere Schritt von diesem Wert ausgeht. Deshalb nur uebernehmen, was vollstaendig
 * ist UND ein echtes Datum ergibt: der Rueckweg ueber formatDate faengt zusaetzlich Tage ab,
 * die es im Monat nicht gibt (Date rechnet den 31.02. stillschweigend in den Maerz um).
 */
function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = parseDate(value);
  return !Number.isNaN(parsed.getTime()) && formatDate(parsed) === value;
}

function germanDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

/** Grenzen des angezeigten Zeitraums, beide einschliesslich. */
function periodRange(anchor: string, mode: ViewMode): { from: string; to: string } {
  if (mode === 'day') return { from: anchor, to: anchor };

  const date = parseDate(anchor);
  if (mode === 'week') {
    // getDay() zaehlt ab Sonntag, die Kalenderwoche hier beginnt am Montag.
    const offset = (date.getDay() + 6) % 7;
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { from: formatDate(start), to: formatDate(end) };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  // Tag 0 des Folgemonats ist dessen Vortag, also der Monatsletzte - das erspart eine eigene
  // Tabelle mit Monatslaengen und den Schaltjahrsonderfall.
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: formatDate(start), to: formatDate(end) };
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const last = parseDate(to);
  for (let d = parseDate(from); d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(formatDate(d));
  }
  return days;
}

function periodLabel(from: string, to: string, mode: ViewMode): string {
  const start = parseDate(from);
  if (mode === 'month') return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  const [, fromMonth, fromDay] = from.split('-');
  return `${fromDay}.${fromMonth}. - ${germanDate(to)}`;
}

export default function DashboardPage() {
  const [date, setDate] = useState(formatDate(new Date()));
  const [mode, setMode] = useState<ViewMode>('day');
  const [overlayOffen, setOverlayOffen] = useState(false);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [period, setPeriod] = useState<PeriodSummary | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState(100);
  const [editMealType, setEditMealType] = useState<MealTypeName>('Lunch');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [loadError, setLoadError] = useState('');
  // Zugeklappt ist der Normalfall: die Liste zeigt zuerst nur die Kategorien mit ihren Summen.
  const [openMealTypes, setOpenMealTypes] = useState<MealTypeName[]>([]);
  // Eintrag, fuer den gerade die Mahlzeit des Wiedereintrags gewaehlt wird.
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const [repeating, setRepeating] = useState(false);

  const { from, to } = useMemo(() => periodRange(date, mode), [date, mode]);

  // Laufende Nummer des juengsten Ladevorgangs. Ohne sie schreibt eine langsame Antwort ihr
  // Ergebnis auch dann noch in die Anzeige, wenn Tag oder Reiter inzwischen weitergeschaltet
  // wurden: nach dem Loeschen eines Eintrags (stiller Reload) sofort auf "Woche" zu klicken
  // liess die spaeter eintreffende Tagesantwort Tageswerte samt Mahlzeitenliste unter dem
  // Wochen-Reiter stehen - falsch, bis man erneut umschaltet.
  const reqId = useRef(0);

  // showLoading=false beim Nachladen nach Aenderungen: sonst ersetzt der frueher
  // Return unten die komplette Seite und das offene Formular springt weg.
  const loadSummary = useCallback(async (showLoading = true) => {
    const meine = ++reqId.current;
    if (showLoading) setLoading(true);
    try {
      if (mode === 'day') {
        const res = await mealsApi.getSummary(date);
        if (meine !== reqId.current) return;
        setSummary(res.data);
        setPeriod(null);
      } else {
        const res = await mealsApi.getPeriod(from, to);
        if (meine !== reqId.current) return;
        setPeriod(res.data);
        setSummary(null);
      }
      setLoadError('');
    } catch (err) {
      if (meine !== reqId.current) return;
      // Der Server begruendet seine 400er im Feld "error" ("Der Zeitraum darf hoechstens 366
      // Tage umfassen." und aehnliche): ohne Anzeige bliebe davon nur eine leere Seite uebrig.
      setLoadError(apiErrorMessage(err, 'Daten konnten nicht geladen werden.'));
      // Nur beim erstmaligen Laden gibt es nichts zu bewahren. Ein fehlgeschlagener
      // Hintergrund-Reload darf die bereits sichtbaren Zahlen dagegen NICHT wegraeumen -
      // sonst kostet ein kurzer Netzaussetzer die gesamte Ansicht.
      if (showLoading) {
        setSummary(null);
        setPeriod(null);
      }
    } finally {
      // NUR auf Aktualitaet pruefen, nicht zusaetzlich auf showLoading: sonst gibt es einen Pfad,
      // auf dem niemand das Flag abraeumt. Ein sichtbarer Lauf (setLoading(true)) wird von einem
      // spaeter gestarteten stillen Lauf ueberholt - der erste ueberspringt sein setLoading(false),
      // weil er veraltet ist, und der zweite fasst `loading` gar nicht erst an. Die Seite bliebe
      // dauerhaft auf "Laden..." stehen, ohne Knopf, der noch hilft.
      if (meine === reqId.current) setLoading(false);
    }
  }, [date, mode, from, to]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Der Zeilenzustand gehoert zur ANGEZEIGTEN Liste, nicht zur Seite. Blieb er beim Wechsel von
  // Tag oder Reiter stehen, klappte er bei der Rueckkehr wieder auf - mitsamt einer Menge, die
  // startEdit laengst nicht mehr nachgezogen hatte: die Vorschau rechnete mit 500 g, obwohl der
  // Eintrag 150 g hat, und "Speichern" haette die verlassene Eingabe weggeschrieben. Ebenso
  // stand eine aufgeklappte Loeschabfrage nach einem Tageswechsel wieder da.
  useEffect(() => {
    setEditingId(null);
    setConfirmingId(null);
    setEditError('');
  }, [date, mode]);

  // null heisst "noch keine Ziele gesetzt" - dann bleibt die Anzeige ohne Soll-Werte.
  const loadGoals = useCallback(async () => {
    try {
      setGoals(await goalsApi.get());
    } catch {
      setGoals(null);
    }
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const handleDelete = async (id: string) => {
    try {
      await mealsApi.delete(id);
    } catch (err) {
      // Ohne Behandlung blieb die Ablehnung eine unbehandelte Promise-Rejection: der Eintrag
      // stand weiter da und niemand erfuhr, warum das Loeschen nicht gewirkt hat.
      setLoadError(apiErrorMessage(err, 'Löschen fehlgeschlagen.'));
      return;
    }
    if (editingId === id) setEditingId(null);
    setConfirmingId(null);
    loadSummary(false);
  };

  const toggleMealType = (type: MealTypeName) => {
    setOpenMealTypes(prev => {
      if (!prev.includes(type)) return [...prev, type];
      // Ein Formular oder eine Loeschabfrage, die beim Zuklappen offen bleibt, waere beim
      // naechsten Aufklappen ein halb fertiger Zustand ohne erkennbaren Ausloeser.
      setEditingId(null);
      setEditError('');
      setConfirmingId(null);
      setRepeatingId(null);
      return prev.filter(t => t !== type);
    });
  };

  /**
   * Traegt denselben Posten ein zweites Mal ein - der zweite Kaffee des Tages, ggf. auf einer
   * anderen Mahlzeit. Der Server legt dabei einen EIGENEN Eintrag an und verdoppelt nicht die
   * Menge des ersten: sonst ginge die Uhrzeit verloren und ein Loeschen traefe beide.
   */
  const handleRepeat = async (entry: MealEntry, type: MealTypeName) => {
    setRepeating(true);
    setLoadError('');
    try {
      await mealsApi.repeat(entry.id, { mealType: type, date });
      setRepeatingId(null);
      // Die Zielmahlzeit aufklappen: sonst quittiert die Seite den Klick nur mit einer stillen
      // Aenderung in einer zugeklappten Kategorie.
      setOpenMealTypes(prev => (prev.includes(type) ? prev : [...prev, type]));
      await loadSummary(false);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Der Eintrag liess sich nicht wiederholen.'));
    } finally {
      setRepeating(false);
    }
  };

  const startRepeat = (entry: MealEntry) => {
    // Wie beim Bearbeiten: zwei offene Masken in derselben Zeile waeren zweideutig.
    setRepeatingId(entry.id);
    setConfirmingId(null);
    setEditingId(null);
  };

  const startEdit = (entry: MealEntry) => {
    setEditingId(entry.id);
    // Eine halb ausgeklappte Loeschabfrage neben dem geoeffneten Formular stehen zu lassen,
    // waere zweideutig: beide Aktionen beanspruchen dieselbe Zeile.
    setConfirmingId(null);
    setRepeatingId(null);
    setEditQuantity(entry.quantityInGrams);
    // Der Server liefert einen Enum-Namen; kennt das Select ihn nicht, bliebe das Feld leer und
    // das Speichern schickte einen Wert, den die mealType-Pruefung der API ablehnt.
    setEditMealType(isMealType(entry.mealType) ? entry.mealType : 'Snack');
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const handleUpdate = async (entry: MealEntry) => {
    const invalid = quantityError(editQuantity);
    if (invalid) {
      setEditError(invalid);
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      // date/time werden mitgeschickt, damit der Eintrag unabhaengig vom Server-Default
      // auf demselben Tag und zur selben Uhrzeit bleibt.
      await mealsApi.update(entry.id, {
        quantityInGrams: editQuantity,
        mealType: editMealType,
        date: entry.date.split('T')[0],
        time: entry.time,
      });
      setEditingId(null);
      await loadSummary(false);
    } catch (err) {
      // Die API begruendet abgelehnte Mengen und Mahlzeitentypen im Feld "error" - diesen Satz
      // zu verschlucken hiesse, dem Nutzer die einzige verwertbare Auskunft vorzuenthalten.
      setEditError(apiErrorMessage(err, 'Speichern fehlgeschlagen.'));
    } finally {
      setSaving(false);
    }
  };

  // `new Date('2026-09-12')` waere UTC-Mitternacht, die lokalen Setter darunter arbeiten aber in
  // Ortszeit - westlich von Greenwich sprang die Ansicht dadurch um zwei Tage. Aus den Feldern
  // gebaut bleibt der Schritt in derselben Zeitzone wie formatDate.
  const changeDate = (direction: number) => {
    const [year, month, day] = date.split('-').map(Number);
    // Stuende hier je ein NaN, lieferte formatDate "NaN-NaN-NaN" und die API antwortete mit 400;
    // der Zustand waere ausserdem nicht mehr reparabel, weil jeder Pfeilklick davon ausgeht.
    // Lieber gar nicht weiterschalten als auf ein unbrauchbares Datum.
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return;
    if (mode === 'day') {
      setDate(formatDate(new Date(year, month - 1, day + direction)));
      return;
    }
    if (mode === 'week') {
      setDate(formatDate(new Date(year, month - 1, day + direction * 7)));
      return;
    }
    // Im Monatsschritt auf den Ersten: vom 31. aus waere "ein Monat weiter" sonst der 3. März,
    // weil der Februar den 31. nicht hat und Date den Ueberhang in den Folgemonat rechnet.
    setDate(formatDate(new Date(year, month - 1 + direction, 1)));
  };

  const jumpToDay = (day: string) => {
    setDate(day);
    setMode('day');
  };

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="dashboard">
      <div className="view-tabs" role="group" aria-label="Zeitraum">
        {(Object.keys(VIEW_LABELS) as ViewMode[]).map(value => (
          <button
            key={value}
            type="button"
            className={mode === value ? 'view-tab is-active' : 'view-tab'}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {VIEW_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="date-nav">
        <button
          onClick={() => changeDate(-1)}
          className="btn-secondary"
          aria-label={mode === 'day' ? 'Vorheriger Tag' : mode === 'week' ? 'Vorherige Woche' : 'Vorheriger Monat'}
        >
          &larr;
        </button>
        {mode === 'day'
          ? <input
              type="date"
              value={date}
              // Ein geleertes oder halb getipptes Feld (z. B. "2026-09-") bleibt unbeachtet,
              // sonst kippt die Anzeige ueber "NaN-NaN-NaN" in einen 400er der API.
              onChange={e => { if (isValidIsoDate(e.target.value)) setDate(e.target.value); }}
            />
          : <div className="period-label" aria-live="polite">{periodLabel(from, to, mode)}</div>}
        <button
          onClick={() => changeDate(1)}
          className="btn-secondary"
          aria-label={mode === 'day' ? 'Nächster Tag' : mode === 'week' ? 'Nächste Woche' : 'Nächster Monat'}
        >
          &rarr;
        </button>

        {/* Der einzige Weg zum Eintragen. Er steht neben der Datumsnavigation, weil das Overlay
            genau auf den dort gewaehlten Tag bucht - Gestriges nachtragen heisst also: einen Tag
            zurueck, dann "+". */}
        <button
          type="button"
          className="btn-add"
          onClick={() => setOverlayOffen(true)}
          aria-label="Eintragen"
          title="Eintragen"
        >
          +
        </button>
      </div>

      {overlayOffen && (
        <EntryOverlay
          date={date}
          onClose={() => setOverlayOffen(false)}
          onSaved={() => {
            setOverlayOffen(false);
            loadSummary(false);
          }}
          // Aus der Vorschlagsliste laesst sich mehreres nacheinander eintragen: nur nachladen,
          // nicht schliessen.
          onAdded={() => loadSummary(false)}
        />
      )}

      {loadError && (
        <div className="error-msg load-error">
          <span>{loadError}</span>
          {/* Ohne showLoading: schlaegt auch der zweite Versuch fehl, sollen die noch
              sichtbaren Zahlen stehen bleiben statt durch "Laden..." ersetzt zu werden. */}
          <button type="button" className="btn-secondary" onClick={() => loadSummary(false)}>
            Erneut versuchen
          </button>
        </div>
      )}

      {summary && (
        <>
          <div className="summary-cards">
            <div className="summary-card cal">
              <div className="summary-value">{Math.round(summary.totalCalories)}</div>
              <div className="summary-label">kcal</div>
              {goals && <GoalProgress value={summary.totalCalories} goal={goals.calorieGoal} unit="kcal" />}
            </div>
            <div className="summary-card protein">
              <div className="summary-value">{Math.round(summary.totalProtein)}g</div>
              <div className="summary-label">Protein</div>
              {goals && <GoalProgress value={summary.totalProtein} goal={goals.proteinGoal} unit="g" />}
            </div>
            <div className="summary-card carbs">
              <div className="summary-value">{Math.round(summary.totalCarbohydrates)}g</div>
              <div className="summary-label">Kohlenhydrate</div>
              {goals && <GoalProgress value={summary.totalCarbohydrates} goal={goals.carbohydrateGoal} unit="g" />}
            </div>
            <div className="summary-card fat">
              <div className="summary-value">{Math.round(summary.totalFat)}g</div>
              <div className="summary-label">Fett</div>
              {goals && <GoalProgress value={summary.totalFat} goal={goals.fatGoal} unit="g" />}
            </div>
          </div>

          {!goals && (
            <p className="goal-hint">
              Noch keine Tagesziele gesetzt. <Link to="/goals">Jetzt festlegen</Link>
            </p>
          )}

          <div className="micro-grid">
            <h2>Mikronährstoffe</h2>
            <div className="micro-items">
              <MicroItem label="Ballaststoffe" value={summary.totalFiber} unit="g" />
              <MicroItem label="Zucker" value={summary.totalSugar} unit="g" />
              <MicroItem label="Gesättigte Fette" value={summary.totalSaturatedFat} unit="g" />
              <MicroItem label="Natrium" value={summary.totalSodium} unit="mg" />
              <MicroItem label="Vitamin A" value={summary.totalVitaminA} unit="µg" />
              <MicroItem label="Vitamin C" value={summary.totalVitaminC} unit="mg" />
              <MicroItem label="Vitamin D" value={summary.totalVitaminD} unit="µg" />
              <MicroItem label="Calcium" value={summary.totalCalcium} unit="mg" />
              <MicroItem label="Eisen" value={summary.totalIron} unit="mg" />
              <MicroItem label="Kalium" value={summary.totalPotassium} unit="mg" />
            </div>
          </div>

          <div className="meals-list">
            <h2>Mahlzeiten ({summary.totalEntries})</h2>
            {summary.entries.length === 0 && (
              <p className="no-results">Noch keine Einträge für diesen Tag.</p>
            )}
            {MEAL_TYPES.map(type => {
              const meals = summary.entries.filter(e => e.mealType === type);
              if (meals.length === 0) return null;
              const offen = openMealTypes.includes(type);
              const gesamt = meals.reduce(
                (acc, e) => ({
                  calories: acc.calories + e.calories,
                  protein: acc.protein + e.protein,
                  carbohydrates: acc.carbohydrates + e.carbohydrates,
                  fat: acc.fat + e.fat,
                }),
                { calories: 0, protein: 0, carbohydrates: 0, fat: 0 },
              );
              return (
                <div key={type} className={offen ? 'meal-group is-open' : 'meal-group'}>
                  <h3>
                    <button
                      type="button"
                      className="meal-group-toggle"
                      aria-expanded={offen}
                      onClick={() => toggleMealType(type)}
                    >
                      <ChevronIcon />
                      <span className="meal-group-name">{mealTypeLabel(type)}</span>
                      <span className="meal-group-count">{meals.length}</span>
                      <span className="meal-group-macros">
                        <span>{Math.round(gesamt.calories)} kcal</span>
                        <span>P: {Math.round(gesamt.protein)}g</span>
                        <span>K: {Math.round(gesamt.carbohydrates)}g</span>
                        <span>F: {Math.round(gesamt.fat)}g</span>
                      </span>
                    </button>
                  </h3>
                  {offen && meals.map(entry => (
                    <div
                      key={entry.id}
                      className={editingId === entry.id ? 'meal-item is-editing' : 'meal-item'}
                    >
                      <div className="meal-item-main">
                        <div className="meal-item-info">
                          <strong className="meal-name">{entry.foodName}</strong>
                          {entry.brand && <span className="brand">({entry.brand})</span>}
                          <span className="meal-qty">{entry.quantityInGrams}g</span>
                        </div>
                        <div className="meal-item-macros">
                          <span>{Math.round(entry.calories)} kcal</span>
                          <span>P: {Math.round(entry.protein)}g</span>
                          <span>K: {Math.round(entry.carbohydrates)}g</span>
                          <span>F: {Math.round(entry.fat)}g</span>
                        </div>
                      </div>

                      {repeatingId === entry.id ? (
                        // Die Mahlzeit wird gefragt, statt sie zu erben: wiederholt wird meist
                        // etwas, das man zu einer anderen Tageszeit noch einmal isst.
                        <div className="meal-item-actions meal-item-repeat">
                          <span className="confirm-question">Nochmal auf:</span>
                          {MEAL_TYPES.map(t => (
                            <button
                              key={t}
                              type="button"
                              className="btn-repeat-target"
                              disabled={repeating}
                              onClick={() => handleRepeat(entry, t)}
                            >
                              {mealTypeLabel(t)}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="btn-confirm-cancel"
                            disabled={repeating}
                            onClick={() => setRepeatingId(null)}
                          >
                            Abbrechen
                          </button>
                        </div>
                      ) : confirmingId === entry.id ? (
                        // Die Rueckfrage bleibt in der Zeile, die sie betrifft. window.confirm
                        // haette den Bezug zum Eintrag verloren und blockiert nebenbei alles.
                        <div className="meal-item-actions meal-item-confirm">
                          <span className="confirm-question">Löschen?</span>
                          <button
                            type="button"
                            className="btn-confirm-delete"
                            onClick={() => handleDelete(entry.id)}
                          >
                            Löschen
                          </button>
                          <button
                            type="button"
                            className="btn-confirm-cancel"
                            onClick={() => setConfirmingId(null)}
                          >
                            Abbrechen
                          </button>
                        </div>
                      ) : (
                        <div className="meal-item-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`${entry.foodName} nochmal eintragen`}
                            title="Nochmal eintragen"
                            onClick={() => startRepeat(entry)}
                          >
                            <PlusIcon />
                          </button>
                          <button
                            type="button"
                            className={editingId === entry.id ? 'icon-btn is-active' : 'icon-btn'}
                            aria-label={`${entry.foodName} bearbeiten`}
                            aria-expanded={editingId === entry.id}
                            title="Bearbeiten"
                            onClick={() => (editingId === entry.id ? cancelEdit() : startEdit(entry))}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            aria-label={`${entry.foodName} löschen`}
                            title="Löschen"
                            onClick={() => setConfirmingId(entry.id)}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}

                      {editingId === entry.id && (
                        <div className="meal-item-edit">
                          {editError && <div className="error-msg">{editError}</div>}
                          <div className="add-controls">
                            <label>
                              Menge (g)
                              <input
                                type="number"
                                min={1}
                                max={MAX_QUANTITY_IN_GRAMS}
                                value={editQuantity}
                                onChange={e => setEditQuantity(Number(e.target.value))}
                              />
                            </label>
                            <label>
                              Mahlzeit
                              <select
                                value={editMealType}
                                onChange={e => {
                                  // Der DOM-Wert ist immer ein einfacher String; die Optionen
                                  // stammen aus MEAL_TYPES, der Guard belegt das auch fuer den Typ.
                                  if (isMealType(e.target.value)) setEditMealType(e.target.value);
                                }}
                              >
                                {MEAL_TYPES.map(t => (
                                  <option key={t} value={t}>{mealTypeLabel(t)}</option>
                                ))}
                              </select>
                            </label>
                            <button onClick={() => handleUpdate(entry)} className="btn-primary" disabled={saving}>
                              {saving ? 'Wird gespeichert...' : 'Speichern'}
                            </button>
                            <button onClick={cancelEdit} className="btn-secondary">Abbrechen</button>
                          </div>
                          <div className="nutrient-preview">
                            <span>Kalorien: <strong>{scale(entry.calories, entry.quantityInGrams, editQuantity)} kcal</strong></span>
                            <span>Protein: <strong>{scale(entry.protein, entry.quantityInGrams, editQuantity)}g</strong></span>
                            <span>Kohlenhydrate: <strong>{scale(entry.carbohydrates, entry.quantityInGrams, editQuantity)}g</strong></span>
                            <span>Fett: <strong>{scale(entry.fat, entry.quantityInGrams, editQuantity)}g</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {period && (
        period.daysWithEntries === 0 ? (
          <p className="no-results">In diesem Zeitraum ist nichts erfasst.</p>
        ) : (
          <>
            <div className="summary-cards">
              <div className="summary-card cal">
                <div className="summary-value">Ø {Math.round(period.averages.calories)}</div>
                <div className="summary-label">kcal pro Tag</div>
                {goals && <GoalProgress value={period.averages.calories} goal={goals.calorieGoal} unit="kcal" />}
              </div>
              <div className="summary-card protein">
                <div className="summary-value">Ø {Math.round(period.averages.protein)}g</div>
                <div className="summary-label">Protein pro Tag</div>
                {goals && <GoalProgress value={period.averages.protein} goal={goals.proteinGoal} unit="g" />}
              </div>
              <div className="summary-card carbs">
                <div className="summary-value">Ø {Math.round(period.averages.carbohydrates)}g</div>
                <div className="summary-label">Kohlenhydrate pro Tag</div>
                {goals && <GoalProgress value={period.averages.carbohydrates} goal={goals.carbohydrateGoal} unit="g" />}
              </div>
              <div className="summary-card fat">
                <div className="summary-value">Ø {Math.round(period.averages.fat)}g</div>
                <div className="summary-label">Fett pro Tag</div>
                {goals && <GoalProgress value={period.averages.fat} goal={goals.fatGoal} unit="g" />}
              </div>
            </div>

            <p className="period-note">
              Schnitt aus {period.daysWithEntries} von {period.daysInPeriod} erfassten Tagen
            </p>

            {!goals && (
              <p className="goal-hint">
                Noch keine Tagesziele gesetzt. <Link to="/goals">Jetzt festlegen</Link>
              </p>
            )}

            <DayStrip
              from={from}
              to={to}
              mode={mode}
              days={period.days}
              calorieGoal={goals?.calorieGoal ?? 0}
              onSelect={jumpToDay}
            />

            <div className="micro-grid">
              <h2>Mikronährstoffe pro Tag</h2>
              <div className="micro-items">
                <MicroItem label="Ballaststoffe" value={period.averages.fiber} unit="g" />
                <MicroItem label="Zucker" value={period.averages.sugar} unit="g" />
                <MicroItem label="Gesättigte Fette" value={period.averages.saturatedFat} unit="g" />
                <MicroItem label="Natrium" value={period.averages.sodium} unit="mg" />
                <MicroItem label="Vitamin A" value={period.averages.vitaminA} unit="µg" />
                <MicroItem label="Vitamin C" value={period.averages.vitaminC} unit="mg" />
                <MicroItem label="Vitamin D" value={period.averages.vitaminD} unit="µg" />
                <MicroItem label="Calcium" value={period.averages.calcium} unit="mg" />
                <MicroItem label="Eisen" value={period.averages.iron} unit="mg" />
                <MicroItem label="Kalium" value={period.averages.potassium} unit="mg" />
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}

// MealEntry-Werte sind bereits auf quantityInGrams skaliert, deshalb erst auf
// die gespeicherte Menge normalisieren und dann auf die neue Menge hochrechnen.
function scale(value: number, currentQuantity: number, newQuantity: number): number {
  if (!currentQuantity) return 0;
  return Math.round(value / currentQuantity * newQuantity * 10) / 10;
}

function GoalProgress({ value, goal, unit }: { value: number; goal: number; unit: string }) {
  const percent = goal > 0 ? (value / goal) * 100 : 0;
  const exceeded = percent > 100;
  return (
    <div className="goal-progress">
      {/* Balken bei 100% kappen, damit die Karte nicht aufreisst - der Prozentwert bleibt exakt. */}
      <div className="progress-bar">
        <div
          className={exceeded ? 'progress-fill over' : 'progress-fill'}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="goal-label">
        von {Math.round(goal)} {unit} · {Math.round(percent)}%
      </div>
    </div>
  );
}

// `unit` ist nur die bevorzugte Einheit - formatNutrient weicht auf eine kleinere aus, statt
// Spurenmengen (Vitamin A, Vitamin D, Eisen) faelschlich als "0" auszuweisen.
function MicroItem({ label, value, unit }: { label: string; value: number; unit: NutrientUnit }) {
  return (
    <div className="micro-item">
      <span className="micro-label">{label}</span>
      <span className="micro-value">{formatNutrient(value, unit)}</span>
    </div>
  );
}

/**
 * Ein Balken je Tag des Zeitraums - die Luecken sind hier die eigentliche Aussage: ein Schnitt
 * aus fuenf von sieben Tagen sagt wenig, solange man nicht sieht, WELCHE zwei Tage fehlen.
 * Deshalb zeichnet der Streifen jeden Tag von from bis to selbst und schlaegt die Zahlen in der
 * Antwort nur nach, statt sich auf deren Laenge zu verlassen.
 */
function DayStrip({
  from,
  to,
  mode,
  days,
  calorieGoal,
  onSelect,
}: {
  from: string;
  to: string;
  mode: ViewMode;
  days: { date: string; totalEntries: number; totalCalories: number }[];
  calorieGoal: number;
  onSelect: (date: string) => void;
}) {
  const byDate = new Map(days.map(d => [d.date.split('T')[0], d]));
  const allDays = eachDay(from, to);

  // Ohne Tagesziel gibt es keinen absoluten Massstab, dann ist der hoechste Tag des Zeitraums
  // die volle Hoehe - die Balken bleiben untereinander vergleichbar, nur nicht gegen ein Soll.
  const maxCalories = Math.max(...days.map(d => d.totalCalories), 0);
  const reference = calorieGoal > 0 ? calorieGoal : maxCalories;

  return (
    <div className="day-strip">
      <h2>Kalorien je Tag</h2>
      <div className="day-strip-bars">
        {allDays.map(day => {
          const entry = byDate.get(day);
          const calories = entry ? entry.totalCalories : 0;
          const erfasst = !!entry && entry.totalEntries > 0;
          // Mindesthoehe fuer erfasste Tage: ein 2-Kalorien-Tag darf nicht wie ein leerer aussehen.
          const height = reference > 0 ? Math.max(Math.min(calories / reference, 1) * 100, 4) : 4;
          return (
            <button
              key={day}
              type="button"
              className={erfasst ? 'day-bar' : 'day-bar day-bar-gap'}
              onClick={() => onSelect(day)}
              title={erfasst ? `${germanDate(day)}: ${Math.round(calories)} kcal` : `${germanDate(day)}: nichts erfasst`}
              aria-label={
                erfasst
                  ? `${germanDate(day)}: ${Math.round(calories)} kcal, Tag öffnen`
                  : `${germanDate(day)}: nichts erfasst, Tag öffnen`
              }
            >
              <span className="day-bar-fill" style={erfasst ? { height: `${height}%` } : undefined} />
            </button>
          );
        })}
      </div>
      {mode === 'week' ? (
        <div className="day-strip-labels" aria-hidden="true">
          {allDays.map(day => (
            <span key={day} className="day-strip-label">{WEEKDAY_LETTERS[parseDate(day).getDay()]}</span>
          ))}
        </div>
      ) : (
        // Im Monat waeren einunddreissig Beschriftungen Grafik statt Information; die beiden
        // Enden reichen, um den Streifen einzuordnen.
        <div className="day-strip-ends" aria-hidden="true">
          <span>{germanDate(from)}</span>
          <span>{germanDate(to)}</span>
        </div>
      )}
    </div>
  );
}

// Inline statt aus public/icons.svg: das dortige Sprite enthaelt ausschliesslich Marken- und
// Social-Symbole, keine Werkzeugsymbole. Inline erbt das Icon ausserdem die Farbe des Knopfes
// (currentColor) und braucht keinen zweiten Request.
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z" />
      <path d="m14 6 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 4h4" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
