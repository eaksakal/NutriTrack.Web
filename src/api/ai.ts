import client from './client';
import type { FoodItem } from './food';

// Der gesamte Gespraechsfaden reist bei jeder Anfrage mit: der Server haelt bewusst keinen
// Sitzungszustand, damit es nichts aufzuraeumen gibt. Der Preis ist, dass der Faden mit dem
// Tab verschwindet - bei einer Eingabe unter einer Minute ist das kein Verlust.
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

// Die KI schaetzt nur Makros; Mikronaehrstoffe bleiben null, weil geschaetzte Vitaminwerte
// Zahlen waeren, die niemand widerlegen kann.
export interface NutrientEstimate {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  saturatedFat?: number | null;
  sodium?: number | null;
}

export interface ParsedItem {
  label: string;
  quantityInGrams: number;
  mealType: string;
  /**
   * Woher die Werte stammen:
   *  openfoodfacts – Treffer in der Produktdatenbank, `candidates` ist gefuellt.
   *  generic       – Standardwert fuer ein Grundnahrungsmittel oder ein selbst gekochtes
   *                  Gericht. Kein Rueckfall, sondern die bessere Quelle: die Produktdatenbank
   *                  kennt zu "Spaghetti" nur trockene Nudeln (360 statt 150 kcal je 100 g).
   *  estimate      – Rueckfall: Markenprodukt gesucht, aber nichts gefunden.
   *  history       – Bezug auf einen eigenen frueheren Eintrag. Die Werte kommen aus dem
   *                  Tagebuch, nicht vom Modell; eingetragen wird ueber den repeat-Endpunkt.
   */
  source: 'openfoodfacts' | 'generic' | 'estimate' | 'history';
  candidates: FoodItem[];
  estimate: NutrientEstimate | null;
  /** Gesetzt genau dann, wenn `source === 'history'`: der Eintrag, der wiederholt wird. */
  sourceEntryId: string | null;
  /** Der Zeitpunkt des Originals in Worten, z. B. "gestern 21:30". */
  sourceHint: string | null;
}

export interface ParseMealResponse {
  question: string | null;
  notice: string | null;
  items: ParsedItem[];
}

/**
 * Hoechstzahl an Nachrichten, die POST /api/ai/parse-meal annimmt (AiEndpoints.MaxMessages).
 * Der Wert steht hier und nicht in der Seite, damit der Faden schon beim Aufbau gekuerzt wird:
 * eine 11. Nachricht wuerde der Server mit 400 abweisen, und da der Verlauf nur wachsen kann,
 * waere die Seite danach dauerhaft unbrauchbar.
 */
export const MAX_MESSAGES = 10;

export const aiApi = {
  parseMeal: (messages: ChatMessage[]) =>
    client.post<ParseMealResponse>('/api/ai/parse-meal', { messages }),
};
