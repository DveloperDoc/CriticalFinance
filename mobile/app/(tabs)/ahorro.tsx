import { View, Text } from 'react-native';
import { colors } from '@/theme';

export default function Ahorro() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text }}>Ahorro (en construcción)</Text>
    </View>
  );
}

// Opcional: título directo a la pantalla (también lo setea el Tabs.Screen).
export const options = { title: 'Ahorro' };