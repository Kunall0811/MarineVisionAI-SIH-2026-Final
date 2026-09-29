import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Radar, LoaderCircle, MailCheck } from 'lucide-react';
import { AuthApi } from '../api/services';
import { apiErrorMessage } from '../api/client';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | 'SENT' | 'LOGGED_ONLY'>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await AuthApi.register({ fullName, email, password });
      setDone(data.emailDelivery);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ocean-950">
        <div className="glass-panel rounded-xl p-8 w-full max-w-sm text-center">
          <MailCheck className="mx-auto text-cyan-400 mb-3" size={32} />
          <h2 className="text-lg font-semibold text-cyan-300 mb-2">Check your email</h2>
          <p className="text-sm text-slate-400 mb-4">
            We sent a verification link to <span className="text-slate-200">{email}</span>. Verify your
            account, then sign in.
          </p>
          {done === 'LOGGED_ONLY' && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-2 mb-4">
              SMTP is not configured on this server, so the verification link was logged server-side
              instead of emailed. Ask your administrator for the link, or configure SMTP_* env vars.
            </p>
          )}
          <Link to="/login" className="text-cyan-400 text-sm hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ocean-950">
      <form onSubmit={submit} className="glass-panel rounded-xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <Radar className="text-cyan-400" size={26} />
          <div>
            <div className="text-lg font-semibold text-cyan-300">Create Operator Account</div>
            <div className="text-xs text-slate-500">Self sign-up creates an OPERATOR role only</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
            {error}
          </div>
        )}

        <label className="text-xs text-slate-400">Full name</label>
        <input
          className="w-full mb-3 mt-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <label className="text-xs text-slate-400">Email</label>
        <input
          className="w-full mb-3 mt-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="text-xs text-slate-400">Password (min. 8 characters)</label>
        <input
          className="w-full mb-5 mt-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 transition-colors rounded py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading && <LoaderCircle size={14} className="animate-spin" />}
          Create Account
        </button>

        <p className="text-xs text-slate-500 mt-5 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan-400 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
