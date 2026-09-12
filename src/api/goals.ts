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
