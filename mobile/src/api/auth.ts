import { api } from './client';

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password }); // o '/api/auth/login'
  return data as { access_token: string; user: { id: string; email: string } };
}