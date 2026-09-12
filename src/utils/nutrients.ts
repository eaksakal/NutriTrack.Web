export type NutrientUnit = 'g' | 'mg' | 'µg';

// Die API liefert ALLE Naehrwerte in Gramm - so kommen sie von OpenFoodFacts und so liegen sie
// in der Datenbank. Fuer Vitamin A, Vitamin D und Eisen sind das Groessenordnungen von 1e-6 g
// bis 1e-3 g; in Gramm angezeigt ergaebe das nur Nullen, deshalb rechnet die Anzeige auf die
// fachuebliche Einheit des jeweiligen Naehrstoffs um.
const UNITS_PER_GRAM: Record<NutrientUnit, number> = {
  g: 1,
  mg: 1_000,
  'µg': 1_000_000,
};

// Von gross nach klein: der Formatter geht die Reihe ab der gewuenschten Einheit ab, bis ein
// Wert uebrig bleibt, der nicht auf 0 gerundet wird.
const UNIT_ORDER: NutrientUnit[] = ['g', 'mg', 'µg'];

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Formatiert einen Naehrwert in Gramm als Zahl samt Einheit, z. B. `formatNutrient(0.0008, 'µg')`
 * → "800 µg". Die Einheit geht immer aus dem Text hervor, damit Wert und Bezugsgroesse nicht
 * auseinanderlaufen koennen.
 *
 * `unit` ist die BEVORZUGTE Einheit. Wuerde der Wert darin auf 0 gerundet, weicht die Anzeige
 * automatisch auf die naechstkleinere aus: eine Spur Eisen als "0 mg" auszuweisen waere eine
 * falsche Aussage ("nicht enthalten"), waehrend "0.4 µg" die Wahrheit sagt. Nur ein echtes
 * Null-Ergebnis wird auch als "0" gezeigt.
 */
export function formatNutrient(valueInGrams: number, unit: NutrientUnit): string {
  if (!Number.isFinite(valueInGrams)) return `0 ${unit}`;

  const start = Math.max(UNIT_ORDER.indexOf(unit), 0);
  for (let i = start; i < UNIT_ORDER.length; i++) {
    const current = UNIT_ORDER[i];
    const scaled = round1(valueInGrams * UNITS_PER_GRAM[current]);
    if (scaled !== 0 || valueInGrams === 0) return `${scaled} ${current}`;
  }

  // Unterhalb von 0.05 µg gibt es keine kleinere Einheit mehr, auf die man ausweichen koennte.
  // Der Naehrstoff ist aber nachweislich enthalten, also nennt die Anzeige die Schranke statt
  // einer glatten 0.
  return '< 0.1 µg';
}
