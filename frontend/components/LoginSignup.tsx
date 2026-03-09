import { useState } from 'react';
import { motion } from 'motion/react';
import { TabbyWordmark } from './TabbyLogo';
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
      className="min-h-screen flex flex-col bg-background px-6 py-12"
    >
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center mb-6"
        >
          <TabbyWordmark />
        </motion.div>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-[15px] text-muted-foreground font-medium"
        >
          Split bills. Track balances. Settle cleanly.
        </motion.p>
      </div>

      <motion.form
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col max-w-md mx-auto w-full"
      >
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl mb-3 border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setAuthMode('email'); setError(''); setOtpSent(false); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${authMode === 'email' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('phone'); setError(''); setOtpSent(false); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${authMode === 'phone' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            Phone
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {authMode === 'email' ? (
            <>
              {!isLogin && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-xl text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Full Name"
                  required
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-card border border-border rounded-xl text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Email"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-card border border-border rounded-xl text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Password"
                required
              />
            </>
          ) : (
            <>
              {!isLogin && !otpSent && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-xl text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Full Name"
                />
              )}
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3.5 bg-card border border-border rounded-xl text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                placeholder="Phone number"
                required={authMode === 'phone'}
                disabled={otpSent}
              />
              {otpSent && (
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-xl text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
              )}
            </>
          )}
        </div>

        {authMode === 'email' && isLogin && (
          <div className="mb-6 text-right">
            <button type="button" onClick={onForgotPassword} className="text-[15px] text-primary font-medium">
              Forgot password?
            </button>
          </div>
        )}

        <div className="mt-auto space-y-3">
          <button
            type="submit"
            disabled={loading || (authMode === 'phone' && !phone.trim()) || (authMode === 'phone' && otpSent && otpCode.length < 4)}
            className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl text-[17px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
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
            className="w-full text-[15px] text-muted-foreground font-medium py-2"
          >
            {authMode === 'email'
              ? (isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In")
              : (isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In")}
          </button>
          {authMode === 'phone' && otpSent && (
            <button
              type="button"
              onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); }}
              className="w-full text-[15px] text-muted-foreground font-medium py-2"
            >
              Use different number
            </button>
          )}
        </div>
      </motion.form>
    </motion.div>
  );
}
