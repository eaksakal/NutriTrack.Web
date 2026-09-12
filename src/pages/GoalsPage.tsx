import { useState, useEffect, type FormEvent } from 'react';
import { goalsApi, goalsSuggestApi, type GoalsSuggestion, type SuggestGoalsRequest } from '../api/goals';
import { apiErrorMessage } from '../api/errors';
import type { PanelProps } from '../components/PanelProps';

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

export default function GoalsPage({ onDone, embedded }: PanelProps) {
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasGoals, setHasGoals] = useState(false);

  // Koerperdaten fuer den Rechner. Sie leben nur in diesem Formular und im Backend - an Google
  // geht ausschliesslich der Wunsch in Worten.
  const [body, setBody] = useState({
    weightKg: '',
    heightCm: '',
    age: '',
    sex: 'male' as 'male' | 'female',
    activityLevel: 'sedentary' as SuggestGoalsRequest['activityLevel'],
  });
  const [wish, setWish] = useState('');
  const [suggestion, setSuggestion] = useState<GoalsSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const handleSuggest = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const zahlen = {
      weightKg: Number(body.weightKg),
      heightCm: Number(body.heightCm),
      age: Number(body.age),
    };

    if (Object.values(zahlen).some(v => !Number.isFinite(v) || v <= 0)) {
      setError('Bitte Gewicht, Größe und Alter ausfüllen.');
      return;
    }

    setSuggesting(true);
    try {
      const res = await goalsSuggestApi.suggest({
        ...zahlen,
        sex: body.sex,
        activityLevel: body.activityLevel,
        wish: wish.trim(),
      });
      setSuggestion(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Vorschlag fehlgeschlagen.'));
    } finally {
      setSuggesting(false);
    }
  };

  /** Uebernimmt den Vorschlag ins Formular - gespeichert wird erst mit "Speichern". */
  const applySuggestion = () => {
    if (!suggestion) return;

    setForm({
      calorieGoal: String(suggestion.calorieGoal),
      proteinGoal: String(suggestion.proteinGoal),
      carbohydrateGoal: String(suggestion.carbohydrateGoal),
      fatGoal: String(suggestion.fatGoal),
    });
    setSuggestion(null);
    setSuccess('Vorschlag übernommen — jetzt noch speichern.');
  };

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
      onDone?.();
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
      {!embedded && <h1>Tagesziele</h1>}

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <form onSubmit={handleSuggest} className="add-panel goal-calc">
        <h2>Ziele ausrechnen lassen</h2>

        <div className="add-controls">
          <label>
            Gewicht (kg)
            <input type="number" min={25} max={400} step="0.1" value={body.weightKg}
              onChange={e => setBody({ ...body, weightKg: e.target.value })} />
          </label>
          <label>
            Größe (cm)
            <input type="number" min={100} max={250} step="1" value={body.heightCm}
              onChange={e => setBody({ ...body, heightCm: e.target.value })} />
          </label>
          <label>
            Alter
            <input type="number" min={14} max={120} step="1" value={body.age}
              onChange={e => setBody({ ...body, age: e.target.value })} />
          </label>
          <label>
            Geschlecht
            <select value={body.sex}
              onChange={e => setBody({ ...body, sex: e.target.value as 'male' | 'female' })}>
              <option value="male">männlich</option>
              <option value="female">weiblich</option>
            </select>
          </label>
          <label>
            Aktivität
            <select value={body.activityLevel}
              onChange={e => setBody({ ...body, activityLevel: e.target.value as SuggestGoalsRequest['activityLevel'] })}>
              <option value="sedentary">sitzend, kaum Sport</option>
              <option value="light">leicht, 1–3× Sport</option>
              <option value="moderate">mittel, 3–5× Sport</option>
              <option value="active">hoch, 6–7× Sport</option>
              <option value="veryActive">sehr hoch, körperliche Arbeit</option>
            </select>
          </label>
        </div>

        <label className="goal-wish">
          Was willst du erreichen?
          <input type="text" maxLength={500} value={wish}
            placeholder="z. B. abnehmen, aber nicht hungern"
            onChange={e => setWish(e.target.value)} />
        </label>

        <div className="nutrient-preview">
          <span>
            Gewicht, Größe und Alter bleiben auf dem Server und werden nur für die Formel
            gebraucht. An die KI geht ausschließlich dein Satz oben.
          </span>
        </div>

        <button type="submit" className="btn-primary" disabled={suggesting}>
          {suggesting ? 'Wird gerechnet...' : 'Vorschlag berechnen'}
        </button>
      </form>

      {suggestion && (
        <div className="add-panel goal-suggestion">
          <h2>Vorschlag</h2>

          {suggestion.interpretedWish && (
            <p className="goal-interpretation">So verstanden: {suggestion.interpretedWish}</p>
          )}

          <div className="summary-cards">
            <div className="summary-card cal">
              <div className="summary-value">{suggestion.calorieGoal}</div>
              <div className="summary-label">kcal</div>
            </div>
            <div className="summary-card protein">
              <div className="summary-value">{suggestion.proteinGoal}g</div>
              <div className="summary-label">Protein</div>
            </div>
            <div className="summary-card carbs">
              <div className="summary-value">{suggestion.carbohydrateGoal}g</div>
              <div className="summary-label">Kohlenhydrate</div>
            </div>
            <div className="summary-card fat">
              <div className="summary-value">{suggestion.fatGoal}g</div>
              <div className="summary-label">Fett</div>
            </div>
          </div>

          <p className="goal-explanation">{suggestion.explanation}</p>
          <p className="goal-disclaimer">
            Ein Startpunkt aus einer gängigen Formel, keine Ernährungsberatung. Wenn du
            Vorerkrankungen hast oder stark abnehmen willst, sprich es einmal ärztlich durch.
          </p>

          <div className="ai-actions">
            <button type="button" className="btn-primary" onClick={applySuggestion}>
              Übernehmen
            </button>
            <button type="button" className="btn-secondary" onClick={() => setSuggestion(null)}>
              Verwerfen
            </button>
          </div>
        </div>
      )}

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
