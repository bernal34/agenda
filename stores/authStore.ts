import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: Status;
  session: Session | null;
  user: User | null;
  recoveryMode: boolean;
  setSession: (session: Session | null) => void;
  setRecoveryMode: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  user: null,
  recoveryMode: false,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    }),
  setRecoveryMode: (value) => set({ recoveryMode: value }),
}));
