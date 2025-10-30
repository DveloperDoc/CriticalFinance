import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../../providers/AuthProvider';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('doc@example.com');
  const [password, setPassword] = useState('123456');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setErr(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      setErr(e?.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.box}>
      <Text style={s.title}>Critical Finance</Text>
      <TextInput
        style={s.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
      />
      <TextInput
        style={s.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Contraseña"
        secureTextEntry
      />
      {err ? <Text style={s.err}>{err}</Text> : null}
      <Pressable style={s.btn} onPress={onLogin} disabled={loading}>
        <Text style={s.btnText}>{loading ? 'Entrando…' : 'Entrar'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12 },
  btn: { backgroundColor: '#0ea5e9', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '700' },
  err: { color: '#ef4444' },
});