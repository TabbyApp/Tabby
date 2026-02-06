import { useState } from 'react';
import { motion } from 'motion/react';
import { TabbyCatLogo } from './TabbyCatLogo';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface LoginSignupProps {
  onAuthenticate: () => void;
}

export function LoginSignup({ onAuthenticate }: LoginSignupProps) {
  const [authMode, setAuthMode] = useState<'email' | 'phone'>('email');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Phone / OTP flow
  const [phoneStep, setPhoneStep] = useState<'enter_phone' | 'enter_code'>('enter_phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneName, setPhoneName] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const { login, signup, loginWithPhone } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
      onAuthenticate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setError('');
    setLoading(true);
    try {
      await api.auth.sendOtp(phone.trim());
      setOtpSent(true);
      setPhoneStep('enter_code');
      setOtpCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setError('');
    setLoading(true);
    try {
      await loginWithPhone(phone.trim(), otpCode.trim(), phoneName.trim() || undefined);
      onAuthenticate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      setError(msg);
      if (msg.toLowerCase().includes('name')) setPhoneName('');
    } finally {
      setLoading(false);
    }
  };

  const switchToPhone = () => {
    setAuthMode('phone');
    setPhoneStep('enter_phone');
    setPhone('');
    setOtpCode('');
    setPhoneName('');
    setOtpSent(false);
    setError('');
  };

  const switchToEmail = () => {
    setAuthMode('email');
    setError('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-[calc(100vh-48px-24px)] flex flex-col px-5 py-8"
    >
      <div className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <TabbyCatLogo />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Tabby</h1>
        <p className="text-slate-600 text-sm">Awkwardness Ends Here</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-200 p-1 mb-5">
        <button
          type="button"
          onClick={switchToEmail}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            authMode === 'email' ? 'bg-white text-slate-800 shadow' : 'text-slate-600'
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={switchToPhone}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            authMode === 'phone' ? 'bg-white text-slate-800 shadow' : 'text-slate-600'
          }`}
        >
          Phone
        </button>
      </div>

      {authMode === 'email' && (
        <motion.form
          key="email"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onSubmit={handleEmailSubmit}
          className="flex-1 flex flex-col"
        >
          <div className="space-y-3 mb-4">
            {!isLogin && (
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3.5 text-[17px] border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Full Name"
                  required
                />
              </div>
            )}
            <div className="bg-white rounded-xl overflow-hidden shadow-sm">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 text-[17px] border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Email"
                required
              />
            </div>
            <div className="bg-white rounded-xl overflow-hidden shadow-sm">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 text-[17px] border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Password"
                required
              />
            </div>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          <div className="mt-auto space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-slate-600 to-blue-500 text-white py-3.5 rounded-xl text-[17px] font-semibold shadow-lg active:scale-[0.98] transition-transform disabled:opacity-70"
            >
              {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-[15px] text-slate-600 font-medium py-2"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
            </button>
          </div>
        </motion.form>
      )}

      {authMode === 'phone' && (
        <motion.div
          key="phone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex flex-col"
        >
          {phoneStep === 'enter_phone' && (
            <form onSubmit={handleSendOtp} className="flex flex-col flex-1">
              <div className="mb-4">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (e.g. 5551234567)"
                  className="w-full px-4 py-3.5 rounded-xl text-[17px] bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoComplete="tel"
                />
                <p className="text-xs text-slate-500 mt-2">We’ll send a 6-digit code to this number.</p>
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              <div className="mt-auto">
                <button
                  type="submit"
                  disabled={loading || !phone.trim()}
                  className="w-full bg-gradient-to-r from-slate-600 to-blue-500 text-white py-3.5 rounded-xl text-[17px] font-semibold shadow-lg active:scale-[0.98] disabled:opacity-70"
                >
                  {loading ? 'Sending...' : 'Send code'}
                </button>
              </div>
            </form>
          )}

          {phoneStep === 'enter_code' && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col flex-1">
              <p className="text-slate-600 text-sm mb-3">
                Code sent to <strong>{phone}</strong>
                <button
                  type="button"
                  onClick={() => { setPhoneStep('enter_phone'); setError(''); }}
                  className="ml-2 text-blue-500"
                >
                  Change
                </button>
              </p>
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="w-full px-4 py-3.5 rounded-xl text-[17px] bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-center tracking-widest"
                />
                <input
                  type="text"
                  value={phoneName}
                  onChange={(e) => setPhoneName(e.target.value)}
                  placeholder="Your name (required for new accounts)"
                  className="w-full px-4 py-3.5 rounded-xl text-[17px] bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              <div className="mt-auto space-y-2">
                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full bg-gradient-to-r from-slate-600 to-blue-500 text-white py-3.5 rounded-xl text-[17px] font-semibold shadow-lg active:scale-[0.98] disabled:opacity-70"
                >
                  {loading ? 'Verifying...' : 'Verify & sign in'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendOtp({ preventDefault: () => {} } as React.FormEvent)}
                  disabled={loading}
                  className="w-full text-[15px] text-slate-600"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
