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
    Paragraph,
    useTheme,
    Badge
} from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import {
    type Shift,
    expressInterestInPublicShiftService,
    fetchPublicShifts,
    fetchShiftInterests,
    fetchRatingsSummaryService,
} from '@chemisttasker/shared-core';
import { formatDistanceToNow } from 'date-fns';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PublicShiftsView() {
    const theme = useTheme();
    const { user } = useAuth();

    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [pharmacySummaries, setPharmacySummaries] = useState<Record<number, { average: number; count: number }>>({});
    const [disabledSlots, setDisabledSlots] = useState<number[]>([]);
    const [disabledShifts, setDisabledShifts] = useState<number[]>([]);
    const [snackbarMsg, setSnackbarMsg] = useState('');

    useEffect(() => {
        if (user?.id) {
            load();
        }
    }, [user?.id]);

    const load = async () => {
        setLoading(true);
        try {
            const [publicShifts, interests] = await Promise.all([
                fetchPublicShifts({}),
                fetchShiftInterests({ userId: user!.id }),
            ]);

            const available = (publicShifts || []).filter((shift: Shift) => {
                const assignedSlotCount = shift.slotAssignments?.length ?? 0;
                const slots = shift.slots ?? [];
                // crude check: if slots exist and not all assigned
                return slots.length === 0 || assignedSlotCount < slots.length;
            });

            setShifts(available);

            // Load ratings
            const uniquePharmacyIds = Array.from(new Set(available.map((s: Shift) => {
                const p = s.pharmacy ?? s.pharmacyDetail;
                return typeof p === 'object' ? p?.id : null;
            }).filter(Boolean))) as number[];

            uniquePharmacyIds.forEach(id => {
                fetchRatingsSummaryService({ targetType: 'pharmacy', targetId: id })
                    .then(res => setPharmacySummaries(prev => ({ ...prev, [id]: { average: res.average ?? 0, count: res.count ?? 0 } })))
                    .catch(() => { });
            });

            // Set disabled states based on existing interests
            const slotIds = interests.map((i: any) => i.slotId).filter((id: any) => typeof id === 'number');
            setDisabledSlots(slotIds);

            const shiftIds = interests.filter((i: any) => i.slotId == null).map((i: any) => i.shift);
            setDisabledShifts(shiftIds);

        } catch (err) {
            setSnackbarMsg('Failed to load public shifts');
        } finally {
            setLoading(false);
        }
    };

    const handleExpressInterest = async (shiftId: number, slotId: number | null) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return;

        if (slotId === null) {
            // Whole shift
            setDisabledShifts(ds => [...ds, shiftId]);
            try {
                if (shift.singleUserOnly) {
                    await expressInterestInPublicShiftService({ shiftId, slotId: null });
                } else {
                    const slots = shift.slots ?? [];
                    await Promise.all(slots.map(s => expressInterestInPublicShiftService({ shiftId, slotId: s.id })));
                    setDisabledSlots(ds => [...ds, ...slots.map(s => s.id)]);
                }
                setSnackbarMsg('Expressed interest!');
            } catch (err: any) {
                setSnackbarMsg(err.message || 'Failed to express interest');
                setDisabledShifts(ds => ds.filter(id => id !== shiftId));
            }
        } else {
            // Single slot
            setDisabledSlots(ds => [...ds, slotId]);
            try {
                await expressInterestInPublicShiftService({ shiftId, slotId });
                setSnackbarMsg('Expressed interest in slot');
            } catch (err: any) {
                setSnackbarMsg(err.message || 'Failed to express interest');
                setDisabledSlots(ds => ds.filter(id => id !== slotId));
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
                    <Text style={{ textAlign: 'center', marginTop: 20, color: '#6B7280' }}>No public shifts available.</Text>
                ) : (
                    shifts.map(shift => {
                        const pharm = getPharmData(shift);
                        const summary = pharm?.id ? pharmacySummaries[pharm.id] : null;
                        const isAnon = shift.postAnonymously;
                        const heading = isAnon ? (pharm?.suburb ? `Shift in ${pharm.suburb}` : 'Anonymous Shift') : (pharm?.name ?? 'Unknown Pharmacy');
                        const locationLine = !isAnon && pharm ? `${pharm.streetAddress || ''}, ${pharm.suburb || ''}` : (pharm?.suburb || '');

                        let rateLabel = 'N/A';
                        if (shift.rateType === 'FIXED') rateLabel = `Fixed — $${shift.fixedRate}/hr`;
                        else if (shift.rateType === 'FLEXIBLE') rateLabel = 'Flexible';
                        else if (shift.rateType === 'PHARMACIST_PROVIDED') rateLabel = 'Pharmacist Provided';

                        const slots = shift.slots ?? [];

                        return (
                            <Card key={shift.id} style={styles.card} mode="outlined">
                                <Card.Content>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Title style={{ flex: 1 }}>{heading}</Title>
                                        {summary && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <IconButton icon="star" iconColor="#F59E0B" size={16} style={{ margin: 0 }} />
                                                <Text style={{ fontSize: 12 }}>{summary.average.toFixed(1)} ({summary.count})</Text>
                                            </View>
                                        )}
                                    </View>

                                    {locationLine ? (
                                        <TouchableOpacity disabled={isAnon} onPress={() => !isAnon && openMap(locationLine)}>
                                            <Text style={{ color: isAnon ? '#6B7280' : theme.colors.primary, marginBottom: 8 }}>
                                                {locationLine} {(!isAnon && locationLine) ? '📍' : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    {shift.description ? <Text style={{ marginBottom: 8 }}>{shift.description}</Text> : null}
                                    <Divider style={{ marginVertical: 8 }} />

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontWeight: 'bold' }}>Rate: {rateLabel}</Text>
                                        {shift.ownerAdjustedRate ? (
                                            <Text style={{ color: 'green', fontWeight: 'bold' }}>+${shift.ownerAdjustedRate}/hr Bonus</Text>
                                        ) : null}
                                    </View>

                                    <View style={styles.tagsRow}>
                                        {(shift.workloadTags || []).map(t => <Chip key={t} style={styles.chip} textStyle={{ fontSize: 10 }}>{t}</Chip>)}
                                    </View>

                                    <Text style={styles.sectionTitle}>Time Slots</Text>
                                    {slots.map(slot => {
                                        const isAssigned = (shift.slotAssignments || []).some(a => a.slotId === slot.id);
                                        const disabled = disabledSlots.includes(slot.id) || disabledShifts.includes(shift.id) || isAssigned;

                                        return (
                                            <View key={slot.id} style={styles.slotRow}>
                                                <Text style={{ flex: 1 }}>
                                                    {slot.date} {slot.startTime}–{slot.endTime}
                                                </Text>
                                                {!shift.singleUserOnly && (
                                                    <Button
                                                        mode="contained"
                                                        compact
                                                        disabled={disabled}
                                                        onPress={() => handleExpressInterest(shift.id, slot.id)}
                                                        style={{ transform: [{ scale: 0.8 }] }}
                                                    >
                                                        {disabled ? 'Requested' : 'Interest'}
                                                    </Button>
                                                )}
                                            </View>
                                        );
                                    })}

                                    {/* Action Buttons for Whole Shift */}
                                    <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
                                        {(!shift.singleUserOnly && slots.length > 1) ? (
                                            <Button
                                                mode="contained"
                                                disabled={disabledShifts.includes(shift.id)}
                                                onPress={() => handleExpressInterest(shift.id, null)}
                                            >
                                                {disabledShifts.includes(shift.id) ? 'Requested All' : 'Express Interest All'}
                                            </Button>
                                        ) : null}

                                        {shift.singleUserOnly && (
                                            <Button
                                                mode="contained"
                                                disabled={disabledShifts.includes(shift.id)}
                                                onPress={() => handleExpressInterest(shift.id, null)}
                                            >
                                                {disabledShifts.includes(shift.id) ? 'Requested' : 'Express Interest'}
                                            </Button>
                                        )}
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
