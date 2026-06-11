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
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { KeyRound, Mail, ArrowRight, ArrowLeft } from 'lucide-react-native';

import { requestPasswordReset } from '../../lib/auth';
import { notify } from '../../lib/notify';
import { Button, Card, Input } from '../../components/ui';
import { palette, radius, shadow, spacing, tokens, typography } from '../../constants/theme';

const schema = z.object({
  email: z.string().email('Email inválido'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { email: '' } });

  const onSubmit = async (values: FormValues) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      notify('Datos inválidos', parsed.error.issues[0]?.message ?? 'Revisa el formulario');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(parsed.data.email);
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar el correo';
      notify('No se pudo enviar', msg);
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
              <KeyRound size={22} color={tokens.brand.fg} strokeWidth={2.4} />
            </View>
            <Text style={styles.brandName}>Mi Agenda</Text>
            <Text style={styles.brandTagline}>Recuperar acceso</Text>
          </View>

          <Card padding="lg" elevation="card" style={styles.formCard}>
            {sent ? (
              <>
                <Text style={styles.title}>Revisá tu correo</Text>
                <Text style={styles.subtitle}>
                  Si la cuenta existe, vas a recibir un enlace para restablecer tu contraseña.
                  El link expira en 1 hora.
                </Text>
                <View style={styles.form}>
                  <Button
                    onPress={() => router.replace('/login')}
                    size="lg"
                    fullWidth
                    icon={ArrowLeft}
                    variant="secondary"
                  >
                    Volver al login
                  </Button>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
                <Text style={styles.subtitle}>
                  Ingresá tu correo y te enviamos un enlace para crear una nueva.
                </Text>

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

                  <Button
                    onPress={handleSubmit(onSubmit)}
                    loading={submitting}
                    size="lg"
                    fullWidth
                    iconRight={ArrowRight}
                  >
                    Enviar enlace
                  </Button>
                </View>
              </>
            )}
          </Card>

          <View style={styles.footer}>
            <Link href="/login" style={styles.footerLink}>
              Volver al inicio de sesión
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
  footerLink: {
    color: tokens.brand[600],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as '600',
  },
});
