import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function VerifyOTPScreen() {
    const router = useRouter();
    const { verifyOTP, resendOTP, user } = useAuth();

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resending, setResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const inputRefs = useRef<(RNTextInput | null)[]>([]);

    // Cooldown timer for resend
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleOTPChange = (index: number, value: string) => {
        // Only allow numbers
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (index: number, key: string) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const code = otp.join('');

        if (code.length !== 6) {
            setError('Please enter the complete 6-digit code');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await verifyOTP(code);

            // Navigate based on user role - for now, replace with appropriate dashboard route
            // After verification, check onboarding status and navigate accordingly
            if (user?.role === 'OWNER') {
                router.replace('/owner/onboarding/step1');
            } else if (user?.role === 'PHARMACIST') {
                router.replace('/pharmacist/dashboard');
            } else {
                router.replace('/dashboard');
            }
        } catch (err: any) {
            setError(err.message);
            // Clear OTP on error
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setError('');

        try {
            await resendOTP();
            setResendCooldown(60); // 60 second cooldown
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setResending(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Surface style={styles.header} elevation={0}>
                    <Text variant="headlineMedium" style={styles.title}>
                        Verify Your Email
                    </Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        We've sent a 6-digit code to {user?.email}
                    </Text>
                </Surface>

                {error ? (
                    <Surface style={styles.errorContainer} elevation={1}>
                        <Text style={styles.errorText}>{error}</Text>
                    </Surface>
                ) : null}

                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => (inputRefs.current[index] = ref)}
                            value={digit}
                            onChangeText={(value) => handleOTPChange(index, value)}
                            onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                            mode="outlined"
                            style={styles.otpInput}
                            keyboardType="number-pad"
                            maxLength={1}
                            textAlign="center"
                        />
                    ))}
                </View>

                <Button
                    mode="contained"
                    onPress={handleVerify}
                    loading={loading}
                    disabled={loading || otp.join('').length !== 6}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                >
                    Verify
                </Button>

                <View style={styles.resendContainer}>
                    <Text variant="bodyMedium">Didn't receive the code?</Text>
                    {resendCooldown > 0 ? (
                        <Text variant="bodySmall" style={styles.cooldownText}>
                            Resend in {resendCooldown}s
                        </Text>
                    ) : (
                        <Button
                            mode="text"
                            onPress={handleResend}
                            loading={resending}
                            disabled={resending}
                            compact
                        >
                            Resend Code
                        </Button>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        padding: 24,
    },
    header: {
        marginBottom: 32,
        backgroundColor: 'transparent',
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        color: '#666',
    },
    errorContainer: {
        backgroundColor: '#ffebee',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: '#c62828',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
        gap: 8,
    },
    otpInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: 'bold',
        backgroundColor: '#fff',
    },
    button: {
        borderRadius: 8,
        marginBottom: 24,
    },
    buttonContent: {
        paddingVertical: 8,
    },
    resendContainer: {
        alignItems: 'center',
        gap: 4,
    },
    cooldownText: {
        color: '#999',
        marginTop: 4,
    },
});
