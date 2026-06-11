import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { LogIn, Mail, Lock, ArrowRight } from 'lucide-react-native';

import { signInWithPassword } from '../../lib/auth';
import { notify } from '../../lib/notify';
import { Button, Card, Input } from '../../components/ui';
import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      notify('Datos inválidos', parsed.error.issues[0]?.message ?? 'Revisa el formulario');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithPassword(parsed.data.email, parsed.data.password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      notify('No se pudo iniciar sesión', msg);
    } finally {
      setSubmitting(false);
    }
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
              <LogIn size={22} color={tokens.brand.fg} strokeWidth={2.4} />
            </View>
            <Text style={styles.brandName}>Mi Agenda</Text>
            <Text style={styles.brandTagline}>Operaciones internas · Grupo Prelar</Text>
          </View>

          <Card padding="lg" elevation="card" style={styles.formCard}>
            <Text style={styles.title}>Iniciar sesión</Text>
            <Text style={styles.subtitle}>Accedé con tu cuenta corporativa</Text>

            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Correo electrónico"
                    icon={Mail}
                    placeholder="nombre@grupoprelar.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Contraseña"
                    icon={Lock}
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="password"
                    value={value}
                    onChangeText={onChange}
                    error={errors.password?.message}
                  />
                )}
              />

              <Button
                onPress={handleSubmit(onSubmit)}
                loading={submitting}
                size="lg"
                fullWidth
                iconRight={ArrowRight}
              >
                Entrar
              </Button>

              <View style={styles.forgotRow}>
                <Link href="/forgot-password" style={styles.footerLink}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </View>
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Tu cuenta la crea un administrador.
            </Text>
          </View>
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

  brandBlock: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
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

  formCard: {
    width: '100%',
  },
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
  form: {
    marginTop: spacing[5],
    gap: spacing[3],
  },

  forgotRow: {
    alignItems: 'center',
    marginTop: spacing[1],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[5],
  },
  footerText: { color: tokens.text.secondary, fontSize: typography.size.sm },
  footerLink: {
    color: tokens.brand[600],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
  },
});
