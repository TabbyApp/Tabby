import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Upload, Camera, FileText } from 'lucide-react';
import { api } from '../lib/api';
import type { PageType, PageState } from '../App';

interface ReceiptScanPageProps {
  groupId?: string;
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

export function ReceiptScanPage({ groupId, onNavigate, theme }: ReceiptScanPageProps) {
  const isDark = theme === 'dark';
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const isAllowedFile = (f: File) => {
    const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-png'].includes(f.type);
    const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
    return ok || ['.png', '.jpg', '.jpeg'].includes(ext);
  };

  const handleFile = async (file: File | null) => {
    if (!file || !groupId) {
      if (!groupId) setError('Please select a group first');
      return;
    }
    if (!isAllowedFile(file)) {
      setError('Please upload PNG or JPG');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const receipt = await api.receipts.upload(groupId, file);
      if (receipt?.id) {
        onNavigate({ page: 'receiptItems', receiptId: receipt.id, groupId });
      } else {
        setError('Upload succeeded but got invalid response. Try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(typeof msg === 'string' ? msg : 'Something went wrong. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleTakePhoto = () => {
    if (!groupId) {
      setError('Open this from a group to upload receipts');
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleChooseGallery = () => {
    if (!groupId) {
      setError('Open this from a group to upload receipts');
      return;
    }
    galleryInputRef.current?.click();
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50'}`}>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          handleFile(f || null);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          handleFile(f || null);
          e.target.value = '';
        }}
      />

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-xl border-b px-5 py-5`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(groupId ? { page: 'groupDetail', groupId } : 'create')}
            className={`w-11 h-11 rounded-[16px] ${isDark ? 'bg-slate-700' : 'bg-gradient-to-br from-purple-100 to-indigo-100'} flex items-center justify-center active:scale-95 transition-transform shadow-sm`}
          >
            <ChevronLeft size={22} className={isDark ? 'text-white' : 'text-purple-600'} strokeWidth={2.5} />
          </button>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Upload Receipt</h1>
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-200'} border-2 border-dashed rounded-[28px] p-8 text-center mb-6 shadow-xl ${isDark ? 'shadow-none' : 'shadow-purple-100/50'}`}>
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[24px] flex items-center justify-center mx-auto mb-5 shadow-xl shadow-purple-300/50">
              <FileText size={42} className="text-white" strokeWidth={2} />
            </div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>
              Upload Your Receipt
            </h3>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} mb-7 text-[15px]`}>
              Take a photo or upload PNG/JPG only
            </p>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="space-y-3">
              <button
                onClick={handleTakePhoto}
                disabled={uploading || !groupId}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-[18px] font-bold shadow-xl shadow-purple-300/50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[16px] disabled:opacity-60"
              >
                <Camera size={22} strokeWidth={2.5} />
                {uploading ? 'Uploading...' : 'Take Photo'}
              </button>
              <button
                onClick={handleChooseGallery}
                disabled={uploading || !groupId}
                className={`w-full ${
                  isDark
                    ? 'bg-slate-700 text-white border-slate-600'
                    : 'bg-slate-50 text-slate-800 border-slate-200'
                } border-2 py-4 rounded-[18px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[16px] disabled:opacity-60`}
              >
                <Upload size={22} strokeWidth={2.5} />
                Choose from Gallery
              </button>
            </div>
          </div>

          <div className={`${isDark ? 'bg-purple-900/30 border-purple-700/50' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200/50'} border-2 rounded-[20px] p-5`}>
            <p className={`text-sm ${isDark ? 'text-purple-300' : 'text-purple-900'} leading-relaxed`}>
              📸 Make sure your receipt is clear and all items are visible. We'll automatically detect items and prices.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
