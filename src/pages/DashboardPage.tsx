import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  mealsApi,
  quantityError,
  MAX_QUANTITY_IN_GRAMS,
  type DailySummary,
  type MealEntry,
} from '../api/meals';
import { goalsApi, type Goals } from '../api/goals';
import { MEAL_TYPES, mealTypeLabel, isMealType, type MealTypeName } from '../constants/mealTypes';
import { apiErrorMessage } from '../api/errors';
import { formatNutrient, type NutrientUnit } from '../utils/nutrients';

// Datum und Uhrzeit sind in der API fachlich LOKALE Zeit (MealEndpoints.LocalToday, DateTime.Now).
// toISOString() rechnet dagegen nach UTC: in Europe/Berlin stand hier zwischen Mitternacht und
// 01/02 Uhr noch der Vortag, waehrend ein neu angelegter Eintrag den lokalen Tag bekommt - der
// Eintrag war damit direkt nach dem Speichern unsichtbar. Deshalb die lokalen Datumsfelder.
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const [date, setDate] = useState(formatDate(new Date()));
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState(100);
  const [editMealType, setEditMealType] = useState<MealTypeName>('Lunch');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // showLoading=false beim Nachladen nach Aenderungen: sonst ersetzt der frueher
  // Return unten die komplette Seite und das offene Formular springt weg.
  const loadSummary = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await mealsApi.getSummary(date);
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [date]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    // null heisst "noch keine Ziele gesetzt" - dann bleibt die Anzeige ohne Soll-Werte.
    goalsApi.get().then(setGoals).catch(() => setGoals(null));
  }, []);

  const handleDelete = async (id: string) => {
    if (editingId === id) setEditingId(null);
    await mealsApi.delete(id);
    loadSummary(false);
  };

  const startEdit = (entry: MealEntry) => {
    setEditingId(entry.id);
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
  const changeDate = (days: number) => {
    const [year, month, day] = date.split('-').map(Number);
    setDate(formatDate(new Date(year, month - 1, day + days)));
  };

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="dashboard">
      <div className="date-nav">
        <button onClick={() => changeDate(-1)} className="btn-secondary">&larr;</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={() => changeDate(1)} className="btn-secondary">&rarr;</button>
      </div>

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
              return (
                <div key={type} className="meal-group">
                  <h3>{mealTypeLabel(type)}</h3>
                  {meals.map(entry => (
                    editingId === entry.id ? (
                      <div key={entry.id} className="add-panel">
                        <h2>
                          {entry.foodName}
                          {entry.brand && <span className="brand"> ({entry.brand})</span>}
                        </h2>
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
                    ) : (
                      <div key={entry.id} className="meal-item">
                        <div className="meal-item-info">
                          <strong>{entry.foodName}</strong>
                          {entry.brand && <span className="brand"> ({entry.brand})</span>}
                          <span className="meal-qty">{entry.quantityInGrams}g</span>
                        </div>
                        <div className="meal-item-macros">
                          <span>{Math.round(entry.calories)} kcal</span>
                          <span>P: {Math.round(entry.protein)}g</span>
                          <span>K: {Math.round(entry.carbohydrates)}g</span>
                          <span>F: {Math.round(entry.fat)}g</span>
                        </div>
                        <div className="meal-item-actions">
                          <button onClick={() => startEdit(entry)} className="btn-edit">Bearbeiten</button>
                          <button onClick={() => handleDelete(entry.id)} className="btn-delete">×</button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              );
            })}
          </div>
        </>
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
