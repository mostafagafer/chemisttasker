import React from 'react';
import {
    Box,
    ButtonBase,
    Typography,
    Button,
    CircularProgress,
    Stack,
} from '@mui/material';
import {
    People,
    Favorite,
    Store,
    CorporateFare,
    Lock,
    TrendingUp,
} from '@mui/icons-material';
import { Shift, EscalationLevelKey } from '@chemisttasker/shared-core';

const chemisttaskerBadge = '/images/ChatGPT Image Jan 18, 2026, 08_14_43 PM.png';

const ESCALATION_LEVELS: Array<{
    key: EscalationLevelKey;
    label: string;
    icon?: React.ElementType;
    requiresOrganization?: boolean;
}> = [
        { key: 'FULL_PART_TIME', label: 'My Pharmacy', icon: People },
        { key: 'LOCUM_CASUAL', label: 'Favourites', icon: Favorite },
        { key: 'OWNER_CHAIN', label: 'Chain', icon: Store },
        { key: 'ORG_CHAIN', label: 'Organization', icon: CorporateFare, requiresOrganization: true },
        { key: 'PLATFORM', label: 'Chemisttasker' },
    ];

interface EscalationStepperProps {
    shift: Shift;
    currentLevel: EscalationLevelKey;
    selectedLevel: EscalationLevelKey;
    onSelectLevel: (levelKey: EscalationLevelKey) => void;
    onEscalate: (shift: Shift, levelKey: EscalationLevelKey) => void;
    escalating?: boolean;
    labelOverrides?: Partial<Record<EscalationLevelKey, string>>;
    showPrivateFirst?: boolean;
}

export const EscalationStepper: React.FC<EscalationStepperProps> = ({
    shift,
    currentLevel,
    selectedLevel,
    onSelectLevel,
    onEscalate,
    escalating,
    labelOverrides,
    showPrivateFirst,
}) => {
    const allowedKeys = new Set((shift as any).allowedEscalationLevels || []);
    if (!allowedKeys.size) {
        ESCALATION_LEVELS.forEach((level) => allowedKeys.add(level.key));
    }

    const levelSequence = ESCALATION_LEVELS.filter((level) => allowedKeys.has(level.key));
    const resolveLabel = (key: EscalationLevelKey, fallback: string) =>
        labelOverrides?.[key] ?? fallback;
    const currentLevelIdx = Math.max(
        0,
        levelSequence.findIndex((level) => level.key === currentLevel)
    );
    const selectedLevelIdx = levelSequence.findIndex((level) => level.key === selectedLevel);
    const stepOffset = showPrivateFirst ? 1 : 0;
    const uiCurrentLevelIdx = showPrivateFirst ? -1 : currentLevelIdx;

    const visualSteps = [
        ...(showPrivateFirst ? [{ key: 'DIRECT_PRIVATE' as const, label: 'Direct / Private', icon: Lock, selectable: false, active: false, reached: true }] : []),
        ...levelSequence.map((level, idx) => {
            const levelPassed = idx <= uiCurrentLevelIdx;
            const levelSelectable = idx <= uiCurrentLevelIdx + 1 && allowedKeys.has(level.key);
            const levelViewable = idx <= uiCurrentLevelIdx;
            return {
                key: level.key,
                label: resolveLabel(level.key, level.label),
                icon: level.icon,
                isPlatform: level.key === 'PLATFORM',
                selectable: levelSelectable,
                active: selectedLevel === level.key,
                reached: levelPassed || levelViewable || selectedLevel === level.key,
                escalated: levelPassed || levelViewable,
                onClick: () => onSelectLevel(level.key),
            };
        }),
    ];

    return (
        <Box>
            <Box sx={{ position: 'relative', px: { xs: 1, md: 5 }, pt: 2, pb: 4, mb: 1 }}>
                <Box
                    sx={{
                        position: 'absolute',
                        left: { xs: 30, md: 78 },
                        right: { xs: 30, md: 78 },
                        top: 54,
                        height: 5,
                        borderRadius: 999,
                        bgcolor: '#E5E7EB',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        left: { xs: 30, md: 78 },
                        top: 54,
                        width: `${Math.min(100, Math.max(0, ((Math.max(selectedLevelIdx, uiCurrentLevelIdx) + stepOffset) / Math.max(1, visualSteps.length - 1)) * 100))}%`,
                        maxWidth: { xs: 'calc(100% - 60px)', md: 'calc(100% - 156px)' },
                        height: 5,
                        borderRadius: 999,
                        background: 'linear-gradient(90deg,#8B5CF6 0%,#7C3AED 38%,#3B82F6 72%,#22D3EE 100%)',
                        boxShadow: '0 0 18px rgba(124,58,237,.35)',
                    }}
                />
                <Box sx={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: `repeat(${visualSteps.length}, minmax(90px, 1fr))`, gap: { xs: 1, md: 4 } }}>
                    {visualSteps.map((step) => {
                        const Icon = step.icon;
                        const platformEscalated = 'isPlatform' in step && step.isPlatform && 'escalated' in step && step.escalated;
                        const circle = (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <Box
                                    sx={{
                                        position: 'relative',
                                        width: { xs: 62, md: 82 },
                                        height: { xs: 62, md: 82 },
                                        borderRadius: '50%',
                                        display: 'grid',
                                        placeItems: 'center',
                                        bgcolor: '#fff',
                                        boxShadow: step.active ? '0 16px 32px rgba(124,58,237,.32)' : '0 12px 26px rgba(99,102,241,.18)',
                                        border: '1px solid rgba(167,139,250,.35)',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            inset: 7,
                                            borderRadius: '50%',
                                            background: step.reached && !('isPlatform' in step && step.isPlatform)
                                                ? 'radial-gradient(circle at 30% 20%, rgba(255,255,255,.88), transparent 34%), linear-gradient(135deg,#7C3AED,#9333EA 48%,#38BDF8)'
                                                : 'linear-gradient(135deg,#E5E7EB,#CBD5E1)',
                                            opacity: step.selectable || step.reached ? 1 : 0.7,
                                        }}
                                    />
                                    {'isPlatform' in step && step.isPlatform ? (
                                        <Box
                                            component="img"
                                            src={chemisttaskerBadge}
                                            alt="Chemisttasker"
                                            sx={{
                                                position: 'relative',
                                                width: { xs: 42, md: 56 },
                                                height: { xs: 42, md: 56 },
                                                objectFit: 'contain',
                                                filter: platformEscalated ? 'drop-shadow(0 2px 3px rgba(15,23,42,.20))' : 'grayscale(1)',
                                                opacity: platformEscalated ? 1 : 0.42,
                                            }}
                                        />
                                    ) : Icon ? (
                                        <Icon sx={{ position: 'relative', color: '#fff', fontSize: { xs: 25, md: 34 }, filter: 'drop-shadow(0 2px 3px rgba(15,23,42,.28))' }} />
                                    ) : null}
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            bottom: -9,
                                            width: 16,
                                            height: 16,
                                            borderRadius: '50%',
                                            bgcolor: 'isPlatform' in step && step.isPlatform
                                                ? (platformEscalated ? '#7C3AED' : '#CBD5E1')
                                                : step.reached ? '#7C3AED' : '#CBD5E1',
                                            border: '3px solid #fff',
                                        }}
                                    />
                                </Box>
                                <Typography
                                    sx={{
                                        fontWeight: 800,
                                        color: 'isPlatform' in step && step.isPlatform
                                            ? platformEscalated ? '#111827' : '#94A3B8'
                                            : step.active ? '#7C3AED' : step.reached ? '#111827' : '#94A3B8',
                                        textAlign: 'center',
                                    }}
                                >
                                    {step.label}
                                </Typography>
                            </Box>
                        );
                        return step.selectable && 'onClick' in step ? (
                            <ButtonBase key={String(step.key)} onClick={step.onClick} sx={{ borderRadius: 3 }}>
                                {circle}
                            </ButtonBase>
                        ) : (
                            <Box key={String(step.key)}>{circle}</Box>
                        );
                    })}
                </Box>
            </Box>

            {(() => {
                const canEscalateToSelected =
                    selectedLevelIdx > uiCurrentLevelIdx &&
                    selectedLevelIdx !== -1 &&
                    allowedKeys.has(levelSequence[selectedLevelIdx]?.key);

                const renderBanner = (label: string, onClick?: () => void, loading = false) => (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 2,
                            p: 2.5,
                            borderRadius: 2.5,
                            border: '1px solid #E9D5FF',
                            background: 'linear-gradient(180deg,#FFFFFF 0%,#FAF5FF 100%)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9)',
                            flexWrap: 'wrap',
                        }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', background: 'linear-gradient(135deg,#A855F7,#2563EB)', boxShadow: '0 12px 24px rgba(124,58,237,.28)' }}>
                                {loading ? <CircularProgress size={22} color="inherit" /> : <TrendingUp />}
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 900, color: '#111827' }}>
                                    {loading ? 'Escalating...' : 'Ready to widen your search?'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    Escalate to the next audience to find the right candidate.
                                </Typography>
                            </Box>
                        </Stack>
                        {!loading && onClick && (
                            <Button variant="contained" onClick={onClick} sx={{ minWidth: 260, borderRadius: 2 }}>
                                {label}
                            </Button>
                        )}
                    </Box>
                );

                if (escalating) return renderBanner('Escalating...', undefined, true);

                if (canEscalateToSelected) {
                    const targetLevel = levelSequence[selectedLevelIdx];
                    return renderBanner(
                        `Escalate to ${resolveLabel(targetLevel.key, targetLevel.label)}`,
                        () => onEscalate(shift, targetLevel.key)
                    );
                }

                const nextLevel = levelSequence[currentLevelIdx + 1];
                if (nextLevel && allowedKeys.has(nextLevel.key)) {
                    return renderBanner(
                        `Escalate to ${resolveLabel(nextLevel.key, nextLevel.label)}`,
                        () => onEscalate(shift, nextLevel.key)
                    );
                }

                return null;
            })()}
        </Box>
    );
};
