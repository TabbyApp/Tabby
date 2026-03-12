import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Building2, CalendarDays, CheckCircle2, Loader2, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface AccountSetupPageProps {
  theme: 'light' | 'dark';
  onComplete: () => void;
}

export function AccountSetupPage({ onComplete }: AccountSetupPageProps) {
  const { user, setUser, refreshBootstrap } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const resolvedInitialName = user?.name === 'New User' ? '' : (user?.name ?? '');
  const [step, setStep] = useState(0);
  const [name, setName] = useState(resolvedInitialName);
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [linkingBank, setLinkingBank] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(user?.name === 'New User' ? '' : (user?.name ?? ''));
    setDateOfBirth(user?.dateOfBirth ?? '');
  }, [user?.name, user?.dateOfBirth]);

  const markOnboardingCompletedLocally = () => {
    if (!user?.id || typeof window === 'undefined') return;
    window.localStorage.setItem(`tabby_onboarding_completed:${user.id}`, 'true');
  };

  const handleContinueProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }
    if (!dateOfBirth) {
      setError('Please enter your date of birth.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      setError('Please enter a valid date of birth.');
      return;
    }
    const [year] = dateOfBirth.split('-').map(Number);
    if (year < 1900 || dateOfBirth > today) {
      setError('Please enter a valid date of birth.');
      return;
    }

    setSavingProfile(true);
    setError('');
    try {
      const updated = await api.users.updateProfile({ name: trimmedName, dateOfBirth });
      setUser({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        dateOfBirth: updated.dateOfBirth ?? dateOfBirth,
        onboardingCompleted: updated.onboardingCompleted,
      });
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLinkBank = async () => {
    setLinkingBank(true);
    setError('');
    try {
      await api.users.linkBank();
      await refreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link bank account.');
    } finally {
      setLinkingBank(false);
    }
  };

  const handleFinish = async () => {
    setFinishing(true);
    setError('');
    try {
      await api.users.updateProfile({ onboardingCompleted: true });
      markOnboardingCompletedLocally();
      setUser({ onboardingCompleted: true });
      await refreshBootstrap();
      onComplete();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to finish setup.';
      if (/no valid fields to update/i.test(message)) {
        markOnboardingCompletedLocally();
        setUser({ onboardingCompleted: true });
        onComplete();
        return;
      }
      setError(message);
    } finally {
      setFinishing(false);
    }
  };

  const bankLinked = !!user?.bank_linked;

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            {[0, 1].map((index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-colors ${index <= step ? 'bg-primary' : 'bg-secondary'}`}
              />
            ))}
          </div>
          <p className="text-sm font-medium text-muted-foreground">Set up your account</p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <AnimatePresence initial={false} mode="sync">
          {step === 0 ? (
            <motion.div
              key="profile-step"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 flex-col"
            >
              <div className="mb-8">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <User size={28} className="text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground">What should we call you?</h1>
                <p className="mt-2 text-base text-muted-foreground">
                  We use this so your groups, receipts, and balances show the right name to everyone.
                </p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-foreground">Full name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-2xl border border-border bg-card px-4 py-4 text-[16px] text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-foreground">Date of birth</span>
                  <div className="relative">
                    <CalendarDays size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      min="1900-01-01"
                      max={today}
                      className="w-full rounded-2xl border border-border bg-card py-4 pl-11 pr-4 text-[16px] text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>
                </label>
              </div>

              <div className="mt-auto pt-8">
                <button
                  onClick={handleContinueProfile}
                  disabled={savingProfile}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[17px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {savingProfile ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                  {savingProfile ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="bank-step"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 flex-col"
            >
              <div className="mb-8">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <ShieldCheck size={28} className="text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground">Connect your bank</h1>
                <p className="mt-2 text-base text-muted-foreground">
                  You can do this now or later. You'll need a linked bank account before you can join a group or pay with one in Tabby.
                </p>
              </div>

              <div className="rounded-[28px] border border-border bg-card p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                    <Building2 size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Why we ask for this</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Linking your bank lets Tabby charge your share, create virtual group cards, and keep payment sessions ready when a group settles up.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
                  Your bank details are only used for payments and account verification, and you can always come back to link it from Account.
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Bank status</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {bankLinked ? 'Your bank account is connected.' : 'You can skip this for now, but linking is required before joining a group.'}
                    </p>
                  </div>
                  {bankLinked ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
                      <CheckCircle2 size={20} className="text-success" />
                    </div>
                  ) : null}
                </div>

                {!bankLinked && (
                  <button
                    onClick={handleLinkBank}
                    disabled={linkingBank}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[17px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
                  >
                    {linkingBank ? <Loader2 size={20} className="animate-spin" /> : <Building2 size={20} />}
                    {linkingBank ? 'Connecting...' : 'Connect Bank'}
                  </button>
                )}
              </div>

              <div className="mt-auto flex gap-3 pt-8">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 rounded-2xl border border-border bg-card py-4 text-[17px] font-semibold text-foreground transition-transform active:scale-[0.98]"
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={finishing}
                  className="flex flex-[1.35] items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[17px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {finishing ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                  {finishing ? 'Finishing...' : 'Continue to Tabby'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
