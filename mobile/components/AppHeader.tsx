import { View, Text, Image, StyleSheet } from 'react-native';
import ChipsNav from '@/components/ChipsNav';
import { colors } from '@/theme';

type Props = {
  title?: string;     // título grande a la izquierda
  showChips?: boolean;
};

export default function AppHeader({ title = 'CriticalFinance', showChips = true }: Props) {
  return (
    <View style={s.wrap}>
      {/* fila título + logo */}
      <View style={s.row}>
        <Text style={s.title}>{title}</Text>
        <Image
          source={require('@/assets/images/logo-circle.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </View>

      {/* chips (solo si lo pides) */}
      {showChips && <ChipsNav />}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, backgroundColor: colors.bg },
  row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:{ color: colors.text, fontSize: 22, fontWeight: 'bold' },
  logo: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.card },
});