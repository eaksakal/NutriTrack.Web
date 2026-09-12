import { isAxiosError } from 'axios';
import client from './client';

export interface Goals {
  id: string;
  calorieGoal: number;
  proteinGoal: number;
  carbohydrateGoal: number;
  fatGoal: number;
  updatedAt: string;
}

export interface UpsertGoalsRequest {
  calorieGoal: number;
  proteinGoal: number;
  carbohydrateGoal: number;
  fatGoal: number;
}

export const goalsApi = {
  // Weicht bewusst vom Muster der anderen API-Module ab (liefert data statt AxiosResponse):
  // 404 heisst hier "noch keine Ziele gesetzt" und ist ein regulaerer Zustand, kein Fehler.
  // Nur so kann der Aufrufer null unterscheiden, ohne selbst Axios-Fehler auszuwerten.
  get: async (): Promise<Goals | null> => {
    try {
      const res = await client.get<Goals>('/api/goals');
      return res.data;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  },

  save: (data: UpsertGoalsRequest) =>
    client.put<Goals>('/api/goals', data),
};

export interface SuggestGoalsRequest {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
  wish: string;
}

export interface GoalsSuggestion {
  calorieGoal: number;
  proteinGoal: number;
  carbohydrateGoal: number;
  fatGoal: number;
  basalMetabolicRate: number;
  maintenanceCalories: number;
  explanation: string;
  interpretedWish: string;
}

/**
 * Schlaegt Ziele vor, speichert aber nichts - uebernommen wird ueber goalsApi.save.
 *
 * Von den hier gesendeten Daten verlaesst nur `wish` unseren Server. Gewicht, Groesse, Alter und
 * Geschlecht braucht das Backend fuer die Formel und gibt sie nicht weiter; im kostenlosen
 * Gemini-Kontingent wuerde Google Uebermitteltes zum Training nutzen und von Menschen pruefen
 * lassen, und Koerperdaten haben dort nichts verloren.
 */
export const goalsSuggestApi = {
  suggest: (body: SuggestGoalsRequest) =>
    client.post<GoalsSuggestion>('/api/goals/suggest', body),
};
