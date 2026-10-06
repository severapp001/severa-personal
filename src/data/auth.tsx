import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { parseAuthRedirect } from '@/core/authRedirect';
import { TERMS_VERSION } from '@/core/legal';
import { supabase } from './supabase';

type SignUpInput = { name: string; birthDate: string; email: string; password: string };

type AuthState = {
  session: Session | null;
  /** La cuenta ya tiene su espacio personal (bootstrap_account). */
  ready: boolean;
  loading: boolean;
  bootstrapError: string | null;
  signUp: (input: SignUpInput) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  /** Abre la sesión con el enlace de «Confirmar» del correo. */
  completeFromUrl: (url: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Adónde vuelve el enlace del correo: severa://verificado (o exp://…/--/verificado en Expo Go).
const emailRedirectTo = () => Linking.createURL('verificado');

// Crea el espacio personal, la persona «yo» y los consentimientos con los datos
// que la persona dio al registrarse (quedan en user_metadata hasta este momento).
async function ensureAccount(session: Session): Promise<void> {
  const { data: existing, error: readError } = await supabase.from('accounts').select('id').maybeSingle();
  if (readError) throw readError;
  if (existing) return;

  const meta = session.user.user_metadata ?? {};
  const { error } = await supabase.rpc('bootstrap_account', {
    p_name: meta.full_name,
    p_birth_date: meta.birth_date,
    p_terms_version: meta.terms_version ?? TERMS_VERSION,
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Santiago',
  });
  if (error) throw error;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const onSession = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next) {
      setReady(false);
      return;
    }
    try {
      await ensureAccount(next);
      setBootstrapError(null);
      setReady(true);
    } catch (e) {
      setBootstrapError(e instanceof Error ? e.message : String(e));
      setReady(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => onSession(data.session).finally(() => setLoading(false)));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // TOKEN_REFRESHED no cambia la cuenta; evitamos volver a consultar.
      if (event === 'TOKEN_REFRESHED') {
        setSession(next);
        return;
      }
      // Fuera del callback para no bloquear el cliente de Supabase.
      setTimeout(() => onSession(next), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [onSession]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      ready,
      loading,
      bootstrapError,
      async signUp({ name, birthDate, email, password }) {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: emailRedirectTo(),
            data: { full_name: name.trim(), birth_date: birthDate, terms_version: TERMS_VERSION },
          },
        });
        if (error) throw error;
      },
      async verifyEmail(email, code) {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
        if (error) throw error;
      },
      async resendCode(email) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: emailRedirectTo() },
        });
        if (error) throw error;
      },
      async completeFromUrl(url) {
        const result = parseAuthRedirect(url);
        if (result.kind === 'session') {
          const { error } = await supabase.auth.setSession({
            access_token: result.accessToken,
            refresh_token: result.refreshToken,
          });
          if (error) throw error;
        } else if (result.kind === 'code') {
          const { error } = await supabase.auth.exchangeCodeForSession(result.code);
          if (error) throw error;
        } else if (result.kind === 'error') {
          throw Object.assign(new Error(result.description), { code: result.code });
        }
      },
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, ready, loading, bootstrapError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
}
