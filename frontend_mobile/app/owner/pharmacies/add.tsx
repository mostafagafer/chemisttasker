import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, TextInput, Button, Surface, RadioButton, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createPharmacy } from '@chemisttasker/shared-core';

export default function AddPharmacyScreen() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        street_address: '',
        suburb: '',
        state: 'NSW',
        postcode: '',
        abn: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

    const handleSubmit = async () => {
        setError('');

        // Validation
        if (!formData.name || !formData.street_address || !formData.suburb || !formData.postcode) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            await createPharmacy(formData as any);

            Alert.alert(
                'Success',
                'Pharmacy added successfully!',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (err: any) {
            const errorMsg = err.response?.data?.detail ||
                err.response?.data?.name?.[0] ||
                'Failed to add pharmacy';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    <Surface style={styles.header} elevation={0}>
                        <Text variant="headlineSmall" style={styles.title}>
                            Add New Pharmacy
                        </Text>
                        <Text variant="bodyMedium" style={styles.subtitle}>
                            Enter your pharmacy details
                        </Text>
                    </Surface>

                    {error ? (
                        <Surface style={styles.errorContainer} elevation={1}>
                            <Text style={styles.errorText}>{error}</Text>
                        </Surface>
                    ) : null}

                    <Surface style={styles.formContainer} elevation={1}>
                        <View style={styles.form}>
                            <TextInput
                                label="Pharmacy Name *"
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                                mode="outlined"
                                style={styles.input}
                                placeholder="e.g., City Care Pharmacy"
                            />

                            <TextInput
                                label="Email"
                                value={formData.email}
                                onChangeText={(text) => setFormData({ ...formData, email: text })}
                                mode="outlined"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholder="pharmacy@example.com"
                            />

                            <Divider style={styles.divider} />

                            <Text variant="titleSmall" style={styles.sectionTitle}>Address</Text>

                            <TextInput
                                label="Street Address *"
                                value={formData.street_address}
                                onChangeText={(text) => setFormData({ ...formData, street_address: text })}
                                mode="outlined"
                                style={styles.input}
                                placeholder="123 Main Street"
                            />

                            <TextInput
                                label="Suburb *"
                                value={formData.suburb}
                                onChangeText={(text) => setFormData({ ...formData, suburb: text })}
                                mode="outlined"
                                style={styles.input}
                                placeholder="Sydney"
                            />

                            <View style={styles.stateSection}>
                                <Text variant="bodySmall" style={styles.label}>State *</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <RadioButton.Group
                                        onValueChange={(value) => setFormData({ ...formData, state: value })}
                                        value={formData.state}
                                    >
                                        <View style={styles.stateRadioContainer}>
                                            {STATES.map((state) => (
                                                <View key={state} style={styles.stateRadio}>
                                                    <RadioButton value={state} />
                                                    <Text>{state}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </RadioButton.Group>
                                </ScrollView>
                            </View>

                            <TextInput
                                label="Postcode *"
                                value={formData.postcode}
                                onChangeText={(text) => setFormData({ ...formData, postcode: text })}
                                mode="outlined"
                                style={styles.input}
                                keyboardType="number-pad"
                                maxLength={4}
                                placeholder="2000"
                            />

                            <Divider style={styles.divider} />

                            <TextInput
                                label="ABN"
                                value={formData.abn}
                                onChangeText={(text) => setFormData({ ...formData, abn: text })}
                                mode="outlined"
                                style={styles.input}
                                keyboardType="number-pad"
                                maxLength={14}
                                placeholder="12 345 678 901"
                            />
                        </View>
                    </Surface>

                    <View style={styles.buttonContainer}>
                        <Button
                            mode="outlined"
                            onPress={() => router.back()}
                            disabled={loading}
                            style={styles.button}
                        >
                            Cancel
                        </Button>

                        <Button
                            mode="contained"
                            onPress={handleSubmit}
                            loading={loading}
                            disabled={loading}
                            style={[styles.button, styles.submitButton]}
                        >
                            Add Pharmacy
                        </Button>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    header: {
        padding: 20,
        borderRadius: 8,
        backgroundColor: 'transparent',
        marginBottom: 16,
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 4,
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
    formContainer: {
        padding: 20,
        borderRadius: 8,
        backgroundColor: '#fff',
        marginBottom: 16,
    },
    form: {
        gap: 16,
    },
    input: {
        backgroundColor: '#fff',
    },
    divider: {
        marginVertical: 8,
    },
    sectionTitle: {
        fontWeight: '600',
        marginTop: 8,
    },
    stateSection: {
        marginVertical: 8,
    },
    label: {
        marginBottom: 8,
        color: '#666',
    },
    stateRadioContainer: {
        flexDirection: 'row',
        gap: 4,
    },
    stateRadio: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    button: {
        flex: 1,
    },
    submitButton: {
        flex: 2,
    },
});
