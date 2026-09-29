import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { AuthApi } from '../api/services';
import { apiErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth.store';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Frontend validation
    if (!email || !password) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      const data = await AuthApi.login({ email, password });
      setSession(data.accessToken, data.refreshToken, data.user);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ocean-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-ocean-900 via-ocean-950 to-black" />
      <form onSubmit={submit} className="relative glass-panel rounded-xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <img src="/logo.svg" alt="MarineVision AI" className="w-9 h-9 shrink-0" />
          <div>
            <div className="text-lg font-semibold text-cyan-300">MarineVision AI</div>
            <div className="text-xs text-slate-500">SIH26057 Marine Command Console</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
            {error}
          </div>
        )}

        <label className="text-xs text-slate-400">Email</label>
        <input
          className="w-full mb-3 mt-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="text-xs text-slate-400">Password</label>
        <input
          className="w-full mb-1 mt-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-right mb-4">
          <Link to="/forgot-password" className="text-xs text-cyan-400 hover:underline">
            Forgot password?
          </Link>
        </div>

        <button
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 transition-colors rounded py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading && <LoaderCircle size={14} className="animate-spin" />}
          Sign In
        </button>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              setEmail('admin@marinevision.ai');
              setPassword('Admin@12345');
            }}
            className="flex-1 bg-white/5 hover:bg-white/10 text-xs text-slate-300 py-1.5 rounded transition-colors border border-white/5"
          >
            Demo Admin
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail('operator@marinevision.ai');
              setPassword('Operator@12345');
            }}
            className="flex-1 bg-white/5 hover:bg-white/10 text-xs text-slate-300 py-1.5 rounded transition-colors border border-white/5"
          >
            Demo Operator
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-5 text-center">
          New operator?{' '}
          <Link to="/register" className="text-cyan-400 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
