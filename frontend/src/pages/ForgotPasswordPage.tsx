import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthApi } from '../api/services';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await AuthApi.forgotPassword(email);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ocean-950">
      <form onSubmit={submit} className="glass-panel rounded-xl p-8 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-cyan-300 mb-4">Reset your password</h2>
        {sent ? (
          <p className="text-sm text-slate-400">
            If an account exists for that email, a reset link has been sent.
          </p>
        ) : (
          <>
            <label className="text-xs text-slate-400">Email</label>
            <input
              className="w-full mb-4 mt-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="w-full bg-cyan-600 hover:bg-cyan-500 transition-colors rounded py-2 text-sm font-medium">
              Send reset link
            </button>
          </>
        )}
        <p className="text-xs text-slate-500 mt-5 text-center">
          <Link to="/login" className="text-cyan-400 hover:underline">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}
