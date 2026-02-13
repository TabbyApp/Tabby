import { useState, useEffect } from 'react';
import { ChevronLeft, User, Mail, Phone, CreditCard, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { PageType } from '../App';

interface AccountPageProps {
  onNavigate: (page: PageType) => void;
  theme: 'light' | 'dark';
}

type EditField = 'name' | 'email' | 'phone' | null;

export function AccountPage({ onNavigate, theme }: AccountPageProps) {
  const isDark = theme === 'dark';
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.users.me()
      .then((data) => {
        setProfile({
          name: data.name || 'John Doe',
          email: data.email || 'john@example.com',
          phone: data.phone || '',
        });
      })
      .catch(() => {
        setProfile({ name: user?.name || 'John Doe', email: user?.email || 'john@example.com', phone: '' });
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const openEdit = (field: EditField) => {
    if (!field || !profile) return;
    setEditField(field);
    setEditValue(field === 'name' ? profile.name : field === 'email' ? profile.email : profile.phone);
    setError(null);
  };

  const saveEdit = async () => {
    if (!editField || !profile) return;
    setSaving(true);
    setError(null);
    try {
      const updates: { name?: string; email?: string; phone?: string } = {};
      if (editField === 'name') updates.name = editValue.trim();
      else if (editField === 'email') updates.email = editValue.trim();
      else if (editField === 'phone') updates.phone = editValue.trim();
      const updated = await api.users.updateProfile(updates);
      setProfile({
        name: updated.name,
        email: updated.email,
        phone: updated.phone || '',
      });
      setUser({ ...user!, name: updated.name, email: updated.email });
      setEditField(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className={`h-[calc(100vh-48px-24px)] flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Account</h1>
        </div>
      </div>

      {/* Profile Picture */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-600 to-blue-500 flex items-center justify-center text-white shadow-md mb-4">
            <User size={40} strokeWidth={2.5} />
          </div>
          <button className="text-blue-500 font-medium text-sm">Change Photo</button>
        </div>

        {/* Account Details */}
        <div className="space-y-3">
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-blue-100'} flex items-center justify-center`}>
                <User size={20} className="text-blue-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Full Name</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{profile.name}</p>
              </div>
              <button type="button" onClick={() => openEdit('name')} className="text-blue-500 text-sm font-medium">Edit</button>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-purple-100'} flex items-center justify-center`}>
                <Mail size={20} className="text-purple-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Email</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{profile.email}</p>
              </div>
              <button type="button" onClick={() => openEdit('email')} className="text-blue-500 text-sm font-medium">Edit</button>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-green-100'} flex items-center justify-center`}>
                <Phone size={20} className="text-green-500" />
              </div>
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Phone (OTP verification)</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {profile.phone || 'Not set — Add for OTP'}
                </p>
              </div>
              <button type="button" onClick={() => openEdit('phone')} className="text-blue-500 text-sm font-medium">Edit</button>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mt-6">
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wide mb-3`}>
            Payment setup
          </h2>
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <CreditCard size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Visa •••• 1234</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Expires 12/26</p>
              </div>
              <button className="text-blue-500 text-sm font-medium">Manage</button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal — inline, no Radix portal */}
      {editField && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" onClick={() => setEditField(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className={`relative z-50 w-[calc(100%-2rem)] max-w-[400px] rounded-2xl p-6 shadow-xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Edit {editField === 'name' ? 'Name' : editField === 'email' ? 'Email' : 'Phone'}
              </h3>
              <button type="button" onClick={() => setEditField(null)} className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <X size={18} className={isDark ? 'text-white' : 'text-slate-600'} />
              </button>
            </div>
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <input
              type={editField === 'email' ? 'email' : editField === 'phone' ? 'tel' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={editField === 'name' ? 'Full name' : editField === 'email' ? 'Email' : 'Phone number'}
              className={`w-full px-4 py-3 rounded-lg border mb-4 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditField(null)}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving || (editField === 'name' && !editValue.trim()) || (editField === 'email' && !editValue.trim())}
                className="px-4 py-2.5 rounded-lg font-medium text-sm bg-blue-500 text-white disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
