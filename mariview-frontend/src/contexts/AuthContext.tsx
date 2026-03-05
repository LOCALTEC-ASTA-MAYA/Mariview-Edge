import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
    id: string;
    username: string;
    email: string;
    name: string;
    roles: string[];
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isAuthenticated: false,
    loading: true,
    login: async () => { },
    logout: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // On mount, check if the user has a valid session cookie
    useEffect(() => {
        checkSession();
    }, []);

    // ── AGGRESSIVE ANTI-SLEEP TOKEN RECOVERY ──────────────────────
    // Browsers throttle/freeze JS in background tabs, killing timers.
    // We use BOTH focus + visibilitychange to catch every tab-return,
    // plus a resilient periodic heartbeat when the tab is active.
    useEffect(() => {
        let lastCheck = Date.now();
        let heartbeat: ReturnType<typeof setInterval> | null = null;

        const forceSessionCheck = () => {
            // Debounce: skip if checked within the last 2 seconds
            if (Date.now() - lastCheck < 2000) return;
            lastCheck = Date.now();
            checkSession();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                forceSessionCheck();
                startHeartbeat();
            } else {
                stopHeartbeat();
            }
        };

        const handleFocus = () => forceSessionCheck();

        const startHeartbeat = () => {
            stopHeartbeat();
            // Re-check session every 60s while tab is active
            heartbeat = setInterval(forceSessionCheck, 60_000);
        };

        const stopHeartbeat = () => {
            if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);
        startHeartbeat();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleFocus);
            stopHeartbeat();
        };
    }, []);

    const checkSession = async (isRetry = false) => {
        try {
            const resp = await fetch('/api/auth/me', {
                credentials: 'include',
            });

            if (resp.ok) {
                const data = await resp.json();
                setUser(data);
            } else if (resp.status === 401) {
                // Only clear user on CONFIRMED 401 (token truly expired/invalid)
                setUser(null);
            } else {
                // 500, 503, etc. — server issue, don't log out the user
                console.warn(`[Auth] /api/auth/me returned ${resp.status}, keeping session`);
                // Retry once after a delay (handles container startup race)
                if (!isRetry) {
                    setTimeout(() => checkSession(true), 2000);
                    return; // don't set loading=false yet
                }
            }
        } catch {
            // Network error (offline, DNS fail, etc.) — don't log out
            console.warn('[Auth] Session check failed (network), keeping session');
            if (!isRetry) {
                setTimeout(() => checkSession(true), 2000);
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    const login = useCallback(async (username: string, password: string) => {
        const resp = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || 'Login failed');
        }

        const data = await resp.json();
        setUser(data);
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch {
            // silently continue
        }
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                loading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}
