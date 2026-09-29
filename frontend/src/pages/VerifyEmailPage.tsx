import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, LoaderCircle } from 'lucide-react';
import { AuthApi } from '../api/services';
import { apiErrorMessage } from '../api/client';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const email = params.get('email');
    const token = params.get('token');
    if (!email || !token) {
      setStatus('error');
      setMessage('Missing verification parameters.');
      return;
    }
    AuthApi.verifyEmail({ email, token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(apiErrorMessage(err));
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ocean-950">
      <div className="glass-panel rounded-xl p-8 w-full max-w-sm text-center">
        {status === 'loading' && <LoaderCircle className="mx-auto animate-spin text-cyan-400 mb-3" size={32} />}
        {status === 'success' && <CheckCircle2 className="mx-auto text-green-400 mb-3" size={32} />}
        {status === 'error' && <XCircle className="mx-auto text-red-400 mb-3" size={32} />}
        <h2 className="text-lg font-semibold text-slate-200 mb-2">
          {status === 'loading' && 'Verifying...'}
          {status === 'success' && 'Email Verified'}
          {status === 'error' && 'Verification Failed'}
        </h2>
        {message && <p className="text-sm text-slate-400 mb-4">{message}</p>}
        <Link to="/login" className="text-cyan-400 text-sm hover:underline">
          Go to login
        </Link>
      </div>
    </div>
  );
}
