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

import { radius, spacing, tokens, typography } from '../../constants/theme';

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
            color={hasError ? tokens.status.urgent : focused ? tokens.brand[600] : tokens.text.muted}
            style={{ marginRight: spacing[2] }}
          />
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={tokens.text.muted}
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

const styles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium as '500',
    color: tokens.text.primary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.bg.surface,
    borderWidth: 1,
    borderColor: tokens.border.strong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    minHeight: 40,
  },
  fieldFocused: {
    borderColor: tokens.brand[500],
    shadowColor: tokens.brand[500],
    shadowOpacity: 0.15,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 2,
  },
  fieldError: {
    borderColor: tokens.status.urgent,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: typography.size.base,
    color: tokens.text.primary,
    paddingVertical: spacing[2],
  },
  hint: { fontSize: typography.size.xs, color: tokens.text.muted, marginLeft: spacing[1] },
  error: { fontSize: typography.size.xs, color: tokens.status.urgent, marginLeft: spacing[1] },
});
