import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { CardLogin } from './ui/card';
import Logo from './Logo';
import { Shield, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            // Update browser URL from /login to / since the app uses
            // conditional rendering (not React Router) for auth gating
            if (window.location.pathname === '/login') {
                window.history.replaceState(null, '', '/');
            }
        } catch (err: any) {
            setError(err.message || 'Invalid credentials. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="dark min-h-screen flex flex-col items-center justify-center bg-background text-slate-200">
            <div className="w-full max-w-md mx-4">

                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <Logo size="lg" />
                </div>

                {/* Login Card dengan efek premium glassmorphism & tactical shadow */}
                <CardLogin className="p-8 bg-card/95 backdrop-blur-xl !border-0 shadow-[0_0_40px_rgba(33,166,141,0.12)] rounded-2xl">

                    {/* Subtitle */}
                    <p className="text-[#21A68D] text-xs font-mono tracking-widest uppercase text-center mb-6">
                        Tactical Command Center
                    </p>

                    {/* Security Badge */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <Shield className="w-4 h-4 text-[#21A68D]" />
                        <span className="text-[#21A68D] text-[10px] font-mono font-bold tracking-widest uppercase">
                            Secure Access Required
                        </span>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-destructive/10 border border-destructive/30">
                            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Form - Diberi jarak space-y-6 agar lebih lega */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                                Username
                            </Label>
                            <Input
                                id="login-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="bg-background/60 border-border focus-visible:ring-[#21A68D] focus-visible:border-[#21A68D] h-12 transition-all"
                                required
                                autoComplete="username"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                                Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="bg-background/60 border-border focus-visible:ring-[#21A68D] focus-visible:border-[#21A68D] h-12 pr-12 pl-4 transition-all"
                                    required
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                                    className="text-muted-foreground hover:text-[#21A68D] transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            id="login-submit"
                            type="submit"
                            disabled={isLoading || !username || !password}
                            /* h-12 menyamakan tinggi tombol dengan input */
                            className="w-full bg-[#21A68D] hover:bg-[#1a8a72] text-white font-bold tracking-widest uppercase h-12 mt-4 transition-all shadow-lg shadow-[#21A68D]/20 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    AUTHENTICATING...
                                </span>
                            ) : (
                                'ACCESS'
                            )}
                        </Button>
                    </form>

                    {/* Footer inside card */}
                    <div className="mt-8 pt-5 border-t border-border/50">
                        <p className="text-muted-foreground text-[9px] font-semibold text-center uppercase tracking-widest">
                            Authorized Personnel Only • All Access Monitored
                        </p>
                    </div>
                </CardLogin>

                {/* Footer outside card */}
                <p className="text-muted-foreground text-[10px] text-center mt-8 uppercase tracking-widest font-mono">
                    Chimp Platform : Mariview v1.0
                </p>
            </div>
        </div>
    );
}