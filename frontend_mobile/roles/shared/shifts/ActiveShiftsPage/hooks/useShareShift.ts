import { useState, useCallback } from 'react';
import { Share } from 'react-native';
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
                const link: any = await generateShiftShareLinkService(shift.id);
                const token = link?.shareToken ?? link?.token ?? null;
                if (!token && !link?.url) {
                    throw new Error('Missing share token');
                }
                const baseUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'https://app.chemisttasker.com';
                const publicUrl = link?.url ?? `${baseUrl}/shifts/link?token=${token}`;
                await Share.share({ message: publicUrl, url: publicUrl });
                showSnackbar('Share sheet opened.');
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
