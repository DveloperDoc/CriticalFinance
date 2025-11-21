// app/(auth)/register.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';

export default function Register() {
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nameTrim = name.trim();
    const emailTrim = email.trim();
    const passwordTrim = password;

    if (!nameTrim) return 'Ingresa un nombre';
    if (nameTrim.length < 2) return 'El nombre es demasiado corto';

    if (!emailTrim) return 'Ingresa un correo';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) return 'El correo no es válido';

    if (!passwordTrim) return 'Ingresa una contraseña';
    if (passwordTrim.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }

    return null;
  };

  const onRegister = async () => {
    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const nameTrim = name.trim();
      const emailTrim = email.trim();

      console.log('[REGISTER] Enviando request...', { nameTrim, emailTrim });

      // 1) Crear usuario en el backend
      const res = await api.post('/auth/register', {
        name: nameTrim,
        email: emailTrim,
        password,
      });

      console.log('[REGISTER] Respuesta OK:', res.status, res.data);

      // 2) Login inmediato con AuthProvider
      await login(emailTrim, password);

      // 3) Ir a las tabs
      router.replace('/(tabs)');
    } catch (e: any) {
      console.log('[REGISTER] ERROR crudo:', e);
      console.log('[REGISTER] response?.status:', e?.response?.status);
      console.log('[REGISTER] response?.data:', e?.response?.data);

      const status = e?.response?.status;
      const backendMsg = e?.response?.data?.message;

      if (status === 409) setErr('Ese correo ya está registrado');
      else if (status === 400) setErr(backendMsg || 'Datos inválidos, revisa el formulario');
      else if (status === 500) setErr('Error interno del servidor');
      else if (e?.message?.includes('Network'))
        setErr('No se pudo conectar con el servidor');
      else if (backendMsg) setErr(String(backendMsg));
      else setErr('Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.box}>
      <Text style={s.title}>Crear cuenta</Text>

      <TextInput
        style={s.input}
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (err) setErr(null);
        }}
        placeholder="Nombre"
      />

      <TextInput
        style={s.input}
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (err) setErr(null);
        }}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={s.input}
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (err) setErr(null);
        }}
        placeholder="Contraseña"
        secureTextEntry
        onSubmitEditing={onRegister}
      />

      {err ? <Text style={s.err}>{err}</Text> : null}

      <Pressable
        style={[s.btn, loading && { opacity: 0.7 }]}
        onPress={onRegister}
        disabled={loading}
      >
        <Text style={s.btnText}>
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </Text>
      </Pressable>

      <Pressable
        style={s.loginWrap}
        onPress={() => router.replace('/login')}
      >
        <Text style={s.loginText}>
          ¿Ya tienes cuenta? <Text style={s.loginLink}>Iniciar sesión</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
  },
  btn: {
    backgroundColor: '#0ea5e9',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
  err: {
    color: '#ef4444',
    marginTop: 4,
  },
  loginWrap: {
    marginTop: 14,
    alignItems: 'center',
  },
  loginText: {
    color: '#4b5563',
    fontSize: 14,
  },
  loginLink: {
    color: '#0ea5e9',
    fontWeight: '700',
  },
});
