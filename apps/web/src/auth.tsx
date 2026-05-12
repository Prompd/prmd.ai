import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { ClerkProvider, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import type { ResolvedTheme } from './theme';

/**
 * Thin abstraction over Clerk so the app boots either with or without auth
 * configured. When `VITE_CLERK_PUBLISHABLE_KEY` is unset, the provider is a
 * no-op and `useAuth()` always reports a signed-out, disabled state — the
 * manual flow still works, the URL flow surfaces a clear message.
 */

export interface AuthState {
  /** True iff a Clerk publishable key is configured. */
  enabled: boolean;
  /** True iff a user is currently signed in. */
  isSignedIn: boolean;
  /** True before Clerk finishes its initial sign-in check. */
  isLoaded: boolean;
  /** Returns a session JWT for API calls, or null if unavailable. */
  getToken: () => Promise<string | null>;
}

const DISABLED: AuthState = {
  enabled: false,
  isSignedIn: false,
  isLoaded: true,
  getToken: async () => null,
};

const AuthContext = createContext<AuthState>(DISABLED);

const PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim();

// Surface and accent values mirror tokens.css so Clerk's modals/menus blend
// in with the rest of the app. Keep these in sync with tokens.css when those
// values change.
const PRMD_LIGHT = {
  colorPrimary: '#3b82f6',
  colorBackground: '#ffffff',
  colorText: '#0f1117',
  colorTextSecondary: '#5c637a',
  colorInputBackground: '#f1f3f9',
  colorInputText: '#0f1117',
  borderRadius: '6px',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const PRMD_DARK = {
  colorPrimary: '#3b82f6',
  colorBackground: '#0f172a',
  colorText: '#f1f5f9',
  colorTextSecondary: '#cbd5e1',
  colorInputBackground: '#0a0f1a',
  colorInputText: '#f1f5f9',
  borderRadius: '6px',
  fontFamily: 'Inter, system-ui, sans-serif',
};

interface AuthProviderProps {
  children: ReactNode;
  resolvedTheme: ResolvedTheme;
}

export function AuthProvider({ children, resolvedTheme }: AuthProviderProps): JSX.Element {
  if (!PUBLISHABLE_KEY) {
    return <AuthContext.Provider value={DISABLED}>{children}</AuthContext.Provider>;
  }
  const appearance =
    resolvedTheme === 'dark'
      ? { baseTheme: dark, variables: PRMD_DARK }
      : { variables: PRMD_LIGHT };
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={appearance}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

/**
 * Lives inside ClerkProvider so it can use Clerk's hooks unconditionally,
 * then exposes the result through our own context for the rest of the app.
 */
function ClerkAuthBridge({ children }: { children: ReactNode }): JSX.Element {
  const clerk = useClerkAuth();
  const value = useMemo<AuthState>(
    () => ({
      enabled: true,
      isSignedIn: clerk.isSignedIn === true,
      isLoaded: clerk.isLoaded,
      getToken: () => clerk.getToken(),
    }),
    [clerk.isSignedIn, clerk.isLoaded, clerk.getToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function isAuthEnabled(): boolean {
  return Boolean(PUBLISHABLE_KEY);
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
