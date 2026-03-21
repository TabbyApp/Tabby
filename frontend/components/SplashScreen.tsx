import { useEffect } from 'react';
import { motion } from 'motion/react';
import { TabbyLogo } from './TabbyLogo';

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
    <div className="h-full flex items-center justify-center bg-background">
      <div className="relative w-full z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center mb-6"
        >
          <TabbyLogo size={80} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl font-bold text-center text-foreground mb-3"
        >
          Tabby
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-base text-center text-muted-foreground font-medium"
        >
          {loadingMessage ?? 'Split bills. Track balances. Settle cleanly.'}
        </motion.p>
      </div>
    </div>
  );
}
