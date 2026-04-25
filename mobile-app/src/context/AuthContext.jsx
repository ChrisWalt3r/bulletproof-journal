import { createClient } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  APP_DOMAIN,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from '../config/env.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

let cachedToken = null;
let cachedTokenExpiresAtMs = 0;
let sessionRequestPromise = null;

const updateCachedSession = (nextSession) => {
  cachedToken = nextSession?.access_token ?? null;
  cachedTokenExpiresAtMs = nextSession?.expires_at
    ? nextSession.expires_at * 1000
    : 0;
};

const isCachedTokenFresh = () => {
  if (!cachedToken) {
    return false;
  }

  if (!cachedTokenExpiresAtMs) {
    return true;
  }

  return Date.now() < cachedTokenExpiresAtMs - 30_000;
};

export const getAccessToken = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && isCachedTokenFresh()) {
    return cachedToken;
  }

  if (!sessionRequestPromise) {
    sessionRequestPromise = supabase.auth
      .getSession()
      .then(({ data: { session: nextSession } }) => {
        updateCachedSession(nextSession);
        return cachedToken;
      })
      .catch((error) => {
        console.error('AuthContext: failed to resolve session', error);
        updateCachedSession(null);
        return null;
      })
      .finally(() => {
        sessionRequestPromise = null;
      });
  }

  return sessionRequestPromise;
};

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const applySession = (nextSession) => {
      updateCachedSession(nextSession);
      setSession(nextSession);

      const nextUser = nextSession?.user ?? null;
      setUser((previousUser) =>
        previousUser?.id === nextUser?.id ? previousUser : nextUser
      );
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (!active) {
        return;
      }

      applySession(nextSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      applySession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { data, error };
      },
      async signUp(email, password, name) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
            emailRedirectTo: APP_DOMAIN || undefined,
          },
        });

        return { data, error };
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (!error) {
          updateCachedSession(null);
        }
        return { error };
      },
      async resetPassword(email) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: APP_DOMAIN ? `${APP_DOMAIN}/login` : undefined,
          }
        );
        return { data, error };
      },
    }),
    [loading, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
