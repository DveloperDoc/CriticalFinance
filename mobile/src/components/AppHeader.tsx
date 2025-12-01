import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ChipsNav from '@/components/ChipsNav';
import { colors } from '@/theme';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

type Props = {
  title?: string;
  showChips?: boolean;
};

type Alert = {
  id: string;
  readAt: string | null;
};

export default function AppHeader({ title = 'CriticalFinance', showChips = true }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  // Cargar alertas para mostrar badge
  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts', 'header'],
    queryFn: async () => {
      const { data } = await api.get('/alerts');
      return data as Alert[];
    },
    enabled: !!token,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const unreadCount = alerts.filter(a => !a.readAt).length;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <SafeAreaView style={{ backgroundColor: colors.bg }}>
      <View style={[s.wrap, { paddingTop: insets.top + 8 }]}>

        {/* FILA SUPERIOR: título + logo + campanita */}
        <View style={s.row}>
          <Text style={s.title}>{title}</Text>

          <View style={s.rightZone}>
            {/* CAMPANITA */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/alertas')}
              style={s.bellBtn}
              activeOpacity={0.8}
            >
              <Feather name="bell" size={22} color={colors.text} />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{badgeLabel}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* LOGO */}
            <Image
              source={require('../../assets/images/logo-circle.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* CHIPS */}
        {showChips && <ChipsNav />}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: colors.bg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },

  rightZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  logo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.card,
  },

  bellBtn: {
    position: 'relative',
    padding: 4,
  },

  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    backgroundColor: colors.danger ?? '#EF4444',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },

  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
