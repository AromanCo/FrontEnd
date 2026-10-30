'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiError, auth, setCsrf, renewCsrf, type User } from '@/lib/api/client';
import type { ReleaseScope } from '@/lib/release-scope';

type AuthState = {
  authEnabled: boolean;
  publicShowcase: boolean;
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children, scope }: { children: React.ReactNode; scope: ReleaseScope }) {
  const authEnabled = scope === 'full';
  const publicShowcase = scope === 'public-showcase';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(authEnabled);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const retryingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!authEnabled) { setUser(null); setError(''); setLoading(false); return; }
    try {
      await auth.session();
      await renewCsrf();
      setUser(await auth.me());
      setError('');
      setLoading(false);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setUser(null);
        setCsrf(null);
        setError('');
        setLoading(false);
        throw cause;
      }
      setError(cause instanceof ApiError ? cause.message : 'بررسی نشست انجام نشد. دوباره تلاش کنید.');
      throw cause;
    }
  }, [authEnabled]);

  useEffect(() => {
    if (!authEnabled) return;
    const timer = setTimeout(() => { void refresh().catch(() => {}); }, 0);
    return () => clearTimeout(timer);
  }, [refresh, authEnabled]);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      setCsrf(null);
      setError('');
      setLoading(false);
    };
    window.addEventListener('aroman:session-expired', expired);
    return () => window.removeEventListener('aroman:session-expired', expired);
  }, []);

  const retry = async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    try { await refresh(); } catch { /* Keep the visible error available for another retry. */ }
    finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  };

  const logout = async () => {
    if (!authEnabled) return;
    try { await auth.logout(); }
    catch (cause) { if (!(cause instanceof ApiError && cause.status === 401)) throw cause; }
    setUser(null);
    setCsrf(null);
    setError('');
    setLoading(false);
  };

  return <Context.Provider value={{ authEnabled, publicShowcase, user, loading, error, refresh, logout }}>
    {error && <div role="alert" className="container my-4 rounded-xl bg-blush p-4">
      <p>وضعیت نشست مشخص نشد. {error}</p>
      <button type="button" className="mt-2 underline disabled:opacity-50" disabled={retrying} onClick={() => void retry()}>
        {retrying ? 'در حال تلاش…' : 'تلاش دوباره برای بررسی نشست'}
      </button>
    </div>}
    {children}
  </Context.Provider>;
}

export function useAuth() {
  const state = useContext(Context);
  if (!state) throw new Error('AuthProvider is missing');
  return state;
}
