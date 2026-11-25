import { Camera, CheckCircle2, KeyRound, MapPin, Phone, ShieldAlert } from 'lucide-react';
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { apiRequest, uploadImageFile } from '../lib/api.ts';
import { REGIONS_DATA } from '../lib/regions.ts';
import type { CustomerUser } from '../types.ts';

export function SignInPage() {
  const { navigate, setCustomerSession, showToast } = useStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password recovery state
  const [resetMode, setResetMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpStatus, setOtpStatus] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: CustomerUser }>('/api/auth/login', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ phone, password }),
      });
      setCustomerSession(res.token, res.user);
      showToast(`Welcome back, ${res.user.full_name}`, 'success');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOtp = async () => {
    setError('');
    setOtpStatus('');
    try {
      const res = await apiRequest<{ sent: boolean; gatewayConfigured: boolean; message: string }>(
        '/api/auth/otp/send',
        {
          method: 'POST',
          authMode: 'none',
          body: JSON.stringify({ phone, purpose: 'reset' }),
        }
      );
      setOtpStatus(res.message);
    } catch (err: any) {
      setError(err.message || 'Could not request OTP');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ phone, otpCode, newPassword }),
      });
      showToast('Password updated. You can now sign in.', 'success');
      setResetMode(false);
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-8 shadow-sm">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          {resetMode ? 'Recover Password' : 'Sign In to X-MARKET'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {resetMode
            ? 'Verify your phone number via OTP to set a new password.'
            : 'Enter your registered phone number and password.'}
        </p>

        {error ? (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {otpStatus ? (
          <div className="mt-4 p-3 rounded-xl bg-[#EBF5EE] dark:bg-[#162C20] border border-[#C6E6D2] dark:border-[#244D36] text-xs text-[#14532D] dark:text-[#6EE7B7]">
            {otpStatus}
          </div>
        ) : null}

        {!resetMode ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#2E8B57]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#2E8B57]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setResetMode(true);
                  setError('');
                }}
                className="text-[#1F7A4D] dark:text-[#6EE7B7] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
              >
                Create Account
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Registered Phone Number
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleSendResetOtp}
                  className="px-3.5 py-2.5 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  Send OTP
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                OTP Verification Code
              </label>
              <input
                type="text"
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="6-digit OTP code"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setResetMode(false)}
                className="text-xs text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold hover:bg-[#0F3D26] cursor-pointer"
              >
                {loading ? 'Updating...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { navigate, setCustomerSession, showToast } = useStore();
  const regionNames = Object.keys(REGIONS_DATA);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [region, setRegion] = useState(regionNames[0]);
  const [district, setDistrict] = useState(REGIONS_DATA[regionNames[0]][0]);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [gatewayConfigured, setGatewayConfigured] = useState<boolean | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegionChange = (nextRegion: string) => {
    setRegion(nextRegion);
    const list = REGIONS_DATA[nextRegion] || [];
    setDistrict(list[0] || '');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const url = await uploadImageFile(file, 'register');
      setAvatarUrl(url);
      showToast('Profile picture uploaded', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }
    setLocationStatus('Requesting location permission...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationStatus(
          `Location saved (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`
        );
      },
      (err) => {
        setLocationStatus(`Permission declined: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      setError('Enter your phone number before requesting OTP');
      return;
    }
    setError('');
    try {
      const res = await apiRequest<{ sent: boolean; gatewayConfigured: boolean; message: string }>(
        '/api/auth/otp/send',
        {
          method: 'POST',
          authMode: 'none',
          body: JSON.stringify({ phone, purpose: 'register' }),
        }
      );
      setGatewayConfigured(res.gatewayConfigured);
      setOtpNotice(res.message);
    } catch (err: any) {
      setError(err.message || 'Could not send OTP');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: CustomerUser }>('/api/auth/register', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({
          fullName,
          phone,
          password,
          confirmPassword,
          region,
          district,
          avatarUrl: avatarUrl || null,
          latitude,
          longitude,
          otpCode: otpCode || undefined,
        }),
      });
      setCustomerSession(res.token, res.user);
      showToast(`Account created! Your Profile ID is #${res.user.profile_id}`, 'success');
      navigate('/profile');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-8 shadow-sm">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Create X-MARKET Account
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Every registered customer receives a unique 6-digit numeric Profile ID.
        </p>

        {error ? (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Optional Profile Picture */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#EBF5EE] dark:bg-[#162C20] border border-[#D6ECDD] dark:border-[#243B2E] overflow-hidden flex items-center justify-center shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-[#1F7A4D]" />
              )}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-medium cursor-pointer hover:bg-[#D6ECDD]">
                <span>{uploadingAvatar ? 'Uploading...' : 'Upload Profile Picture (Optional)'}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} className="hidden" />
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">PNG, JPEG, or WebP up to 2 MB.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="px-3 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Verify OTP
                </button>
              </div>
            </div>
          </div>

          {otpNotice ? (
            <div className="p-3 rounded-xl bg-[#EBF5EE] dark:bg-[#162C20] border border-[#C6E6D2] dark:border-[#244D36] text-xs text-[#14532D] dark:text-[#6EE7B7] space-y-2">
              <p>{otpNotice}</p>
              {gatewayConfigured ? (
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit SMS OTP code"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0B120E] border border-[#2E8B57] font-mono text-sm text-slate-900 dark:text-slate-100"
                />
              ) : null}
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Region
              </label>
              <select
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              >
                {regionNames.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                District
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              >
                {(REGIONS_DATA[region] || []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Permission-first Location */}
          <div className="p-3.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-[#1F7A4D]" />
              <div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Delivery Geolocation (Optional)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {locationStatus || 'Location is only accessed when you grant browser permission.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestLocation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#2E8B57] cursor-pointer"
            >
              {latitude ? <CheckCircle2 className="w-3.5 h-3.5 text-[#1F7A4D]" /> : null}
              <span>{latitude ? 'Updated' : 'Allow Location'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/signin')}
              className="text-[#1F7A4D] dark:text-[#6EE7B7] font-medium hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
