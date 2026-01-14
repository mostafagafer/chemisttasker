import { useState, useCallback } from 'react';
import { Shift, generateShiftShareLinkService } from '@chemisttasker/shared-core';

export function useShareShift(showSnackbar: (msg: string) => void) {
    const [sharingShiftId, setSharingShiftId] = useState<number | null>(null);

    const handleShare = useCallback(
        async (shift: Shift) => {
            if ((shift as any).visibility !== 'PLATFORM') {
                showSnackbar('Escalate to Platform to get a shareable link.');
                return;
            }
            setSharingShiftId(shift.id);
            try {
                const link = await generateShiftShareLinkService(shift.id);
                const token = (link as any).shareToken ?? (link as any).token;
                if (!token && !(link as any).url) {
                    throw new Error('Missing share token');
                }
                const publicUrl = (link as any).url ?? `${window.location.origin}/shifts/link?token=${token}`;
                await navigator.clipboard.writeText(publicUrl);
                showSnackbar('Public share link copied to clipboard!');
            } catch (error) {
                console.error('Share Error:', error);
                showSnackbar('Error: Could not generate share link.');
            } finally {
                setSharingShiftId(null);
            }
        },
        [showSnackbar]
    );

    return {
        sharingShiftId,
        handleShare,
    };
}
