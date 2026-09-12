// Die Namen sind die Bezeichner des serverseitigen Enums NutriTrack.Domain.Entities.MealType.
// Die API parst den String seit der letzten Aenderung mit Enum.TryParse UND Enum.IsDefined und
// antwortet auf alles andere mit 400 - jeder hier abweichende Wert ist damit kein Anzeigefehler
// mehr, sondern ein abgelehnter Request. `as const` bindet den Typ unten an genau diese Liste,
// damit ein Tippfehler beim Compiler auffaellt statt erst beim Nutzer.
export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;

export type MealTypeName = (typeof MEAL_TYPES)[number];

const MEAL_TYPE_LABELS: Record<MealTypeName, string> = {
  Breakfast: 'Frühstück',
  Lunch: 'Mittagessen',
  Dinner: 'Abendessen',
  Snack: 'Snack',
};

export function mealTypeLabel(type: string): string {
  return isMealType(type) ? MEAL_TYPE_LABELS[type] : type;
}

// Antworten der API sind zur Laufzeit nur Strings. Der Guard grenzt sie auf die vier bekannten
// Werte ein, bevor sie in ein Formularfeld wandern, aus dem sie als mealType zurueckgeschickt
// werden - sonst reichte eine kuenftige Enum-Erweiterung einen Wert durch, den das Select nicht
// anbietet, und das Speichern schluege mit 400 fehl.
export function isMealType(value: string): value is MealTypeName {
  return (MEAL_TYPES as readonly string[]).includes(value);
}
