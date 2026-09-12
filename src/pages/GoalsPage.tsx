import { useState, useEffect, type FormEvent } from 'react';
import { goalsApi } from '../api/goals';
import { apiErrorMessage } from '../api/errors';

interface GoalForm {
  calorieGoal: string;
  proteinGoal: string;
  carbohydrateGoal: string;
  fatGoal: string;
}

const EMPTY_FORM: GoalForm = {
  calorieGoal: '',
  proteinGoal: '',
  carbohydrateGoal: '',
  fatGoal: '',
};

export default function GoalsPage() {
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasGoals, setHasGoals] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const goals = await goalsApi.get();
        if (goals) {
          setForm({
            calorieGoal: String(goals.calorieGoal),
            proteinGoal: String(goals.proteinGoal),
            carbohydrateGoal: String(goals.carbohydrateGoal),
            fatGoal: String(goals.fatGoal),
          });
          setHasGoals(true);
        }
      } catch {
        setError('Ziele konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setField = (field: keyof GoalForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSuccess('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const values = {
      calorieGoal: Number(form.calorieGoal),
      proteinGoal: Number(form.proteinGoal),
      carbohydrateGoal: Number(form.carbohydrateGoal),
      fatGoal: Number(form.fatGoal),
    };

    // Number('') ergibt 0, Number('abc') NaN - beides faengt die Pruefung ab,
    // damit kein ungueltiger Body die 400-Antwort des Backends provoziert.
    const invalid = Object.values(values).some(v => !Number.isFinite(v) || v <= 0);
    if (invalid) {
      setError('Alle Werte müssen größer als 0 sein.');
      return;
    }

    setSaving(true);
    try {
      const res = await goalsApi.save(values);
      setForm({
        calorieGoal: String(res.data.calorieGoal),
        proteinGoal: String(res.data.proteinGoal),
        carbohydrateGoal: String(res.data.carbohydrateGoal),
        fatGoal: String(res.data.fatGoal),
      });
      setHasGoals(true);
      setSuccess('Ziele gespeichert.');
    } catch (err) {
      // Der PUT-Endpunkt weist ungueltige Ziele mit einem Satz im Feld "error" zurueck; die
      // Pruefung oben soll das verhindern, deckt aber nur ab, was das Formular kennt.
      setError(apiErrorMessage(err, 'Speichern fehlgeschlagen.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="goals-page">
      <h1>Tagesziele</h1>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <form onSubmit={handleSubmit} className="add-panel">
        <h2>{hasGoals ? 'Ziele anpassen' : 'Ziele festlegen'}</h2>
        <div className="add-controls">
          <label>
            Kalorien (kcal)
            <input
              type="number"
              min={1}
              step="1"
              value={form.calorieGoal}
              onChange={e => setField('calorieGoal', e.target.value)}
            />
          </label>
          <label>
            Protein (g)
            <input
              type="number"
              min={1}
              step="1"
              value={form.proteinGoal}
              onChange={e => setField('proteinGoal', e.target.value)}
            />
          </label>
          <label>
            Kohlenhydrate (g)
            <input
              type="number"
              min={1}
              step="1"
              value={form.carbohydrateGoal}
              onChange={e => setField('carbohydrateGoal', e.target.value)}
            />
          </label>
          <label>
            Fett (g)
            <input
              type="number"
              min={1}
              step="1"
              value={form.fatGoal}
              onChange={e => setField('fatGoal', e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
        <div className="nutrient-preview">
          <span>Gilt für jeden Tag, bis du die Ziele änderst.</span>
        </div>
      </form>
    </div>
  );
}
