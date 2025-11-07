import axios from 'axios';

// Emulador Android → 10.0.2.2 ; celular real con Expo Go → IP de tu PC
export const api = axios.create({
  baseURL: 'http://10.0.2.2:3000',
});

export type Tx = {
  id: string;
  accountId: string;
  categoryId?: string | null;
  bookedAt: string;
  valueCents: number;
  type: 'debit' | 'credit';
  merchant?: string | null;
  description?: string | null;
  anomalyScore?: number | null;
  isRecurring: boolean;
  createdAt: string;
  category?: { id: string; name: string; color?: string | null } | null;
};

export async function fetchTransactions(params?: {
  take?: number; skip?: number; from?: string; to?: string; accountId?: string;
}): Promise<Tx[]> {
  const res = await api.get('/transactions', { params });
  return res.data;
}