import { useState } from 'react';
import { motion } from 'motion/react';
import { TabbyCatLogo } from './TabbyCatLogo';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface LoginSignupProps {
  onAuthenticate: () => void;
  onForgotPassword: () => void;
}

export function LoginSignup({ onAuthenticate, onForgotPassword }: LoginSignupProps) {
  const [authMode, setAuthMode] = useState<'email' | 'phone'>('email');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, loginWithPhone } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (authMode === 'phone') {
        if (!otpSent) {
          await api.auth.sendOtp(phone.replace(/\D/g, '').slice(-10));
          setOtpSent(true);
        } else {
          await loginWithPhone(phone.replace(/\D/g, '').slice(-10), otpCode, !isLogin ? name : undefined);
          onAuthenticate();
        }
      } else {
        if (isLogin) {
          await login(email, password);
        } else {
          await signup(email, password, name);
        }
        onAuthenticate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="h-[calc(100vh-48px-24px)] flex flex-col px-5 py-8"
    >
      {/* Logo and Title - Top Third */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex justify-center mb-4"
        >
          <TabbyCatLogo />
        </motion.div>
        
        <motion.h1
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15, delay: 0.03 }}
          className="text-4xl font-bold text-slate-800 mb-2"
        >
          Tabby
        </motion.h1>
        
        <motion.p
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15, delay: 0.06 }}
          className="text-[17px] text-slate-600"
        >
          Awkwardness Ends Here
        </motion.p>
      </div>

      {/* Form */}
      <motion.form 
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.15, delay: 0.09 }}
        onSubmit={handleSubmit} 
        className="flex-1 flex flex-col"
      >
        {error && (
          <div className="bg-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-3">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setAuthMode('email'); setError(''); setOtpSent(false); }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${authMode === 'email' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('phone'); setError(''); setOtpSent(false); }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${authMode === 'phone' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}
          >
            Phone
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {authMode === 'email' ? (
            <>
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
            </>
          ) : (
            <>
              {!isLogin && !otpSent && (
                <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3.5 text-[17px] border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Full Name"
                  />
                </div>
              )}
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3.5 text-[17px] border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Phone number"
                  required={authMode === 'phone'}
                  disabled={otpSent}
                />
              </div>
              {otpSent && (
                <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3.5 text-[17px] border-0 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {authMode === 'email' && isLogin && (
          <div className="mb-6 text-right">
            <button 
              type="button"
              onClick={onForgotPassword}
              className="text-[15px] text-blue-500 font-medium"
            >
              Forgot password?
            </button>
          </div>
        )}

        <div className="mt-auto space-y-3">
          <button
            type="submit"
            disabled={loading || (authMode === 'phone' && !phone.trim()) || (authMode === 'phone' && otpSent && otpCode.length < 4)}
            className="w-full bg-gradient-to-r from-slate-600 to-blue-500 text-white py-3.5 rounded-xl text-[17px] font-semibold shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? 'Please wait...' : authMode === 'phone' ? (otpSent ? 'Verify & Sign In' : 'Send Code') : (isLogin ? 'Log In' : 'Sign Up')}
          </button>

          <button
            type="button"
            onClick={() => {
              if (authMode === 'email') {
                setIsLogin(!isLogin);
              } else {
                setIsLogin(!isLogin);
                setOtpSent(false);
                setOtpCode('');
              }
              setError('');
            }}
            className="w-full text-[15px] text-slate-600 font-medium py-2"
          >
            {authMode === 'email'
              ? (isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In")
              : (isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In")}
          </button>
          {authMode === 'phone' && otpSent && (
            <button
              type="button"
              onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); }}
              className="w-full text-[15px] text-slate-600 font-medium py-2"
            >
              Use different number
            </button>
          )}
        </div>
      </motion.form>
    </motion.div>
  );
}
