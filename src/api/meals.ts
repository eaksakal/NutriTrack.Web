import client from './client';

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
  mealType: string;
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

  delete: (id: string) =>
    client.delete(`/api/meals/${id}`),
};
