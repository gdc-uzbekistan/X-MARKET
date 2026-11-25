import { ArrowLeft, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type { AdminUser } from '../../types.ts';

export function AdminLoginPage() {
  const { navigate, setAdminSession, showToast } = useStore();
  const [requiresBootstrap, setRequiresBootstrap] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [fullName, setFullName] = useState('X-MARKET Administrator');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ initialized: boolean; requiresBootstrap: boolean }>('/api/admin/status', {
      authMode: 'none',
    })
      .then((res) => setRequiresBootstrap(res.requiresBootstrap))
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (requiresBootstrap) {
      if (password.length < 6) {
        setError('Administrator password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setLoading(true);
      try {
        const res = await apiRequest<{ token: string; admin: AdminUser }>('/api/admin/bootstrap', {
          method: 'POST',
          authMode: 'none',
          body: JSON.stringify({ fullName, password }),
        });
        setAdminSession(res.token, res.admin);
        showToast('Administrator access initialized', 'success');
        navigate('/admin');
      } catch (err: any) {
        setError(err.message || 'Bootstrap failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; admin: AdminUser }>('/api/admin/login', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ password }),
      });
      setAdminSession(res.token, res.admin);
      showToast('Administrator authenticated', 'success');
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] dark:bg-[#0B120E] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-8 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-[#14532D] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to X-MARKET Storefront</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
              {requiresBootstrap ? 'Initialize Admin Account' : 'X-MARKET Admin Portal'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {requiresBootstrap
                ? 'First-run setup: set your administrator password'
                : 'Restricted server-verified management console'}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {checkingStatus ? (
          <div className="py-10 text-center text-xs text-slate-500">Verifying security status...</div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {requiresBootstrap ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Administrator Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {requiresBootstrap ? 'Set Initial Admin Password' : 'Administrator Password'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {requiresBootstrap ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirm Administrator Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              {loading
                ? 'Authenticating...'
                : requiresBootstrap
                ? 'Claim & Enter Admin Portal'
                : 'Sign In to Admin Portal'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
