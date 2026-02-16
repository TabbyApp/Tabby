import { useEffect } from 'react';
import { motion } from 'motion/react';
import { TabbyCatLogo } from './TabbyCatLogo';

interface SplashScreenProps {
  onComplete: () => void;
  /** Shown after animation when still loading (e.g. "Loading your account...") */
  loadingMessage?: string;
}

export function SplashScreen({ onComplete, loadingMessage }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="h-[calc(100vh-48px-24px)] flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100">
      <div className="relative w-full">
        {/* Logo Animation - starts center, moves to top third */}
        <motion.div
          initial={{ y: 0, scale: 1 }}
          animate={{ y: -180, scale: 0.85 }}
          transition={{ 
            delay: 0.3,
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1]
          }}
          className="flex justify-center"
        >
          <TabbyCatLogo />
        </motion.div>

        {/* Text Animations */}
        <div className="absolute top-[calc(50%+100px)] left-0 right-0">
          {/* Tabby Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              delay: 0.8,
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="text-5xl font-bold text-center text-slate-800 mb-2"
          >
            Tabby
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              delay: 1.0,
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="text-lg text-center text-slate-600"
          >
            {loadingMessage ?? 'Awkwardness Ends Here'}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
