import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { forgetThisDevice } from './push';

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  // Mientras la sesión sigue viva: que este dispositivo deje de recibir los
  // avisos del usuario que se va (importa en equipos compartidos).
  await forgetThisDevice().catch(() => undefined);
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function getResetRedirectUrl() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/reset-password`;
    }
    return undefined;
  }
  return Linking.createURL('/reset-password');
}

export async function requestPasswordReset(email: string) {
  const redirectTo = getResetRedirectUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
