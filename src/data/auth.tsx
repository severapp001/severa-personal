import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { parseAuthRedirect } from '@/core/authRedirect';
import { TERMS_VERSION } from '@/core/legal';
import { clearOfflineData } from '@/features/web/offline';
import { supabase } from './supabase';

type SignUpInput = { name: string; birthDate: string; email: string; password: string };

type AuthState = {
  session: Session | null;
  /** La cuenta ya tiene su espacio personal (bootstrap_account). */
  ready: boolean;
  loading: boolean;
  bootstrapError: string | null;
  /** Entró con el enlace de «cambiar contraseña»: falta escribir la nueva antes de seguir. */
  recovering: boolean;
  /** Ya completó Conocerte (F30). Si no, la app lo lleva ahí antes de Personal. */
  onboarded: boolean;
  markOnboarded: () => void;
  /** Vuelve a Conocerte sin crear otra cuenta (para probar en la beta). */
  redoOnboarding: () => void;
  signUp: (input: SignUpInput) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  /**
   * Después de confirmar el correo en otra pestaña o en otro navegador (en el iPhone, el enlace
   * abre Safari y no la app del inicio), entra con la contraseña recién escrita.
   * Devuelve 'sin-datos' si la app se recargó y ya no la tiene en memoria.
   */
  enterAfterConfirm: () => Promise<'ok' | 'sin-confirmar' | 'sin-datos'>;
  resendCode: (email: string) => Promise<void>;
  /** Abre la sesión con el enlace de «Confirmar» del correo. */
  completeFromUrl: (url: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Adónde vuelven los enlaces del correo: severa://verificado y severa://nueva-clave
// (en Expo Go, exp://…/--/verificado; en la web, https://…/app/verificado, porque desde el 29-10
// la app vive en /app y la raíz es la landing; createURL no suma esa ruta base).
const appLink = (path: string) =>
  Platform.OS === 'web' ? `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/${path}` : Linking.createURL(path);
const emailRedirectTo = () => appLink('verificado');
const recoveryRedirectTo = () => appLink('nueva-clave');

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
  const [recovering, setRecovering] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  // Correo y contraseña de quien acaba de crear la cuenta, solo en memoria y hasta que entra.
  const pending = useRef<{ email: string; password: string } | null>(null);

  const onSession = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next) {
      setReady(false);
      return;
    }
    pending.current = null;
    try {
      await ensureAccount(next);
      const { data: answers } = await supabase.from('onboarding_answers').select('completed_at').maybeSingle();
      setOnboarded(!!answers?.completed_at);
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
      recovering,
      onboarded,
      markOnboarded() {
        setOnboarded(true);
      },
      redoOnboarding() {
        setOnboarded(false);
      },
      async signUp({ name, birthDate, email, password }) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: emailRedirectTo(),
            data: { full_name: name.trim(), birth_date: birthDate, terms_version: TERMS_VERSION },
          },
        });
        if (error) throw error;
        // Si el correo ya tiene cuenta, Supabase responde «ok» sin enviar nada (para no revelar
        // qué correos existen); la señal es que el usuario vuelve sin identidades.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          throw Object.assign(new Error('user already exists'), { code: 'user_already_exists' });
        }
        pending.current = { email: email.trim().toLowerCase(), password };
      },
      async verifyEmail(email, code) {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
        if (error) throw error;
      },
      async enterAfterConfirm() {
        const creds = pending.current;
        if (!creds) return 'sin-datos';
        const { error } = await supabase.auth.signInWithPassword(creds);
        if (!error) return 'ok';
        if (error.code === 'email_not_confirmed') return 'sin-confirmar';
        throw error;
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
          if (result.type === 'recovery') setRecovering(true);
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
        // Si falta confirmar, «Revisa tu correo» podrá entrar sola cuando la persona vuelva.
        if (error?.code === 'email_not_confirmed') pending.current = { email: email.trim().toLowerCase(), password };
        if (error) throw error;
      },
      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: recoveryRedirectTo(),
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecovering(false);
      },
      async signOut() {
        pending.current = null;
        clearOfflineData();
        setRecovering(false);
        await supabase.auth.signOut();
      },
    }),
    [session, ready, loading, bootstrapError, recovering, onboarded],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
}
