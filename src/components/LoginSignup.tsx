import { useState } from 'react';
import { motion } from 'motion/react';
import { TabbyCatLogo } from './TabbyCatLogo';
import { useAuth } from '../contexts/AuthContext';

interface LoginSignupProps {
  onAuthenticate?: () => void;
  onForgotPassword: () => void;
}

export function LoginSignup({ onAuthenticate, onForgotPassword }: LoginSignupProps) {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        if (!name.trim()) {
          setError('Name is required');
          return;
        }
        await signup(email.trim(), password, name.trim());
      }
      onAuthenticate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
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
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <TabbyCatLogo />
        </motion.div>
        
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl font-bold text-slate-800 mb-2"
        >
          Tabby
        </motion.h1>
        
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-[17px] text-slate-600"
        >
          Awkwardness Ends Here
        </motion.p>
      </div>

      {/* Form */}
      <motion.form 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        onSubmit={handleSubmit} 
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
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}

        {isLogin && (
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
            disabled={submitting}
            className="w-full bg-gradient-to-r from-slate-600 to-blue-500 text-white py-3.5 rounded-xl text-[17px] font-semibold shadow-lg active:scale-[0.98] transition-transform disabled:opacity-70"
          >
            {submitting ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
          </button>

          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-[15px] text-slate-600 font-medium py-2"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}