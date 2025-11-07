import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'http://10.0.2.2:3000/auth/logout'; // ajusta si es distinto

export async function logout() {
  const token = await AsyncStorage.getItem('token');
  try {
    if (token) {
      await axios.post(API_URL, null, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  } finally {
    await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
  }
}