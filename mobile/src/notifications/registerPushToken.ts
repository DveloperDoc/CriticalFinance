// mobile/src/notifications/registerPushToken.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/api/client';

export async function registerPushToken() {
  try {
    // En Expo Go NO se pueden recibir push remotos
    if (Constants.appOwnership === 'expo') {
      console.log(
        'registerPushToken: ejecutando en Expo Go, se omite registro de push token.',
      );
      return;
    }

    // Config canal Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // Permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permiso de notificaciones no concedido');
      return;
    }

    // Obtener token Expo
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const expoToken = tokenData.data;

    console.log('Expo push token:', expoToken);

    // Registrar token en backend (nuevo modelo PushToken)
    await api.post('/me/push-token', {
      token: expoToken,
      platform: Platform.OS,
    });

    console.log('Push token registrado en backend');
  } catch (err) {
    console.error('Error registrando push token', err);
  }
}
