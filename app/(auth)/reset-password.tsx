import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { ShieldCheck, Lock, Check } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { signOut, updatePassword } from '../../lib/auth';
import { useAuthStore } from '../../stores/authStore';
import { notify } from '../../lib/notify';
import { Button, Card, Input } from '../../components/ui';
import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const recoveryMode = useAuthStore((s) => s.recoveryMode);
  const setRecoveryMode = useAuthStore((s) => s.setRecoveryMode);
  const [submitting, setSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { password: '', confirm: '' } });

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(Boolean(data.session));
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [recoveryMode]);

  const onSubmit = async (values: FormValues) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      notify('Datos inválidos', parsed.error.issues[0]?.message ?? 'Revisa el formulario');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(parsed.data.password);
      setRecoveryMode(false);
      await signOut();
      notify('Contraseña actualizada', 'Iniciá sesión con tu nueva contraseña.');
      router.replace('/login');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar';
      notify('No se pudo actualizar', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (checking) {
      return (
        <>
          <Text style={styles.title}>Verificando enlace…</Text>
          <Text style={styles.subtitle}>Un momento.</Text>
        </>
      );
    }

    if (!hasSession && !recoveryMode) {
      return (
        <>
          <Text style={styles.title}>Enlace inválido o expirado</Text>
          <Text style={styles.subtitle}>
            Solicitá un nuevo enlace de recuperación desde la pantalla de inicio de sesión.
          </Text>
          <View style={styles.form}>
            <Button
              onPress={() => router.replace('/forgot-password')}
              size="lg"
              fullWidth
            >
              Solicitar nuevo enlace
            </Button>
          </View>
        </>
      );
    }

    return (
      <>
        <Text style={styles.title}>Nueva contraseña</Text>
        <Text style={styles.subtitle}>Elegí una contraseña segura para tu cuenta.</Text>

        <View style={styles.form}>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Nueva contraseña"
                icon={Lock}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="password-new"
                value={value}
                onChangeText={onChange}
                error={errors.password?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirm"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Confirmar contraseña"
                icon={Lock}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="password-new"
                value={value}
                onChangeText={onChange}
                error={errors.confirm?.message}
              />
            )}
          />

          <Button
            onPress={handleSubmit(onSubmit)}
            loading={submitting}
            size="lg"
            fullWidth
            iconRight={Check}
          >
            Guardar contraseña
          </Button>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandBlock}>
            <View style={styles.logoMark}>
              <ShieldCheck size={22} color={tokens.brand.fg} strokeWidth={2.4} />
            </View>
            <Text style={styles.brandName}>Mi Agenda</Text>
            <Text style={styles.brandTagline}>Restablecer contraseña</Text>
          </View>

          <Card padding="lg" elevation="card" style={styles.formCard}>
            {renderBody()}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg.app },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  brandBlock: { alignItems: 'center', marginBottom: spacing[6] },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: palette.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
    marginBottom: spacing[3],
  },
  brandName: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold as '700',
    color: tokens.text.primary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: typography.size.sm,
    color: tokens.text.muted,
    marginTop: spacing[1],
  },
  formCard: { width: '100%' },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold as '600',
    color: tokens.text.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: tokens.text.secondary,
    marginTop: spacing[1],
  },
  form: { marginTop: spacing[5], gap: spacing[3] },
});
