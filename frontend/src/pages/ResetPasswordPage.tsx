import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthApi } from '../api/services';
import { apiErrorMessage } from '../api/client';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = params.get('email');
    const token = params.get('token');
    if (!email || !token) {
      setError('Missing reset parameters.');
      return;
    }
    try {
      await AuthApi.resetPassword({ email, token, newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ocean-950">
      <form onSubmit={submit} className="glass-panel rounded-xl p-8 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-cyan-300 mb-4">Set a new password</h2>
        {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">{error}</div>}
        {done ? (
          <p className="text-sm text-green-400">Password updated. Redirecting to login...</p>
        ) : (
          <>
            <label className="text-xs text-slate-400">New password</label>
            <input
              className="w-full mb-4 mt-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
              type="password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button className="w-full bg-cyan-600 hover:bg-cyan-500 transition-colors rounded py-2 text-sm font-medium">
              Update password
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
