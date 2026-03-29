import client from './client';

export interface FoodItem {
  id?: string;
  name: string;
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
}

export const foodApi = {
  search: (query: string) =>
    client.get<FoodItem[]>('/api/food/search', { params: { query } }),

  getByBarcode: (barcode: string) =>
    client.get<FoodItem>(`/api/food/barcode/${barcode}`),
};
