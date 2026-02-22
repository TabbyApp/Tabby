import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to Supabase Realtime postgres_changes for item_claims filtered by receipt_id.
 * When any claim is inserted/updated/deleted for this receipt, onClaimsChange is called
 * so the parent can refetch receipt data from the API.
 */
export function useReceiptClaimsRealtime(
  receiptId: string | null,
  onClaimsChange: () => void
): void {
  const onClaimsChangeRef = useRef(onClaimsChange);
  onClaimsChangeRef.current = onClaimsChange;

  useEffect(() => {
    if (!receiptId || !supabase) return;

    const channel = supabase
      .channel(`item_claims:${receiptId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_claims',
          filter: `receipt_id=eq.${receiptId}`,
        },
        () => {
          onClaimsChangeRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [receiptId]);
}
