import React from 'react';
import {
    Box,
    Stepper,
    Step,
    StepLabel,
    ButtonBase,
    Typography,
    Button,
    CircularProgress,
    styled,
} from '@mui/material';
import { StepConnector, stepConnectorClasses } from '@mui/material';
import {
    People,
    Favorite,
    Store,
    CorporateFare,
    Public,
} from '@mui/icons-material';
import { ColorStepIcon } from '../StepIcon/ColorStepIcon';
import { Shift } from '@chemisttasker/shared-core';
import { useTheme } from '@mui/material/styles';

const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.alternativeLabel}`]: {
        top: 22,
    },
    [`&.${stepConnectorClasses.active}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            borderColor: theme.palette.primary.main,
        },
    },
    [`&.${stepConnectorClasses.completed}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            borderColor: theme.palette.primary.main,
        },
    },
    [`& .${stepConnectorClasses.line}`]: {
        borderColor: '#E5E7EB',
        borderTopWidth: 3,
        borderRadius: 1,
    },
}));

type EscalationLevelKey = 'FULL_PART_TIME' | 'LOCUM_CASUAL' | 'OWNER_CHAIN' | 'ORG_CHAIN' | 'PLATFORM';

const ESCALATION_LEVELS: Array<{
    key: EscalationLevelKey;
    label: string;
    icon: React.ElementType;
    requiresOrganization?: boolean;
}> = [
        { key: 'FULL_PART_TIME', label: 'My Pharmacy', icon: People },
        { key: 'LOCUM_CASUAL', label: 'Favourites', icon: Favorite },
        { key: 'OWNER_CHAIN', label: 'Chain', icon: Store },
        { key: 'ORG_CHAIN', label: 'Organization', icon: CorporateFare, requiresOrganization: true },
        { key: 'PLATFORM', label: 'Platform', icon: Public },
    ];

interface EscalationStepperProps {
    shift: Shift;
    currentLevel: EscalationLevelKey;
    selectedLevel: EscalationLevelKey;
    onSelectLevel: (levelKey: EscalationLevelKey) => void;
    onEscalate: (shift: Shift, levelKey: EscalationLevelKey) => void;
    escalating?: boolean;
}

export const EscalationStepper: React.FC<EscalationStepperProps> = ({
    shift,
    currentLevel,
    selectedLevel,
    onSelectLevel,
    onEscalate,
    escalating,
}) => {
    const theme = useTheme();
    const allowedKeys = new Set((shift as any).allowedEscalationLevels || []);
    if (!allowedKeys.size) {
        ESCALATION_LEVELS.forEach((level) => allowedKeys.add(level.key));
    }

    const levelSequence = ESCALATION_LEVELS.filter((level) => allowedKeys.has(level.key));
    const currentLevelIdx = Math.max(
        0,
        levelSequence.findIndex((level) => level.key === currentLevel)
    );
    const selectedLevelIdx = levelSequence.findIndex((level) => level.key === selectedLevel);

    return (
        <Box>
            <Stepper
                alternativeLabel
                activeStep={currentLevelIdx}
                connector={<CustomStepConnector />}
                sx={{ mb: 3 }}
            >
                {levelSequence.map((level, idx) => {
                    const levelPassed = idx <= currentLevelIdx;
                    const levelSelectable = idx <= currentLevelIdx + 1 && allowedKeys.has(level.key);
                    const levelViewable = idx <= currentLevelIdx;

                    return (
                        <Step key={level.key} completed={levelPassed && idx < currentLevelIdx}>
                            {(() => {
                                const stepContent = (
                                    <StepLabel
                                        StepIconComponent={(props) => (
                                            <ColorStepIcon {...props} icon={level.icon} />
                                        )}
                                        sx={{
                                            flexDirection: 'column',
                                            '& .MuiStepLabel-label': {
                                                mt: 1.5,
                                                fontWeight: 500,
                                                color:
                                                    levelViewable
                                                        ? selectedLevel === level.key
                                                            ? theme.palette.primary.main
                                                            : theme.palette.text.secondary
                                                        : theme.palette.text.disabled,
                                        },
                                    }}
                                >
                                    {level.label}
                                    </StepLabel>
                                );

                                if (!levelSelectable) return stepContent;

                                return (
                                    <ButtonBase
                                        onClick={() => onSelectLevel(level.key)}
                                        disabled={!levelSelectable}
                                        sx={{ width: '100%', pt: 2, borderRadius: 2, transition: 'background-color 0.3s' }}
                                    >
                                        {stepContent}
                                    </ButtonBase>
                                );
                            })()}
                        </Step>
                    );
                })}
            </Stepper>

            {/* Escalation Button Logic */}
            {(() => {
                const canEscalateToSelected =
                    selectedLevelIdx > currentLevelIdx &&
                    selectedLevelIdx !== -1 &&
                    allowedKeys.has(levelSequence[selectedLevelIdx]?.key);

                if (escalating) {
                    return (
                        <Box
                            sx={{
                                py: 2,
                                textAlign: 'center',
                                bgcolor: '#F9FAFB',
                                borderRadius: 2,
                                border: '1px dashed #E5E7EB',
                            }}
                        >
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            Escalating...
                        </Box>
                    );
                }

                if (canEscalateToSelected) {
                    const targetLevel = levelSequence[selectedLevelIdx];
                    return (
                        <Box
                            sx={{
                                py: 2,
                                textAlign: 'center',
                                bgcolor: '#F9FAFB',
                                borderRadius: 2,
                                border: '1px dashed #E5E7EB',
                            }}
                        >
                            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                                Ready to widen your search?
                            </Typography>
                            <Button variant="contained" onClick={() => onEscalate(shift, targetLevel.key)}>
                                Escalate to {targetLevel.label}
                            </Button>
                        </Box>
                    );
                }

                const nextLevel = levelSequence[currentLevelIdx + 1];
                if (nextLevel && allowedKeys.has(nextLevel.key)) {
                    return (
                        <Box
                            sx={{
                                py: 2,
                                textAlign: 'center',
                                bgcolor: '#F9FAFB',
                                borderRadius: 2,
                                border: '1px dashed #E5E7EB',
                            }}
                        >
                            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                                Ready to widen your search?
                            </Typography>
                            <Button variant="contained" onClick={() => onEscalate(shift, nextLevel.key)}>
                                Escalate to {nextLevel.label}
                            </Button>
                        </Box>
                    );
                }

                return null;
            })()}
        </Box>
    );
};
