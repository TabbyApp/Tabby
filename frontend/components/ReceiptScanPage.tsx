import { motion } from 'motion/react';
import { ChevronLeft, Upload, Camera, FileText, Edit3, Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { PageType } from '../App';
import { api } from '../lib/api';

interface ReceiptScanPageProps {
  onNavigate: (page: PageType, groupId?: string) => void;
  theme: 'light' | 'dark';
  realGroupId?: string | null;
  onReceiptUploaded?: (receiptId: string) => void;
  returnToGroupAfterUpload?: boolean;
  onReturnToGroup?: () => void;
}

export function ReceiptScanPage({ onNavigate, theme, realGroupId, onReceiptUploaded, returnToGroupAfterUpload, onReturnToGroup }: ReceiptScanPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'upload' | 'processing'>('upload');
  const [error, setError] = useState('');

  const handleFileSelected = async (file: File) => {
    if (!realGroupId) {
      onNavigate('receiptItems');
      return;
    }
    setUploading(true);
    setError('');
    setUploadProgress(0);
    setUploadPhase('upload');
    try {
      const result = await api.receipts.uploadWithProgress(realGroupId, file, (percent, phase) => {
        setUploadProgress(percent);
        setUploadPhase(phase);
      });
      onReceiptUploaded?.(result.id);
      if (returnToGroupAfterUpload) {
        onReturnToGroup?.();
        onNavigate('groupDetail', realGroupId);
      } else {
        onNavigate('receiptItems');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCamera = () => {
    cameraInputRef.current?.click();
  };

  const handleManualEntry = async () => {
    if (!realGroupId || returnToGroupAfterUpload) return; // Manual entry only for item split (creates empty receipt)
    setUploading(true);
    setError('');
    try {
      const receipt = await api.receipts.create(realGroupId);
      onReceiptUploaded?.(receipt.id);
      onNavigate('receiptItems');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start manual entry');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,image/x-adobe-dng,image/dng"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileSelected(f);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,image/x-adobe-dng,image/dng"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileSelected(f);
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card/95 backdrop-blur-xl border-b border-border px-5 py-5"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => returnToGroupAfterUpload && realGroupId ? onNavigate('groupDetail', realGroupId) : onNavigate('home')}
            className="w-11 h-11 rounded-[16px] bg-secondary flex items-center justify-center active:scale-95 transition-transform shadow-sm"
          >
            <ChevronLeft size={22} className="text-foreground" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Upload Receipt</h1>
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="w-full max-w-sm"
        >
          <div className="bg-card border-2 border-dashed border-border rounded-[28px] p-8 text-center mb-6">
            <div className="w-24 h-24 bg-primary rounded-[24px] flex items-center justify-center mx-auto mb-5">
              {uploading ? (
                <Loader2 size={42} className="text-primary-foreground animate-spin" strokeWidth={2} />
              ) : (
                <FileText size={42} className="text-primary-foreground" strokeWidth={2} />
              )}
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {uploading
                ? uploadPhase === 'upload'
                  ? `Uploading... ${uploadProgress}%`
                  : 'Processing...'
                : 'Upload Your Receipt'}
            </h3>
            <p className="text-muted-foreground mb-4 text-[15px]">
              {uploading ? 'Extracting items and totals from your receipt.' : 'Take a photo or upload an existing image'}
            </p>
            {uploading && (
              <div className="w-full h-2 rounded-full mb-4 overflow-hidden bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleCamera}
                disabled={uploading}
                className="w-full bg-primary text-primary-foreground py-4 rounded-[18px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[16px] disabled:opacity-60"
              >
                <Camera size={22} strokeWidth={2.5} />
                Take Photo
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-secondary text-foreground border-2 border-border py-4 rounded-[18px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[16px] disabled:opacity-60"
              >
                <Upload size={22} strokeWidth={2.5} />
                Choose from Gallery
              </button>
              {!returnToGroupAfterUpload && (
                <button
                  onClick={handleManualEntry}
                  disabled={uploading}
                  className="w-full bg-secondary text-foreground border-2 border-border py-4 rounded-[18px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2.5 text-[16px] disabled:opacity-60"
                >
                  <Edit3 size={22} strokeWidth={2.5} />
                  Manual Entry
                </button>
              )}
            </div>
          </div>

          <div className="bg-secondary border-2 border-border rounded-[20px] p-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              📸 Make sure your receipt is clear and all items are visible. We'll automatically detect items and prices.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
