import React, { useState, useEffect } from 'react';
import { View, ScrollView, Linking, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import {
    ActivityIndicator,
    Button,
    Card,
    Divider,
    IconButton,
    Snackbar,
    Text,
    Title,
    Chip,
    useTheme,
} from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import {
    type Shift,
    expressInterestInCommunityShiftService,
    fetchCommunityShifts,
    fetchShiftInterests,
    fetchShiftRejections,
    rejectCommunityShiftService,
} from '@chemisttasker/shared-core';
import { formatDistanceToNow } from 'date-fns';

export default function CommunityShiftsView() {
    const theme = useTheme();
    const { user } = useAuth();

    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [disabledSlots, setDisabledSlots] = useState<number[]>([]);
    const [disabledShifts, setDisabledShifts] = useState<number[]>([]);
    const [rejectedSlots, setRejectedSlots] = useState<number[]>([]);
    const [rejectedShifts, setRejectedShifts] = useState<number[]>([]);
    const [snackbarMsg, setSnackbarMsg] = useState('');

    useEffect(() => {
        if (user?.id) {
            load();
        }
    }, [user?.id]);

    const load = async () => {
        setLoading(true);
        try {
            const [community, interests, rejections] = await Promise.all([
                fetchCommunityShifts({}),
                fetchShiftInterests({ userId: user!.id }),
                fetchShiftRejections({ userId: user!.id }),
            ]);

            const available = (community || []).filter((shift: Shift) => {
                const assignedSlotCount = shift.slotAssignments?.length ?? 0;
                const slots = shift.slots ?? [];
                return slots.length === 0 || assignedSlotCount < slots.length;
            });
            setShifts(available);

            setDisabledSlots(interests.map((i: any) => i.slotId).filter((id: any) => typeof id === 'number'));
            setDisabledShifts(interests.filter((i: any) => i.slotId == null).map((i: any) => i.shift));
            setRejectedSlots(rejections.map((r: any) => r.slotId).filter((id: any) => typeof id === 'number'));
            setRejectedShifts(rejections.filter((r: any) => r.slotId == null).map((r: any) => r.shift));

        } catch (err) {
            setSnackbarMsg('Failed to load community shifts');
        } finally {
            setLoading(false);
        }
    };

    const handleExpressInterest = async (shiftId: number, slotId: number | null) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return;

        if (slotId === null) {
            setDisabledShifts(ds => [...ds, shiftId]);
            try {
                if (shift.singleUserOnly) {
                    await expressInterestInCommunityShiftService({ shiftId, slotId: null });
                } else {
                    const slots = shift.slots ?? [];
                    await Promise.all(slots.map(s => expressInterestInCommunityShiftService({ shiftId, slotId: s.id })));
                }
                setSnackbarMsg('Interest expressed!');
            } catch (err) {
                setSnackbarMsg('Failed to express interest');
                setDisabledShifts(ds => ds.filter(id => id !== shiftId));
            }
        } else {
            setDisabledSlots(ds => [...ds, slotId]);
            try {
                await expressInterestInCommunityShiftService({ shiftId, slotId });
                setSnackbarMsg('Interest expressed!');
            } catch (err) {
                setSnackbarMsg('Failed to express interest');
                setDisabledSlots(ds => ds.filter(id => id !== slotId));
            }
        }
    };

    const handleReject = async (shiftId: number, slotId: number | null) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return;

        if (slotId === null) {
            setRejectedShifts(rs => [...rs, shiftId]);
            try {
                if (shift.singleUserOnly) {
                    await rejectCommunityShiftService({ shiftId, slotId: null });
                } else {
                    const slots = shift.slots ?? [];
                    await Promise.all(slots.map(s => rejectCommunityShiftService({ shiftId, slotId: s.id })));
                }
                setSnackbarMsg('Shift rejected');
            } catch (err) {
                setSnackbarMsg('Failed to reject shift');
                setRejectedShifts(rs => rs.filter(id => id !== shiftId));
            }
        } else {
            setRejectedSlots(rs => [...rs, slotId]);
            try {
                await rejectCommunityShiftService({ shiftId, slotId });
                setSnackbarMsg('Slot rejected');
            } catch (err) {
                setSnackbarMsg('Failed to reject slot');
                setRejectedSlots(rs => rs.filter(id => id !== slotId));
            }
        }
    };

    const openMap = (address: string) => {
        const query = encodeURIComponent(address);
        const url = Platform.select({
            ios: `maps:0,0?q=${query}`,
            android: `geo:0,0?q=${query}`,
            default: `https://www.google.com/maps/search/?api=1&query=${query}`
        });
        Linking.openURL(url!).catch(() => setSnackbarMsg('Could not open map'));
    };

    const getPharmData = (shift: Shift) => {
        const p = shift.pharmacy ?? shift.pharmacyDetail;
        return typeof p === 'object' ? p : null;
    };

    const getSlotStatus = (shift: Shift, slotId: number) => {
        if (rejectedSlots.includes(slotId)) return 'Rejected';
        if (disabledSlots.includes(slotId)) return 'Requested';
        if (rejectedShifts.includes(shift.id)) return 'Rejected';
        if (disabledShifts.includes(shift.id)) return 'Requested';
        return 'None';
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {shifts.length === 0 ? (
                    <Text style={{ textAlign: 'center', marginTop: 20, color: '#6B7280' }}>No community shifts available.</Text>
                ) : (
                    shifts.map(shift => {
                        const pharm = getPharmData(shift);
                        const isAnon = shift.postAnonymously;
                        const heading = isAnon ? (pharm?.suburb ? `Shift in ${pharm.suburb}` : 'Anonymous Shift') : (pharm?.name ?? 'Unknown Pharmacy');
                        const locationLine = !isAnon && pharm ? `${pharm.streetAddress || ''}, ${pharm.suburb || ''}` : (pharm?.suburb || '');

                        let rateLabel = 'N/A';
                        if (shift.rateType === 'FIXED') rateLabel = `Fixed — $${shift.fixedRate}/hr`;
                        else if (shift.rateType === 'FLEXIBLE') rateLabel = 'Flexible';

                        return (
                            <Card key={shift.id} style={styles.card} mode="outlined">
                                <Card.Content>
                                    <Title>{heading}</Title>
                                    {locationLine ? (
                                        <TouchableOpacity disabled={isAnon} onPress={() => !isAnon && openMap(locationLine)}>
                                            <Text style={{ color: isAnon ? '#6B7280' : theme.colors.primary, marginBottom: 8 }}>
                                                {locationLine} {(!isAnon && locationLine) ? '📍' : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    {shift.description ? <Text style={{ marginBottom: 8 }}>{shift.description}</Text> : null}
                                    <Divider style={{ marginVertical: 8 }} />

                                    <Text style={{ fontWeight: 'bold' }}>Rate: {rateLabel}</Text>
                                    {shift.ownerAdjustedRate ? (
                                        <Text style={{ color: 'green', fontWeight: 'bold' }}>+${shift.ownerAdjustedRate}/hr Bonus</Text>
                                    ) : null}

                                    <View style={styles.tagsRow}>
                                        {(shift.workloadTags || []).map(t => <Chip key={t} style={styles.chip} textStyle={{ fontSize: 10 }}>{t}</Chip>)}
                                    </View>

                                    <Text style={styles.sectionTitle}>Time Slots</Text>
                                    {(shift.slots || []).map(slot => {
                                        const status = getSlotStatus(shift, slot.id);
                                        const isActionable = status === 'None';

                                        return (
                                            <View key={slot.id} style={styles.slotRow}>
                                                <Text style={{ flex: 1, fontSize: 13 }}>
                                                    {slot.date} {slot.startTime}–{slot.endTime}
                                                </Text>
                                                {!shift.singleUserOnly && (
                                                    <View style={{ flexDirection: 'row' }}>
                                                        {isActionable ? (
                                                            <>
                                                                <Button
                                                                    mode="contained"
                                                                    compact
                                                                    onPress={() => handleExpressInterest(shift.id, slot.id)}
                                                                    style={{ transform: [{ scale: 0.8 }], marginRight: -8 }}
                                                                >
                                                                    Interest
                                                                </Button>
                                                                <Button
                                                                    mode="outlined"
                                                                    compact
                                                                    textColor={theme.colors.error}
                                                                    onPress={() => handleReject(shift.id, slot.id)}
                                                                    style={{ transform: [{ scale: 0.8 }], borderColor: theme.colors.error }}
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Text style={{ fontSize: 12, color: '#9CA3AF', alignSelf: 'center' }}>{status}</Text>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}

                                    {/* Whole Shift Actions */}
                                    <View style={{ marginTop: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                        {(!shift.singleUserOnly && (shift.slots?.length ?? 0) > 1) || shift.singleUserOnly ? (
                                            <>
                                                <Button
                                                    mode="contained"
                                                    disabled={disabledShifts.includes(shift.id) || rejectedShifts.includes(shift.id)}
                                                    onPress={() => handleExpressInterest(shift.id, null)}
                                                >
                                                    {disabledShifts.includes(shift.id) ? 'Requested' : 'Express Interest (All)'}
                                                </Button>
                                                <Button
                                                    mode="outlined"
                                                    textColor={theme.colors.error}
                                                    style={{ borderColor: theme.colors.error }}
                                                    disabled={disabledShifts.includes(shift.id) || rejectedShifts.includes(shift.id)}
                                                    onPress={() => handleReject(shift.id, null)}
                                                >
                                                    Reject Shift
                                                </Button>
                                            </>
                                        ) : null}
                                    </View>

                                    <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8, textAlign: 'right' }}>
                                        Posted {shift.createdAt ? formatDistanceToNow(new Date(shift.createdAt), { addSuffix: true }) : ''}
                                    </Text>
                                </Card.Content>
                            </Card>
                        );
                    })
                )}
            </ScrollView>
            <Snackbar visible={!!snackbarMsg} onDismiss={() => setSnackbarMsg('')} duration={3000}>
                {snackbarMsg}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 16 },
    card: { marginBottom: 16, borderRadius: 12, backgroundColor: '#fff' },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 8 },
    chip: { height: 24, backgroundColor: '#EDE9FE' },
    sectionTitle: { marginTop: 12, marginBottom: 4, fontWeight: '600', color: '#6B7280' },
    slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }
});
