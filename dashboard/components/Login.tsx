
import React, { useState } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

interface LoginProps {
    onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('admin@system.com');
    const [password, setPassword] = useState('password');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. Perform actual Firebase Authentication
            // This satisfies the "if request.auth != null" rule
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            const firebaseUser = userCredential.user;

            // 2. Fetch profile from Firestore by UID
            // Direct document access is allowed by your rule: match /users/{userId}
            const profile = await dataService.getUserProfile(firebaseUser.uid);

            if (!profile) {
                setError('Auth successful, but no Firestore profile found. Contact Admin.');
                setLoading(false);
                return;
            }

            // Normalize role to ensure proper case (Admin, KPO, Booker, Salesman)
            let normalizedRole: User['role'] = profile.role;
            if (typeof profile.role === 'string') {
                const roleLower = profile.role.toLowerCase();
                // Map to correct role values
                if (roleLower === 'booker') {
                    normalizedRole = 'Booker';
                } else if (roleLower === 'salesman') {
                    normalizedRole = 'Salesman';
                } else if (roleLower === 'kpo') {
                    normalizedRole = 'KPO';
                } else if (roleLower === 'admin') {
                    normalizedRole = 'Admin';
                } else {
                    // Fallback to capitalized version
                    normalizedRole = (profile.role.charAt(0).toUpperCase() + profile.role.slice(1).toLowerCase()) as User['role'];
                }
            }

            const normalizedProfile = {
                ...profile,
                role: normalizedRole
            };

            console.log('Login - Raw role from DB:', profile.role, 'Type:', typeof profile.role);
            console.log('Login - Normalized role:', normalizedRole);
            console.log('Login - Full profile:', normalizedProfile);
            console.log('Login - Branch field:', profile.branch, 'Region field:', profile.region);
            
            if (normalizedRole === 'KPO' && !profile.branch) {
                console.warn('WARNING: KPO user has no branch assigned! Dashboard stats will not work.');
            }
            
            onLogin(normalizedProfile);
            await dataService.logActivity(profile.id, 'Logged into the system via secure auth');
        } catch (err: any) {
            console.error("Login Error:", err);
            
            // Map Firebase Auth errors to user-friendly messages
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Invalid email or security key.');
            } else if (err.code === 'auth/network-request-failed') {
                setError('Network error. Check your internet connection.');
            } else if (err.message?.includes("Permission denied")) {
                setError('Security Rules Mismatch: Ensure your Project ID in code matches the Firebase Console.');
            } else {
                setError(`Login failed: ${err.message || 'Unknown Error'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background-light p-4">
            <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-10 shadow-2xl border border-slate-100">
                <div className="text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 rotate-3 transition-transform hover:rotate-0">
                        <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
                    </div>
                    <h2 className="text-4xl font-black tracking-tight text-slate-900">Sign In</h2>
                    <p className="mt-2 text-slate-500 font-medium">Distribution Management Portal</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Login Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-2xl border-0 bg-slate-50 py-4 px-6 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-primary transition-all"
                                placeholder="admin@system.com"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Security Key</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-2xl border-0 bg-slate-50 py-4 px-6 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-primary transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-2xl bg-red-50 p-4 border border-red-100 flex items-start gap-3">
                            <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">warning</span>
                            <div className="flex flex-col gap-1">
                                <p className="text-xs font-bold text-red-800">Authentication Failed</p>
                                <p className="text-[10px] text-red-600 leading-normal">{error}</p>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative flex w-full justify-center rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white hover:bg-black focus-visible:outline-primary transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50"
                    >
                        {loading ? 'Authenticating...' : 'Secure Access'}
                    </button>

                    <div className="text-center pt-4">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                            Authorized Personnel Only<br/>
                            <span className="opacity-50 font-medium lowercase">Session encrypted via Firebase SSL</span>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
