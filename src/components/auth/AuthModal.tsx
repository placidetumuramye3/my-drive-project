import React, { useState } from 'react';
import { 
  X, 
  KeyRound, 
  Mail, 
  Lock, 
  User as UserIcon, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { login, register, requestPasswordReset, resetPassword, switchUser, users } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset-confirm'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    if (mode === 'login') {
      const res = await login(email, password);
      setIsLoading(false);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Failed to login');
      }
    } else if (mode === 'register') {
      if (password !== confirmPassword) {
        setIsLoading(false);
        setError('Passwords do not match.');
        return;
      }
      const res = await register(name, email, password);
      setIsLoading(false);
      if (res.success) {
        setSuccessMsg('Account registered successfully! Welcome to Storage Drive.');
        setTimeout(() => onClose(), 1200);
      } else {
        setError(res.error || 'Registration failed.');
      }
    } else if (mode === 'forgot') {
      const res = await requestPasswordReset(email);
      setIsLoading(false);
      if (res.success) {
        setGeneratedCode(res.code || '123456');
        setResetCode(res.code || '');
        setSuccessMsg(`Verification code dispatched to ${email}. (Demo Code: ${res.code})`);
        setMode('reset-confirm');
      } else {
        setError(res.error || 'Password reset request failed.');
      }
    } else if (mode === 'reset-confirm') {
      if (password !== confirmPassword) {
        setIsLoading(false);
        setError('Passwords do not match.');
        return;
      }
      const res = await resetPassword(email, resetCode, password);
      setIsLoading(false);
      if (res.success) {
        setSuccessMsg('Password updated successfully! You can now log in with your new credentials.');
        setTimeout(() => setMode('login'), 2000);
      } else {
        setError(res.error || 'Password reset failed.');
      }
    }
  };

  const handleQuickLogin = (userId: string) => {
    switchUser(userId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {mode === 'login' && 'Sign in to Storage Drive'}
                {mode === 'register' && 'Create your account'}
                {mode === 'forgot' && 'Reset your password'}
                {mode === 'reset-confirm' && 'Enter Verification Code'}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'login' && 'Access your files and shared folders'}
                {mode === 'register' && 'Get 2 GB free cloud storage today'}
                {mode === 'forgot' && 'We will send you a verification code'}
                {mode === 'reset-confirm' && 'Create a new secure password'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Marie Curie"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {mode === 'reset-confirm' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Enter code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
                {generatedCode && (
                  <p className="text-[11px] text-blue-600 mt-1 font-mono">
                    Demo Code auto-filled: {generatedCode}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
          >
            <span>
              {mode === 'login' && (isLoading ? 'Signing in...' : 'Sign In')}
              {mode === 'register' && (isLoading ? 'Creating account...' : 'Create Account')}
              {mode === 'forgot' && (isLoading ? 'Sending code...' : 'Send Recovery Code')}
              {mode === 'reset-confirm' && (isLoading ? 'Updating...' : 'Set New Password')}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Toggle between Login and Register */}
          <div className="text-center pt-2 text-xs text-slate-500">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  Register now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </form>

        {/* 1-Click Demo Accounts Quick Picker */}
        <div className="bg-slate-50 p-4 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>1-Click Test Accounts</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {users.slice(0, 3).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleQuickLogin(u.id)}
                className="p-2 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-all cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ backgroundColor: u.avatarColor || '#3b82f6' }}
                  >
                    {u.name[0]}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800 truncate">
                    {u.name.split(' ')[0]}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block truncate">
                  {u.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
