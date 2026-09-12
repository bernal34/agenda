import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { radius, spacing, typography, type Tokens } from '../../constants/theme';
import { useTheme, useThemedStyles } from '../../lib/theme';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  icon?: LucideIcon;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, hint, error, icon: Icon, containerStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.field,
          focused && !hasError && styles.fieldFocused,
          hasError && styles.fieldError,
        ]}
      >
        {Icon && (
          <Icon
            size={16}
            color={hasError ? t.status.urgent : focused ? t.brand[600] : t.text.muted}
            style={{ marginRight: spacing[2] }}
          />
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={t.text.muted}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, rest.style]}
        />
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const makeStyles = (t: Tokens) => StyleSheet.create({
  wrap: { gap: spacing[1] },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: t.text.primary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bg.surface,
    borderWidth: 1,
    borderColor: t.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    minHeight: 40,
  },
  fieldFocused: {
    borderColor: t.brand[500],
    shadowColor: t.brand[500],
    shadowOpacity: 0.15,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 2,
  },
  fieldError: {
    borderColor: t.status.urgent,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: typography.size.base,
    color: t.text.primary,
    paddingVertical: spacing[2],
  },
  hint: { fontSize: typography.size.xs, color: t.text.muted, marginLeft: spacing[1] },
  error: { fontSize: typography.size.xs, color: t.status.urgent, marginLeft: spacing[1] },
});
