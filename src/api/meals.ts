import client from './client';
import type { MealTypeName } from '../constants/mealTypes';

// Spiegelt MealEndpoints.MaxQuantityInGrams: die API lehnt seit der letzten Aenderung alles
// ausserhalb von (0, 10000] mit 400 ab. Der Wert steht hier neben den Requesttypen, weil er
// Teil des Vertrags ist und nicht Teil einer einzelnen Seite.
export const MAX_QUANTITY_IN_GRAMS = 10000;

/**
 * Prueft eine Menge gegen dieselbe Regel wie der Server und liefert die Meldung, oder null,
 * wenn die Menge gueltig ist. Bewusst vor dem Request: sonst sieht der Nutzer erst nach dem
 * Rundlauf, dass die Eingabe nie eine Chance hatte.
 */
export function quantityError(quantityInGrams: number): string | null {
  if (!Number.isFinite(quantityInGrams) || quantityInGrams <= 0)
    return 'Menge muss größer als 0 sein.';
  if (quantityInGrams > MAX_QUANTITY_IN_GRAMS)
    return `Menge darf höchstens ${MAX_QUANTITY_IN_GRAMS} g betragen.`;
  return null;
}

export interface MealEntry {
  id: string;
  foodName: string;
  brand?: string;
  quantityInGrams: number;
  mealType: string;
  date: string;
  time: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  sodium?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
}

export interface DailySummary {
  date: string;
  totalEntries: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbohydrates: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
  totalSaturatedFat: number;
  totalSodium: number;
  totalVitaminA: number;
  totalVitaminC: number;
  totalVitaminD: number;
  totalCalcium: number;
  totalIron: number;
  totalPotassium: number;
  entries: MealEntry[];
}

export interface CreateMealRequest {
  foodName: string;
  brand?: string;
  barcode?: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  sodium?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
  quantityInGrams: number;
  // Gesendet wird nur, was das Server-Enum kennt - alles andere quittiert die API mit 400.
  mealType: MealTypeName;
  date?: string;
  time?: string;
}

export interface UpdateMealRequest {
  quantityInGrams: number;
  mealType: MealTypeName;
  date?: string;
  time?: string;
}

export const mealsApi = {
  getByDate: (date: string) =>
    client.get<MealEntry[]>('/api/meals', { params: { date } }),

  getSummary: (date: string) =>
    client.get<DailySummary>('/api/meals/summary', { params: { date } }),

  create: (data: CreateMealRequest) =>
    client.post<MealEntry>('/api/meals', data),

  update: (id: string, data: UpdateMealRequest) =>
    client.put<MealEntry>(`/api/meals/${id}`, data),

  delete: (id: string) =>
    client.delete(`/api/meals/${id}`),
};
