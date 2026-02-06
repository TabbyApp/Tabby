import { motion } from 'motion/react';
import { ChevronLeft, Shield, Smartphone, Mail, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface TwoFactorAuthPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
}

export function TwoFactorAuthPage({ onNavigate, theme }: TwoFactorAuthPageProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'success'>('setup');
  const [method, setMethod] = useState<'app' | 'sms' | null>(null);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [backupCodes] = useState([
    'AB12-CD34-EF56',
    'GH78-IJ90-KL12',
    'MN34-OP56-QR78',
    'ST90-UV12-WX34',
    'YZ56-AB78-CD90',
  ]);

  const isDark = theme === 'dark';

  const handleMethodSelect = (selectedMethod: 'app' | 'sms') => {
    setMethod(selectedMethod);
    setStep('verify');
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...verificationCode];
      newCode[index] = value;
      setVerificationCode(newCode);

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`code-${index + 1}`);
        nextInput?.focus();
      }

      // Auto-submit when all digits entered
      if (index === 5 && value && newCode.every(digit => digit)) {
        setTimeout(() => setStep('success'), 500);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
  };

  if (step === 'success') {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
        >
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('privacySettings')}
              className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
            >
              <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
            </button>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Two-Factor Authentication</h1>
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col items-center justify-center px-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-center w-full max-w-md"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6 shadow-xl"
            >
              <Check size={48} className="text-white" strokeWidth={3} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}
            >
              2FA Enabled!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-8`}
            >
              Your account is now more secure
            </motion.p>

            {/* Backup Codes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 mb-4`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Backup Codes</h3>
                <button 
                  onClick={copyBackupCodes}
                  className="flex items-center gap-2 text-purple-600 text-sm font-medium active:scale-95 transition-transform"
                >
                  <Copy size={16} />
                  Copy
                </button>
              </div>
              <div className="space-y-2">
                {backupCodes.map((code, index) => (
                  <div 
                    key={index}
                    className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} rounded-lg px-4 py-3 font-mono text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                  >
                    {code}
                  </div>
                ))}
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-4`}>
                Save these codes somewhere safe. You can use them to access your account if you lose your device.
              </p>
            </motion.div>

            <button
              onClick={() => onNavigate('privacySettings')}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-semibold active:scale-[0.98] transition-transform"
            >
              Done
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
        >
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setStep('setup')}
              className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
            >
              <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
            </button>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Verify Code</h1>
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col items-center justify-center px-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center w-full max-w-md"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xl">
              {method === 'app' ? (
                <Smartphone size={36} className="text-white" />
              ) : (
                <Mail size={36} className="text-white" />
              )}
            </div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-2`}>
              Enter Verification Code
            </h2>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-8`}>
              {method === 'app' 
                ? 'Open your authenticator app and enter the 6-digit code'
                : 'We sent a code to your phone ending in •••• 4567'}
            </p>

            {/* Code Input */}
            <div className="flex gap-3 justify-center mb-8">
              {verificationCode.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`w-12 h-14 text-center text-2xl font-bold rounded-xl ${
                    isDark 
                      ? 'bg-slate-800 text-white border-slate-700' 
                      : 'bg-white text-slate-800 border-slate-200'
                  } border-2 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all`}
                />
              ))}
            </div>

            <button className="text-purple-600 text-sm font-medium mb-4">
              Didn't receive a code? Resend
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('privacySettings')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Two-Factor Authentication</h1>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
            Add an extra layer of security to your account. Choose your preferred method:
          </p>

          <div className="space-y-4">
            <motion.button
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={() => handleMethodSelect('app')}
              className={`w-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-2 rounded-2xl p-5 text-left active:scale-[0.98] transition-transform`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Smartphone size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-1`}>
                    Authenticator App
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Use an app like Google Authenticator or Authy to generate verification codes
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'} flex-shrink-0`}>
                  <p className="text-xs font-semibold text-purple-600">Recommended</p>
                </div>
              </div>
            </motion.button>

            <motion.button
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              onClick={() => handleMethodSelect('sms')}
              className={`w-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-2 rounded-2xl p-5 text-left active:scale-[0.98] transition-transform`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                  <Mail size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-1`}>
                    SMS Text Message
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Receive verification codes via text message to your phone
                  </p>
                </div>
              </div>
            </motion.button>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`${isDark ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-2xl p-4 mt-6`}
          >
            <div className="flex gap-3">
              <Shield size={20} className={`${isDark ? 'text-blue-300' : 'text-blue-600'} flex-shrink-0 mt-0.5`} />
              <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                Two-factor authentication adds an extra layer of security by requiring both your password and a verification code to sign in.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}