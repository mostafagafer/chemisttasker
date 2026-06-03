// StatusCard Component
// Displays candidates grouped by status (Interested, Assigned, Rejected, No Response)

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, Chip, ActivityIndicator, Surface, Avatar } from 'react-native-paper';
import { customTheme } from '../../theme';
import { ShiftMemberStatus } from '@chemisttasker/shared-core';
import { getCandidateDisplayName } from '../../utils/candidateHelpers';

interface StatusCardProps {
    title: string;
    members: ShiftMemberStatus[];
    icon: string;
    color: 'success' | 'error' | 'warning' | 'info';
    shiftId: number;
    onReviewCandidate: (member: ShiftMemberStatus, shiftId: number, offer: any | null, slotId: number | null) => void;
    getOfferForMember?: (member: ShiftMemberStatus) => { offer: any | null; slotId: number | null };
    reviewLoadingId?: number | null;
}

const colorMap = {
    success: { bg: customTheme.colors.successLight, fg: customTheme.colors.success },
    error: { bg: customTheme.colors.errorLight, fg: customTheme.colors.error },
    warning: { bg: customTheme.colors.warningLight, fg: customTheme.colors.warning },
    info: { bg: customTheme.colors.infoLight, fg: customTheme.colors.info },
};

export default function StatusCard({
    title,
    members,
    icon,
    color,
    shiftId,
    onReviewCandidate,
    getOfferForMember,
    reviewLoadingId,
}: StatusCardProps) {
    const colors = colorMap[color];

    return (
        <Card style={styles.card}>
            <Card.Title
                title={title}
                titleStyle={[styles.cardTitle, { color: colors.fg }]}
                left={() => (
                    <Avatar.Icon
                        size={40}
                        icon={icon}
                        style={{ backgroundColor: colors.bg }}
                        color={colors.fg}
                    />
                )}
                right={() => (
                    <Chip
                        style={{ backgroundColor: colors.fg }}
                        textStyle={{ color: '#fff', fontWeight: 'bold' }}
                    >
                        {members.length}
                    </Chip>
                )}
            />
            <Card.Content>
                {members.length > 0 ? (
                    <View style={styles.membersList}>
                        {members.map((member) => {
                            const memberAny = member as any;
                            const ratingValue = memberAny.averageRating ?? memberAny.rating ?? null;
                            const match = getOfferForMember
                                ? getOfferForMember(member)
                                : { offer: null, slotId: null };
                            const hasOffer = Boolean(match.offer);
                            const userId = memberAny.userId || memberAny.user_id || memberAny.id;

                            return (
                                <Surface key={userId} style={styles.memberCard} elevation={1}>
                                    <View style={styles.memberRow}>
                                        <View style={styles.memberInfo}>
                                            <Text style={styles.memberName}>
                                                {memberAny.name || getCandidateDisplayName(member)}
                                            </Text>
                                            {memberAny.employmentType && (
                                                <Text style={styles.employmentType}>
                                                    {memberAny.employmentType}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.memberBadges}>
                                            {title === 'Interested' && hasOffer && (
                                                <Chip
                                                    mode="flat"
                                                    compact
                                                    style={{ backgroundColor: customTheme.colors.infoLight }}
                                                >
                                                    Counter offer
                                                </Chip>
                                            )}
                                            {ratingValue && (
                                                <Chip
                                                    icon="star"
                                                    mode="outlined"
                                                    compact
                                                    style={{ borderColor: customTheme.colors.warning }}
                                                    textStyle={{ color: customTheme.colors.warning }}
                                                >
                                                    {ratingValue.toFixed(1)}
                                                </Chip>
                                            )}
                                        </View>
                                    </View>
                                    {title === 'Interested' && (
                                        <Button
                                            mode="contained"
                                            onPress={() => {
                                                onReviewCandidate(member, shiftId, match.offer, match.slotId);
                                            }}
                                            disabled={reviewLoadingId === userId}
                                            loading={reviewLoadingId === userId}
                                            style={styles.reviewButton}
                                        >
                                            {hasOffer ? 'Review offer' : 'Review Candidate'}
                                        </Button>
                                    )}
                                </Surface>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={styles.emptyText}>No candidates yet.</Text>
                )}
            </Card.Content>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: customTheme.colors.greyLight,
        borderWidth: 1,
        borderColor: customTheme.colors.border,
    },
    cardTitle: {
        fontWeight: 'bold',
    },
    membersList: {
        gap: customTheme.spacing.md,
    },
    memberCard: {
        padding: customTheme.spacing.md,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    memberRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: customTheme.spacing.sm,
        marginBottom: customTheme.spacing.sm,
    },
    memberInfo: {
        flex: 1,
        flexShrink: 1,
    },
    memberName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: customTheme.colors.text,
    },
    employmentType: {
        fontSize: 12,
        color: customTheme.colors.textMuted,
        marginTop: 2,
    },
    memberBadges: {
        flexDirection: 'row',
        gap: customTheme.spacing.xs,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    },
    reviewButton: {
        marginTop: customTheme.spacing.sm,
        alignSelf: 'flex-start',
    },
    emptyText: {
        textAlign: 'center',
        color: customTheme.colors.textMuted,
        paddingVertical: customTheme.spacing.lg,
    },
});
