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
import { UserPlus, User, Mail, Lock, ArrowRight } from 'lucide-react-native';

import { signUpWithPassword } from '../../lib/auth';
import { notify } from '../../lib/notify';
import { Button, Card, Input } from '../../components/ui';
import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';

const schema = z.object({
  fullName: z.string().min(2, 'Ingresá tu nombre completo'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterScreen() {
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      notify('Datos inválidos', parsed.error.issues[0]?.message ?? 'Revisa el formulario');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUpWithPassword(
        parsed.data.email,
        parsed.data.password,
        parsed.data.fullName,
      );
      if (!result.session) {
        notify(
          'Revisá tu email',
          'Te enviamos un link para confirmar la cuenta antes de iniciar sesión.',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar';
      notify('No se pudo crear la cuenta', msg);
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
              <UserPlus size={22} color={tokens.brand.fg} strokeWidth={2.4} />
            </View>
            <Text style={styles.brandName}>Crear cuenta</Text>
            <Text style={styles.brandTagline}>Unite a tu equipo de OpsBoard</Text>
          </View>

          <Card padding="lg" elevation="card" style={styles.formCard}>
            <Text style={styles.title}>Registro</Text>
            <Text style={styles.subtitle}>Completá tus datos para empezar</Text>

            <View style={styles.form}>
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Nombre completo"
                    icon={User}
                    placeholder="Tu nombre y apellido"
                    autoCapitalize="words"
                    value={value}
                    onChangeText={onChange}
                    error={errors.fullName?.message}
                  />
                )}
              />

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
                    placeholder="Mínimo 6 caracteres"
                    secureTextEntry
                    autoComplete="password-new"
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
                Crear cuenta
              </Button>
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tenés cuenta? </Text>
            <Link href="/login" style={styles.footerLink}>
              Iniciar sesión
            </Link>
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
