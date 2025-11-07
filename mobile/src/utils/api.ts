import axios from 'axios';

export const api = axios.create({ baseURL: 'http://10.0.2.2:3000' }); // emulador

let currentToken: string | null = null;
export const setAuthToken = (t: string | null) => { currentToken = t; };

api.interceptors.request.use(cfg => {
  if (currentToken) cfg.headers.Authorization = `Bearer ${currentToken}`;
  return cfg;
});