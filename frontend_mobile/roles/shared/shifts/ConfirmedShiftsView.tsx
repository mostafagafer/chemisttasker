import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View, StyleSheet } from 'react-native';
import {
    ActivityIndicator,
    Button,
    Card,
    Dialog,
    IconButton,
    Portal,
    Snackbar,
    Text,
} from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import {
    fetchConfirmedShifts,
    viewAssignedShiftProfileService,
    type Shift,
    type ShiftAssignment,
    type ShiftUser,
} from '@chemisttasker/shared-core';

const PRIMARY = '#7C3AED';

type AssignmentLike = ShiftAssignment | { slot_id?: number; user_id?: number };

const getAssignmentSlotId = (assignment: AssignmentLike): number | null =>
    'slotId' in assignment ? assignment.slotId ?? null : assignment.slot_id ?? null;

const getAssignmentUserId = (assignment: AssignmentLike): number | null =>
    'userId' in assignment ? assignment.userId ?? null : assignment.user_id ?? null;

export default function ConfirmedShiftsView() {
    const { user } = useAuth();
    // TODO: Add activePersona and activeAdminPharmacyId to AuthContext
    const activePersona = null;
    const activeAdminPharmacyId = null;
    const scopedPharmacyId =
        activePersona === 'admin' && typeof activeAdminPharmacyId === 'number'
            ? activeAdminPharmacyId
            : null;

    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [snackbar, setSnackbar] = useState<string>('');
    const [profile, setProfile] = useState<ShiftUser | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileDialog, setProfileDialog] = useState(false);

    const closeSnackbar = () => setSnackbar('');

    const loadShifts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchConfirmedShifts();
            const filtered =
                scopedPharmacyId != null
                    ? data.filter((shift: Shift) => {
                        const targetId =
                            (shift as any).pharmacyDetail?.id ??
                            (shift as any).pharmacy_detail?.id ??
                            (shift as any).pharmacyId ??
                            (shift as any).pharmacy ??
                            null;
                        return Number(targetId ?? NaN) === scopedPharmacyId;
                    })
                    : data;
            setShifts(Array.isArray(filtered) ? filtered : []);
        } catch (err: any) {
            setSnackbar(err?.response?.data?.detail || 'Failed to load confirmed shifts');
        } finally {
            setLoading(false);
        }
    }, [scopedPharmacyId]);

    useEffect(() => {
        void loadShifts();
    }, [loadShifts]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadShifts();
        setRefreshing(false);
    }, [loadShifts]);

    const openProfile = async (shiftId: number, slotId: number | null, userId: number) => {
        setProfile(null);
        setProfileDialog(true);
        setProfileLoading(true);
        try {
            const result = await viewAssignedShiftProfileService({
                type: 'confirmed',
                shiftId,
                slotId: slotId ?? undefined,
                userId,
            });
            setProfile(result);
        } catch (err: any) {
            setSnackbar(err?.response?.data?.detail || 'Failed to load assigned profile');
            setProfileDialog(false);
        } finally {
            setProfileLoading(false);
        }
    };

    const renderProfileDialog = () => (
        <Portal>
            <Dialog visible={profileDialog} onDismiss={() => setProfileDialog(false)}>
                <Dialog.Title>Assigned Profile</Dialog.Title>
                <Dialog.Content>
                    {profileLoading ? (
                        <View style={styles.centered}>
                            <ActivityIndicator />
                        </View>
                    ) : profile ? (
                        <View style={{ gap: 6 }}>
                            <Text><Text style={styles.bold}>Name:</Text> {profile.firstName} {profile.lastName}</Text>
                            <Text><Text style={styles.bold}>Email:</Text> {profile.email}</Text>
                            {profile.phoneNumber ? (
                                <Text><Text style={styles.bold}>Phone:</Text> {profile.phoneNumber}</Text>
                            ) : null}
                            {profile.shortBio ? (
                                <Text><Text style={styles.bold}>Bio:</Text> {profile.shortBio}</Text>
                            ) : null}
                            {profile.resume ? (
                                <Button mode="text" onPress={() => { }}>Download CV</Button>
                            ) : null}
                            {profile.ratePreference ? (
                                <View style={{ marginTop: 8 }}>
                                    <Text style={styles.bold}>Rate Preference</Text>
                                    <Text>Weekday: {profile.ratePreference.weekday || 'N/A'}</Text>
                                    <Text>Saturday: {profile.ratePreference.saturday || 'N/A'}</Text>
                                    <Text>Sunday: {profile.ratePreference.sunday || 'N/A'}</Text>
                                    <Text>Public Holiday: {profile.ratePreference.publicHoliday || 'N/A'}</Text>
                                    <Text>Early Morning: {profile.ratePreference.earlyMorning || 'N/A'}</Text>
                                    <Text>Late Night: {profile.ratePreference.lateNight || 'N/A'}</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : (
                        <Text>No profile data available.</Text>
                    )}
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={() => setProfileDialog(false)}>Close</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );

    const renderShiftCard = (shift: Shift) => {
        const assignments =
            ((shift as any).slotAssignments ?? (shift as any).slot_assignments ?? []) as AssignmentLike[];
        const slots = shift.slots ?? [];
        const pharmacyName =
            (shift as any).pharmacyName ??
            (shift as any).pharmacy_name ??
            (shift as any).pharmacyDetail?.name ??
            (shift as any).pharmacy_detail?.name ??
            'Pharmacy';

        return (
            <Card key={shift.id} style={styles.card} mode="outlined">
                <Card.Title
                    title={pharmacyName}
                    subtitle={`${shift.roleNeeded ?? 'Role'} • ${shift.visibility ?? ''}`}
                    right={(props) => <IconButton {...props} icon="account-check" disabled />}
                />
                <Card.Content>
                    <View style={{ gap: 8 }}>
                        {shift.singleUserOnly ? (
                            <>
                                {slots.map((slot, idx) => (
                                    <Text key={`${slot.id ?? idx}`} style={styles.slotText}>
                                        {slot.date} {slot.startTime}-{slot.endTime}
                                    </Text>
                                ))}
                                {assignments.length > 0 && getAssignmentUserId(assignments[0]) != null && (
                                    <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
                                        <Button
                                            mode="contained"
                                            onPress={() =>
                                                openProfile(
                                                    shift.id,
                                                    null,
                                                    getAssignmentUserId(assignments[0]) as number
                                                )
                                            }
                                            style={styles.primaryBtn}
                                            labelStyle={styles.primaryBtnText}
                                        >
                                            View Assigned
                                        </Button>
                                    </View>
                                )}
                            </>
                        ) : (
                            slots.map((slot, idx) => {
                                const assign = assignments.find((a) => getAssignmentSlotId(a) === slot.id);
                                const assignedUserId = assign ? getAssignmentUserId(assign) : null;
                                if (assignedUserId == null) return null;
                                return (
                                    <View key={`${slot.id ?? idx}`} style={styles.slotRow}>
                                        <Text style={styles.slotText}>
                                            {slot.date} {slot.startTime}-{slot.endTime}
                                        </Text>
                                        <Button
                                            mode="contained"
                                            onPress={() => openProfile(shift.id, slot.id ?? null, assignedUserId)}
                                            style={styles.primaryBtn}
                                            labelStyle={styles.primaryBtnText}
                                        >
                                            View Assigned
                                        </Button>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </Card.Content>
            </Card>
        );
    };

    return (
        <>
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={PRIMARY} />
                </View>
            ) : shifts.length === 0 ? (
                <View style={styles.centered}>
                    <Text>No confirmed shifts available.</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
                >
                    {shifts.map(renderShiftCard)}
                </ScrollView>
            )}

            {renderProfileDialog()}

            <Snackbar visible={!!snackbar} onDismiss={closeSnackbar} duration={3000}>
                {snackbar}
            </Snackbar>
        </>
    );
}

const styles = StyleSheet.create({
    list: { padding: 12, gap: 12 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { borderRadius: 12, borderColor: '#E5E7EB' },
    slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    slotText: { color: '#111827' },
    primaryBtn: { backgroundColor: PRIMARY },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
    bold: { fontWeight: '700' },
});
