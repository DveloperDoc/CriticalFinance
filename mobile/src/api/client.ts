import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://10.0.2.2:3000', // emulador Android; si usaste prefijo: '/api'
  timeout: 10000,
});

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete api.defaults.headers.common['Authorization'];
}