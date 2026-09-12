import { useState, type FormEvent } from 'react';
import { foodApi, type FoodItem } from '../api/food';
import { mealsApi, quantityError, MAX_QUANTITY_IN_GRAMS } from '../api/meals';
import { MEAL_TYPES, mealTypeLabel, isMealType, type MealTypeName } from '../constants/mealTypes';
import { apiErrorMessage } from '../api/errors';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [mealType, setMealType] = useState<MealTypeName>('Lunch');
  const [addSuccess, setAddSuccess] = useState('');
  const [addError, setAddError] = useState('');

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSelected(null);
    try {
      const res = await foodApi.search(query);
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selected) return;

    // Der Knopf steht ausserhalb eines <form>, also greift die Browser-Validierung des
    // Zahlenfelds (min/max) hier nie - ohne diese Pruefung ginge eine 20000-g-Eingabe an die
    // API und kaeme als nacktes 400 zurueck.
    const invalid = quantityError(quantity);
    if (invalid) {
      setAddError(invalid);
      setAddSuccess('');
      return;
    }

    setAddError('');
    try {
      await mealsApi.create({
        foodName: selected.name,
        brand: selected.brand,
        barcode: selected.barcode,
        calories: selected.calories,
        protein: selected.protein,
        carbohydrates: selected.carbohydrates,
        fat: selected.fat,
        fiber: selected.fiber,
        sugar: selected.sugar,
        saturatedFat: selected.saturatedFat,
        sodium: selected.sodium,
        vitaminA: selected.vitaminA,
        vitaminC: selected.vitaminC,
        vitaminD: selected.vitaminD,
        calcium: selected.calcium,
        iron: selected.iron,
        potassium: selected.potassium,
        quantityInGrams: quantity,
        mealType,
      });
      setAddSuccess(`${selected.name} (${quantity}g) hinzugefügt!`);
      setSelected(null);
      setTimeout(() => setAddSuccess(''), 3000);
    } catch (err) {
      // Menge und Mahlzeitentyp weist die API mit einem konkreten Satz im Feld "error" zurueck.
      // Ein alert() mit Einheitstext haette diese Begruendung verworfen - und den Nutzer im
      // Zweifel raten lassen, welches der beiden Felder gemeint ist.
      setAddError(apiErrorMessage(err, 'Hinzufügen fehlgeschlagen.'));
    }
  };

  const calc = (val: number) => Math.round(val * quantity / 100 * 10) / 10;

  return (
    <div className="search-page">
      <h1>Lebensmittel suchen</h1>

      {addSuccess && <div className="success-msg">{addSuccess}</div>}
      {addError && <div className="error-msg">{addError}</div>}

      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          placeholder="z.B. Haferflocken, Banane, Skyr..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Suche...' : 'Suchen'}
        </button>
      </form>

      {selected && (
        <div className="add-panel">
          <h2>{selected.name} {selected.brand && <span className="brand">({selected.brand})</span>}</h2>
          <div className="add-controls">
            <label>
              Menge (g)
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                min={1}
                max={MAX_QUANTITY_IN_GRAMS}
              />
            </label>
            <label>
              Mahlzeit
              <select
                value={mealType}
                onChange={e => {
                  // Die Optionen stammen aus MEAL_TYPES; der Guard bringt den DOM-String
                  // wieder auf den Typ, den die API akzeptiert.
                  if (isMealType(e.target.value)) setMealType(e.target.value);
                }}
              >
                {MEAL_TYPES.map(t => <option key={t} value={t}>{mealTypeLabel(t)}</option>)}
              </select>
            </label>
            <button onClick={handleAdd} className="btn-primary">Hinzufügen</button>
            <button onClick={() => setSelected(null)} className="btn-secondary">Abbrechen</button>
          </div>
          <div className="nutrient-preview">
            <span>Kalorien: <strong>{calc(selected.calories)} kcal</strong></span>
            <span>Protein: <strong>{calc(selected.protein)}g</strong></span>
            <span>Kohlenhydrate: <strong>{calc(selected.carbohydrates)}g</strong></span>
            <span>Fett: <strong>{calc(selected.fat)}g</strong></span>
          </div>
        </div>
      )}

      <div className="food-results">
        {results.map((food, i) => (
          <div key={i} className="food-card" onClick={() => { setSelected(food); setQuantity(100); }}>
            <div className="food-card-name">
              {food.name}
              {food.brand && <span className="brand"> - {food.brand}</span>}
            </div>
            <div className="food-card-macros">
              <span>{food.calories} kcal</span>
              <span>P: {food.protein}g</span>
              <span>K: {food.carbohydrates}g</span>
              <span>F: {food.fat}g</span>
            </div>
            <div className="food-card-hint">pro 100g</div>
          </div>
        ))}
        {!loading && results.length === 0 && query && (
          <p className="no-results">Keine Ergebnisse gefunden.</p>
        )}
      </div>
    </div>
  );
}
