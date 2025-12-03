import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, RefreshControl, StyleSheet } from 'react-native';
import {
  ActivityIndicator,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  Snackbar,
  Text,
  Button,
  Portal,
  Dialog,
} from 'react-native-paper';
import {
  fetchActiveShifts,
  fetchShiftInterests,
  fetchShiftMemberStatus,
  generateShiftShareLinkService,
  escalateShiftService,
  deleteActiveShiftService,
  acceptShiftCandidateService,
  revealShiftInterestService,
  type Shift,
  type ShiftInterest,
  type ShiftMemberStatus,
  type EscalationLevelKey,
} from '@chemisttasker/shared-core';
import { useAuth } from '../../context/AuthContext';

const ESCALATION_ORDER: Array<{ key: EscalationLevelKey; label: string }> = [
  { key: 'FULL_PART_TIME', label: 'My Pharmacy' },
  { key: 'LOCUM_CASUAL', label: 'Favourites' },
  { key: 'OWNER_CHAIN', label: 'Chain' },
  { key: 'ORG_CHAIN', label: 'Organization' },
  { key: 'PLATFORM', label: 'Platform' },
];

type Props = {
  onError?: (msg: string) => void;
  onShare?: (link: string | null) => void;
};

export default function ActiveShiftsView({ onError, onShare }: Props) {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState<string>('');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [escalating, setEscalating] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [membersByLevel, setMembersByLevel] = useState<Record<string, ShiftMemberStatus[]>>({});
  const [interestsByShift, setInterestsByShift] = useState<Record<number, ShiftInterest[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selectedLevelByShift, setSelectedLevelByShift] = useState<Record<number, EscalationLevelKey>>({});

  const notify = (msg: string) => {
    setSnackbar(msg);
    onError?.(msg);
  };

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActiveShifts();
      setShifts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notify(err?.message || 'Failed to load active shifts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadShifts();
    setRefreshing(false);
  }, [loadShifts]);

  const handleShare = async (id: number) => {
    try {
      const res = await generateShiftShareLinkService(id);
      const link = res?.shareToken || res?.share_token || null;
      setShareLink(link);
      onShare?.(link);
      setSnackbar('Share link generated');
    } catch (err: any) {
      notify(err?.message || 'Failed to generate share link');
    }
  };

  const handleEscalate = async (shift: Shift) => {
    const allowed = shift.allowedEscalationLevels || [];
    const currentIndex = allowed.findIndex((k) => k === shift.visibility);
    const next = currentIndex >= 0 && currentIndex < allowed.length - 1 ? allowed[currentIndex + 1] : null;
    if (!next) {
      notify('No further escalation level available.');
      return;
    }
    setEscalating((s) => ({ ...s, [shift.id]: true }));
    try {
      await escalateShiftService(shift.id, { targetVisibility: next });
      setSnackbar(`Escalated to ${next}`);
      await loadShifts();
    } catch (err: any) {
      notify(err?.message || 'Failed to escalate shift');
    } finally {
      setEscalating((s) => ({ ...s, [shift.id]: false }));
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting((s) => ({ ...s, [id]: true }));
    try {
      await deleteActiveShiftService(id);
      setSnackbar('Shift deleted');
      await loadShifts();
    } catch (err: any) {
      notify(err?.message || 'Failed to delete shift');
    } finally {
      setDeleting((s) => ({ ...s, [id]: false }));
      setDeleteId(null);
    }
  };

  const loadMembers = async (shift: Shift, level: EscalationLevelKey) => {
    const key = `${shift.id}_${level}`;
    try {
      const data = await fetchShiftMemberStatus(shift.id, { visibility: level });
      setMembersByLevel((prev) => ({ ...prev, [key]: Array.isArray(data) ? data : [] }));
    } catch (err: any) {
      notify(err?.message || 'Failed to load members');
    }
  };

  const loadInterests = async (shiftId: number) => {
    try {
      const data = await fetchShiftInterests({ shiftId });
      setInterestsByShift((prev) => ({ ...prev, [shiftId]: Array.isArray(data) ? data : [] }));
    } catch (err: any) {
      notify(err?.message || 'Failed to load interests');
    }
  };

  const handleAccept = async (shiftId: number, userId: number) => {
    try {
      await acceptShiftCandidateService(shiftId, { userId });
      setSnackbar('Candidate accepted');
      await loadShifts();
    } catch (err: any) {
      notify(err?.message || 'Failed to accept candidate');
    }
  };

  const handleReveal = async (shiftId: number, userId: number) => {
    try {
      await revealShiftInterestService(shiftId, { userId });
      setSnackbar('Profile revealed');
    } catch (err: any) {
      notify(err?.message || 'Failed to reveal profile');
    }
  };

  const levelsForShift = (shift: Shift) => {
    const allowed = shift.allowedEscalationLevels || [];
    if (!allowed.length) return ESCALATION_ORDER;
    return ESCALATION_ORDER.filter((l) => allowed.includes(l.key));
  };

  const currentSelectedLevel = (shift: Shift) => {
    const levels = levelsForShift(shift);
    const current = selectedLevelByShift[shift.id];
    if (current && levels.find((l) => l.key === current)) return current;
    return shift.visibility && levels.find((l) => l.key === (shift.visibility as EscalationLevelKey))?.key || levels[0].key;
  };

  const renderInterests = (shiftId: number) => {
    const items = interestsByShift[shiftId] || [];
    if (!items.length) {
      return <Text style={styles.muted}>No interests yet.</Text>;
    }
    return items.map((i) => (
      <List.Item
        key={i.id}
        title={i.userName || `User ${i.userId}`}
        description={'Interested'}
        right={() => (
          <View style={styles.row}>
            <Button compact onPress={() => handleReveal(shiftId, i.userId!)}>Reveal</Button>
            <Button compact onPress={() => handleAccept(shiftId, i.userId!)}>Accept</Button>
          </View>
        )}
      />
    ));
  };

  const renderMembers = (shift: Shift) => {
    const levels = levelsForShift(shift);
    const selectedLevel = currentSelectedLevel(shift);
    return (
      <View style={{ gap: 8 }}>
        <View style={styles.levelRow}>
          {levels.map((lvl) => (
            <Chip
              key={lvl.key}
              selected={lvl.key === selectedLevel}
              onPress={() => {
                setSelectedLevelByShift((s) => ({ ...s, [shift.id]: lvl.key }));
                void loadMembers(shift, lvl.key);
              }}
              style={[styles.levelChip, lvl.key === selectedLevel && styles.levelChipActive]}
              textStyle={lvl.key === selectedLevel ? styles.levelTextActive : styles.levelText}
            >
              {lvl.label}
            </Chip>
          ))}
        </View>
        <Card mode="outlined" style={styles.innerCard}>
          <Card.Title
            title={levels.find((l) => l.key === selectedLevel)?.label || 'Members'}
            right={() => (
              <Button compact onPress={() => loadMembers(shift, selectedLevel)}>Refresh</Button>
            )}
          />
          <Card.Content>
            {(() => {
              const key = `${shift.id}_${selectedLevel}`;
              const members = membersByLevel[key] || [];
              if (!members.length) return <Text style={styles.muted}>No members loaded.</Text>;
              return members.map((m) => (
                <List.Item
                  key={`${m.userId}-${m.status}`}
                  title={m.name || `User ${m.userId}`}
                  description={m.status}
                  right={() => (
                    <View style={styles.row}>
                      <Button compact onPress={() => handleAccept(shift.id, m.userId!)}>Assign</Button>
                    </View>
                  )}
                />
              ));
            })()}
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderShiftCard = (shift: Shift) => {
    const isExpanded = expanded === shift.id;
    return (
      <Card key={shift.id} style={styles.card} mode="outlined">
        <Card.Title
          title={shift.pharmacyName || shift.pharmacyDetail?.name || 'Pharmacy'}
          subtitle={`${shift.roleNeeded || 'Role'} • ${shift.visibility}`}
          right={(props) => (
            <View style={styles.row}>
              <IconButton {...props} icon="share-variant" onPress={() => handleShare(shift.id)} />
              <IconButton
                {...props}
                icon="arrow-up-bold"
                onPress={() => handleEscalate(shift)}
                disabled={!!escalating[shift.id]}
              />
              <IconButton {...props} icon="delete" onPress={() => setDeleteId(shift.id)} disabled={!!deleting[shift.id]} />
              <IconButton {...props} icon={isExpanded ? 'chevron-up' : 'chevron-down'} onPress={() => setExpanded(isExpanded ? null : shift.id)} />
            </View>
          )}
        />
        <Card.Content>
          <View style={styles.row}>
            <Chip style={styles.chip} icon="account-group">
              {shift.allowedEscalationLevels?.join(' • ') || 'Tiers'}
            </Chip>
          </View>
          {shift.description ? (
            <Text style={styles.description}>{shift.description}</Text>
          ) : null}
          <View style={styles.slotRow}>
            {(shift.slots || []).map((slot, idx) => (
              <Chip key={`${shift.id}-slot-${idx}`} style={styles.chip} icon="calendar">
                {slot.date || 'Date'} • {slot.startTime || ''}{slot.endTime ? ` - ${slot.endTime}` : ''}
              </Chip>
            ))}
          </View>
          {isExpanded ? (
            <>
              <Divider style={{ marginVertical: 8 }} />
              <Text style={styles.sectionTitle}>Interests</Text>
              <Button mode="text" onPress={() => loadInterests(shift.id)}>Refresh interests</Button>
              {renderInterests(shift.id)}
              <Divider style={{ marginVertical: 8 }} />
              <Text style={styles.sectionTitle}>Members by tier</Text>
              {renderMembers(shift)}
            </>
          ) : null}
        </Card.Content>
      </Card>
    );
  };

  return (
    <>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
          contentContainerStyle={styles.list}
        >
          {shifts.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.muted}>No active shifts</Text>
            </View>
          ) : shifts.map(renderShiftCard)}
        </ScrollView>
      )}

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={3000}>
        {snackbar}
      </Snackbar>

      <Portal>
        <Dialog visible={shareLink !== null} onDismiss={() => setShareLink(null)}>
          <Dialog.Title>Share Link</Dialog.Title>
          <Dialog.Content>
            <Text selectable>{shareLink}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShareLink(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={deleteId !== null} onDismiss={() => setDeleteId(null)}>
          <Dialog.Title>Delete shift?</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this shift?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteId(null)}>Cancel</Button>
            <Button onPress={() => deleteId && handleDelete(deleteId)} loading={deleteId ? !!deleting[deleteId] : false}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 12, borderColor: '#E5E7EB' },
  innerCard: { marginTop: 8, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { backgroundColor: '#EEF2FF', marginRight: 6 },
  muted: { color: '#6B7280', textAlign: 'center' },
  sectionTitle: { fontWeight: '700', marginBottom: 4, color: '#111827' },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: { backgroundColor: '#EEF2FF' },
  levelChipActive: { backgroundColor: '#7C3AED' },
  levelText: { color: '#4B5563', fontWeight: '600' },
  levelTextActive: { color: '#FFFFFF', fontWeight: '700' },
  description: { color: '#4B5563', marginTop: 6, marginBottom: 6 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
});
