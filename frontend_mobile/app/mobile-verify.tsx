import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput, Button, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import {
    mobileRequestOtp,
    mobileVerifyOtp,
    mobileResendOtp,
} from '@chemisttasker/shared-core';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function MobileVerifyScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');

    const getRoleHome = (role?: string | null): string => {
        const normalized = String(role || '').toUpperCase();
        switch (normalized) {
            case 'OWNER': return '/owner/dashboard';
            case 'PHARMACIST': return '/pharmacist/dashboard';
            case 'OTHER_STAFF': return '/otherstaff/dashboard';
            case 'EXPLORER': return '/explorer/dashboard';
            case 'ORGANIZATION': return '/organization';
            default: return '/login';
        }
    };

    const requestCode = async () => {
        setError('');
        setStatus('');
        if (!mobile) {
            setError('Please enter your mobile number.');
            return;
        }
        setLoading(true);
        try {
            await mobileRequestOtp({ mobile_number: mobile });
            setStatus('We sent a code to your mobile.');
        } catch (err: any) {
            setError(err?.message || 'Failed to send code.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setError('');
        setStatus('');
        if (!otp) {
            setError('Please enter the OTP code.');
            return;
        }
        setLoading(true);
        try {
            await mobileVerifyOtp({ otp });
            setStatus('Mobile verified! Redirecting...');
            setTimeout(() => router.replace(getRoleHome(user?.role) as any), 800);
        } catch (err: any) {
            setError(err?.message || 'Verification failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError('');
        setStatus('');
        setLoading(true);
        try {
            await mobileResendOtp({});
            setStatus('A new code has been sent to your mobile.');
        } catch (err: any) {
            setError(err?.message || 'Could not resend code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Mobile Verification">
            {error ? (
                <Surface style={styles.errorContainer} elevation={1}>
                    <Text style={styles.errorText}>{error}</Text>
                </Surface>
            ) : null}

            {status ? (
                <Surface style={styles.successContainer} elevation={1}>
                    <Text style={styles.successText}>{status}</Text>
                </Surface>
            ) : null}

            <TextInput
                label="Mobile Number"
                value={mobile}
                onChangeText={setMobile}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="e.g. 0412 345 678"
            />

            <Button
                mode="outlined"
                onPress={requestCode}
                loading={loading}
                disabled={loading || !mobile}
                style={styles.outlinedButton}
                contentStyle={styles.buttonContent}
            >
                Send Code
            </Button>

            <TextInput
                label="Enter OTP Code"
                value={otp}
                onChangeText={setOtp}
                mode="outlined"
                style={styles.input}
                keyboardType="number-pad"
            />

            <Button
                mode="contained"
                onPress={handleVerify}
                loading={loading}
                disabled={loading || !otp}
                style={styles.button}
                contentStyle={styles.buttonContent}
            >
                Verify
            </Button>

            <View style={styles.resendRow}>
                <Button
                    mode="text"
                    onPress={handleResend}
                    disabled={loading}
                    compact
                >
                    Resend Code
                </Button>
            </View>

            <View style={styles.backRow}>
                <Button mode="text" onPress={() => router.back()} style={styles.backButton}>
                    Back to login
                </Button>
            </View>
        </AuthLayout>
    );
}

const styles = StyleSheet.create({
    input: {
        backgroundColor: '#fff',
    },
    button: {
        marginTop: 4,
        borderRadius: 8,
    },
    outlinedButton: {
        borderRadius: 8,
        borderColor: '#00a99d',
    },
    buttonContent: {
        paddingVertical: 8,
    },
    resendRow: {
        alignItems: 'center',
        marginTop: 4,
    },
    backRow: {
        alignItems: 'center',
    },
    backButton: {
        marginTop: 4,
    },
    errorContainer: {
        backgroundColor: '#ffebee',
        padding: 12,
        borderRadius: 8,
    },
    errorText: {
        color: '#c62828',
    },
    successContainer: {
        backgroundColor: '#ecfdf3',
        padding: 12,
        borderRadius: 8,
    },
    successText: {
        color: '#166534',
    },
});
