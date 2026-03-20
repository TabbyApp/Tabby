import { ChevronLeft, User, Mail, Phone, CreditCard, MapPin, Building2, Edit2, Check, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PageType } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { api, assetUrl } from '../lib/api';

interface AccountPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  notice?: string | null;
}

export function AccountPage({ onNavigate, theme, notice }: AccountPageProps) {
  const { user, setUser, refreshBootstrap } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [tempName, setTempName] = useState(user?.name ?? '');
  const phone = user?.phone ?? '';
  const [tempPhone, setTempPhone] = useState(user?.phone ?? '');
  const bankLinked = !!user?.bank_linked;
  const paymentMethods = user?.paymentMethods ?? [];
  const [linkingBank, setLinkingBank] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarUrl = (user as { avatarUrl?: string | null })?.avatarUrl ?? null;

  useEffect(() => {
    if (user) {
      setName(user.name);
      setTempName(user.name);
      setTempPhone(user.phone ?? '');
    }
  }, [user]);

  const handleSaveName = () => {
    const newName = tempName.trim();
    if (!newName) return;
    setName(newName);
    setIsEditingName(false);
    api.users.updateProfile({ name: newName })
      .then((updated) => {
        setUser({ id: updated.id, email: updated.email, name: updated.name });
      })
      .catch(() => {});
  };

  const handleSavePhone = () => {
    const newPhone = tempPhone.trim();
    setPhone(newPhone);
    setIsEditingPhone(false);
    api.users.updateProfile({ phone: newPhone }).catch(() => {});
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !/^image\//.test(file.type)) return;
    setUploadingAvatar(true);
    try {
      const { avatarUrl: url } = await api.users.uploadAvatar(file);
      setUser({ ...user!, avatarUrl: url });
      await refreshBootstrap();
    } catch (err) {
      console.error('Avatar upload failed:', err);
      const msg = err instanceof Error ? err.message : 'Upload failed';
      const debug = err && typeof err === 'object' && 'debug' in err ? (err as { debug?: string }).debug : '';
      alert(debug ? `${msg}\n\nDebug:\n${debug}` : msg);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleLinkBank = async () => {
    setLinkingBank(true);
    try {
      await api.users.linkBank();
      await refreshBootstrap();
    } catch {} finally {
      setLinkingBank(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-background overflow-hidden">
      <div className="bg-card border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Account</h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 pb-6">
        {notice && (
          <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {notice}
          </div>
        )}

        <div className="flex flex-col items-center mb-8">
          <label className="relative cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
            <div className="w-24 h-24 rounded-full overflow-hidden bg-primary flex items-center justify-center text-primary-foreground shadow-xl mb-4 ring-2 ring-border">
              {avatarUrl ? (
                <img src={assetUrl(avatarUrl)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={40} strokeWidth={2.5} />
              )}
            </div>
            <span className="text-primary font-medium text-sm active:scale-95 transition-transform block text-center">
              {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
            </span>
          </label>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Personal Information</h2>
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={20} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                  {isEditingName ? (
                    <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)}
                      className="font-semibold text-foreground bg-input-background border border-border px-2 py-1 rounded w-full" autoFocus
                    />
                  ) : (
                    <p className="font-semibold text-foreground">{name}</p>
                  )}
                </div>
                {isEditingName ? (
                  <button onClick={handleSaveName} className="text-primary"><Check size={20} /></button>
                ) : (
                  <button onClick={() => { setIsEditingName(true); setTempName(name); }} className="text-primary"><Edit2 size={18} /></button>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail size={20} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="font-semibold text-foreground">{user?.email ?? 'No email'}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Phone size={20} className="text-success" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                  {isEditingPhone ? (
                    <input type="tel" value={tempPhone} onChange={(e) => setTempPhone(e.target.value)}
                      className="font-semibold text-foreground bg-input-background border border-border px-2 py-1 rounded w-full" autoFocus placeholder="+1 (555) 123-4567"
                    />
                  ) : (
                    <p className="font-semibold text-foreground">{phone || 'Not set'}</p>
                  )}
                </div>
                {isEditingPhone ? (
                  <button onClick={handleSavePhone} className="text-primary"><Check size={20} /></button>
                ) : (
                  <button onClick={() => { setIsEditingPhone(true); setTempPhone(phone); }} className="text-primary"><Edit2 size={18} /></button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bank Account</h2>

          {bankLinked ? (
            <div className="bg-card border border-border rounded-xl p-5 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                  <Building2 size={24} className="text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">Bank Account Linked</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <Check size={16} className="text-success" strokeWidth={3} />
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLinkBank}
              disabled={linkingBank}
              className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {linkingBank ? (
                <><Loader2 size={20} className="animate-spin" /> Linking...</>
              ) : (
                <><Building2 size={20} /> Link Bank Account</>
              )}
            </button>
          )}

          <div className="bg-secondary border border-border rounded-xl p-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Your bank account must be linked to create groups and join payment sessions.
            </p>
          </div>
        </div>

        {paymentMethods.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payment Methods</h2>
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                      <CreditCard size={20} className="text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">
                        {pm.brand ?? pm.type} •••• {pm.last_four}
                      </p>
                      <p className="text-xs text-muted-foreground">{pm.type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
