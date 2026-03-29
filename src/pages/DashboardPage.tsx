import { useState, useEffect } from 'react';
import { mealsApi, type DailySummary } from '../api/meals';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function DashboardPage() {
  const [date, setDate] = useState(formatDate(new Date()));
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await mealsApi.getSummary(date);
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, [date]);

  const handleDelete = async (id: string) => {
    await mealsApi.delete(id);
    loadSummary();
  };

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(formatDate(d));
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
            </div>
            <div className="summary-card protein">
              <div className="summary-value">{Math.round(summary.totalProtein)}g</div>
              <div className="summary-label">Protein</div>
            </div>
            <div className="summary-card carbs">
              <div className="summary-value">{Math.round(summary.totalCarbohydrates)}g</div>
              <div className="summary-label">Kohlenhydrate</div>
            </div>
            <div className="summary-card fat">
              <div className="summary-value">{Math.round(summary.totalFat)}g</div>
              <div className="summary-label">Fett</div>
            </div>
          </div>

          <div className="micro-grid">
            <h2>Mikronährstoffe</h2>
            <div className="micro-items">
              <MicroItem label="Ballaststoffe" value={summary.totalFiber} unit="g" />
              <MicroItem label="Zucker" value={summary.totalSugar} unit="g" />
              <MicroItem label="Gesättigte Fette" value={summary.totalSaturatedFat} unit="g" />
              <MicroItem label="Natrium" value={summary.totalSodium} unit="mg" factor={1000} />
              <MicroItem label="Vitamin A" value={summary.totalVitaminA} unit="µg" factor={1000000} />
              <MicroItem label="Vitamin C" value={summary.totalVitaminC} unit="mg" factor={1000} />
              <MicroItem label="Vitamin D" value={summary.totalVitaminD} unit="µg" factor={1000000} />
              <MicroItem label="Calcium" value={summary.totalCalcium} unit="mg" factor={1000} />
              <MicroItem label="Eisen" value={summary.totalIron} unit="mg" factor={1000} />
              <MicroItem label="Kalium" value={summary.totalPotassium} unit="mg" factor={1000} />
            </div>
          </div>

          <div className="meals-list">
            <h2>Mahlzeiten ({summary.totalEntries})</h2>
            {summary.entries.length === 0 && (
              <p className="no-results">Noch keine Einträge für diesen Tag.</p>
            )}
            {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).map(type => {
              const meals = summary.entries.filter(e => e.mealType === type);
              if (meals.length === 0) return null;
              return (
                <div key={type} className="meal-group">
                  <h3>{mealTypeLabel(type)}</h3>
                  {meals.map(entry => (
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
                      <button onClick={() => handleDelete(entry.id)} className="btn-delete">×</button>
                    </div>
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

function mealTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    Breakfast: 'Frühstück',
    Lunch: 'Mittagessen',
    Dinner: 'Abendessen',
    Snack: 'Snack',
  };
  return labels[type] || type;
}

function MicroItem({ label, value, unit, factor = 1 }: { label: string; value: number; unit: string; factor?: number }) {
  const display = factor > 1 ? Math.round(value * factor * 10) / 10 : Math.round(value * 10) / 10;
  return (
    <div className="micro-item">
      <span className="micro-label">{label}</span>
      <span className="micro-value">{display} {unit}</span>
    </div>
  );
}
