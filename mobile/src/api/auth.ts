// src/api/auth.ts
import { api } from './client';

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });

  // Aceptamos todas las variantes de token que un backend puede devolver.
  const access_token =
    data.access_token ??
    data.token ??
    data.jwt ??
    data.accessToken ??
    null;

  const user =
    data.user ??
    data.usuario ??
    null;

  console.log('AUTH login() RAW:', data);
  console.log('AUTH token detectado:', access_token);

  if (!access_token) {
    throw new Error('El backend no devolvió access_token');
  }

  return { access_token, user };
}
