import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { TabbyCatLogo } from './TabbyCatLogo';

const MIN_SPLASH_MS = 400;
const MAX_SPLASH_MS = 1000;

interface SplashScreenProps {
  onComplete: () => void;
  /** When true, allow finishing as soon as MIN_SPLASH_MS has passed (e.g. auth ready) */
  ready?: boolean;
}

export function SplashScreen({ onComplete, ready = false }: SplashScreenProps) {
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    const start = startRef.current;

    const id = setInterval(() => {
      if (doneRef.current) return;
      const elapsed = Date.now() - start;
      const minReached = elapsed >= MIN_SPLASH_MS;
      const maxReached = elapsed >= MAX_SPLASH_MS;
      if ((ready && minReached) || maxReached) {
        doneRef.current = true;
        clearInterval(id);
        onComplete();
      }
    }, 80);

    return () => clearInterval(id);
  }, [onComplete, ready]);

  return (
    <div className="h-[calc(100vh-48px-24px)] flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100">
      <div className="relative w-full">
        {/* Logo Animation - starts center, moves to top third */}
        <motion.div
          initial={{ y: 0, scale: 1 }}
          animate={{ y: -180, scale: 0.85 }}
          transition={{ delay: 0.05, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
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
            transition={{ delay: 0.2, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="text-5xl font-bold text-center text-slate-800 mb-2"
          >
            Tabby
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="text-lg text-center text-slate-600"
          >
            Awkwardness Ends Here
          </motion.p>
        </div>
      </div>
    </div>
  );
}
