import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Surface, RadioButton, Divider, Chip, Menu } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates';
import apiClient from '../../utils/apiClient';

interface Pharmacy {
    id: number;
    name: string;
}

export default function PostShiftScreen() {
    const router = useRouter();

    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [formData, setFormData] = useState({
        pharmacy: '',
        shift_date: new Date(),
        start_time: '09:00',
        end_time: '17:00',
        role: 'PHARMACIST',
        hourly_rate: '',
        description: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [showPharmacyMenu, setShowPharmacyMenu] = useState(false);

    React.useEffect(() => {
        fetchPharmacies();
    }, []);

    const fetchPharmacies = async () => {
        try {
            const response = await apiClient.get('/client-profile/pharmacies/');
            setPharmacies(response.data);
        } catch (error) {
            console.error('Error fetching pharmacies:', error);
        }
    };

    const handleSubmit = async () => {
        setError('');

        if (!formData.pharmacy || !formData.hourly_rate) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const submitData = {
                pharmacy: formData.pharmacy,
                shift_date: formData.shift_date.toISOString().split('T')[0],
                start_time: formData.start_time,
                end_time: formData.end_time,
                role: formData.role,
                hourly_rate: parseFloat(formData.hourly_rate),
                description: formData.description,
            };

            await apiClient.post('/client-profile/shifts/', submitData);

            Alert.alert('Success', 'Shift posted successfully!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (err: any) {
            const errorMsg = err.response?.data?.detail || 'Failed to create shift';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const selectedPharmacy = pharmacies.find(p => p.id.toString() === formData.pharmacy);

    const roles = [
        { value: 'PHARMACIST', label: 'Pharmacist', icon: 'account-tie' },
        { value: 'INTERN', label: 'Pharmacy Technician', icon: 'school' },
        { value: 'DISPENSER', label: 'Dispenser', icon: 'pill' },
        { value: 'ASSISTANT', label: 'Counter Assistant', icon: 'account' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text variant="headlineSmall" style={styles.title}>Post a Shift</Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Fill in the details below
                    </Text>
                </View>

                {/* Info Banner */}
                <Surface style={styles.infoBanner}>
                    <Text variant="bodySmall" style={styles.infoText}>
                        ℹ️ Post your shift and it will be visible to qualified locums in your area instantly.
                    </Text>
                </Surface>

                {error ? (
                    <Surface style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </Surface>
                ) : null}

                {/* Pharmacy Selection */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Pharmacy Details</Text>

                    <Text variant="labelMedium" style={styles.label}>Pharmacy *</Text>
                    <Menu
                        visible={showPharmacyMenu}
                        onDismiss={() => setShowPharmacyMenu(false)}
                        anchor={
                            <Button
                                mode="outlined"
                                onPress={() => setShowPharmacyMenu(true)}
                                icon="store"
                                style={styles.selectButton}
                                contentStyle={styles.selectButtonContent}
                            >
                                {selectedPharmacy?.name || 'Select pharmacy'}
                            </Button>
                        }
                    >
                        {pharmacies.map((pharmacy) => (
                            <Menu.Item
                                key={pharmacy.id}
                                onPress={() => {
                                    setFormData({ ...formData, pharmacy: pharmacy.id.toString() });
                                    setShowPharmacyMenu(false);
                                }}
                                title={pharmacy.name}
                            />
                        ))}
                    </Menu>

                    {pharmacies.length === 0 && (
                        <Text variant="bodySmall" style={styles.helperText}>
                            No pharmacies found. Add a pharmacy first.
                        </Text>
                    )}
                </View>

                {/* Role Selection */}
                <View style={styles.section}>
                    <Text variant="labelMedium" style={styles.label}>Role *</Text>
                    <View style={styles.rolesGrid}>
                        {roles.map((role) => (
                            <Surface
                                key={role.value}
                                style={[
                                    styles.roleCard,
                                    formData.role === role.value && styles.roleCardSelected
                                ]}
                                onTouchEnd={() => setFormData({ ...formData, role: role.value })}
                            >
                                <Chip
                                    icon={role.icon}
                                    selected={formData.role === role.value}
                                    style={styles.roleIcon}
                                    textStyle={styles.roleIconText}
                                >
                                    {' '}
                                </Chip>
                                <Text variant="bodyMedium" style={styles.roleLabel}>
                                    {role.label}
                                </Text>
                            </Surface>
                        ))}
                    </View>
                </View>

                {/* Schedule */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Schedule</Text>

                    <Text variant="labelMedium" style={styles.label}>Date *</Text>
                    <Button
                        mode="outlined"
                        onPress={() => setShowDatePicker(true)}
                        icon="calendar"
                        style={styles.dateButton}
                        contentStyle={styles.selectButtonContent}
                    >
                        {formData.shift_date.toLocaleDateString('en-GB')}
                    </Button>

                    <View style={styles.timeRow}>
                        <View style={styles.timeField}>
                            <Text variant="labelMedium" style={styles.label}>Start Time *</Text>
                            <TextInput
                                value={formData.start_time}
                                onChangeText={(text) => setFormData({ ...formData, start_time: text })}
                                mode="outlined"
                                left={<TextInput.Icon icon="clock-outline" />}
                                style={styles.input}
                            />
                        </View>

                        <View style={styles.timeField}>
                            <Text variant="labelMedium" style={styles.label}>End Time *</Text>
                            <TextInput
                                value={formData.end_time}
                                onChangeText={(text) => setFormData({ ...formData, end_time: text })}
                                mode="outlined"
                                left={<TextInput.Icon icon="clock-outline" />}
                                style={styles.input}
                            />
                        </View>
                    </View>
                </View>

                {/* Compensation */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Compensation</Text>

                    <Text variant="labelMedium" style={styles.label}>Hourly Rate *</Text>
                    <TextInput
                        value={formData.hourly_rate}
                        onChangeText={(text) => setFormData({ ...formData, hourly_rate: text })}
                        mode="outlined"
                        keyboardType="decimal-pad"
                        left={<TextInput.Icon icon="currency-gbp" />}
                        right={<TextInput.Affix text="/hr" />}
                        style={styles.input}
                        placeholder="45.00"
                    />
                </View>

                {/* Additional Info */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Additional Information</Text>

                    <Text variant="labelMedium" style={styles.label}>Notes (Optional)</Text>
                    <TextInput
                        value={formData.description}
                        onChangeText={(text) => setFormData({ ...formData, description: text })}
                        mode="outlined"
                        multiline
                        numberOfLines={4}
                        style={styles.input}
                        placeholder="Add any special requirements or notes..."
                    />
                </View>

                {/* Submit Buttons */}
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
                        Post Shift
                    </Button>
                </View>
            </ScrollView>

            {/* Date Picker */}
            <DatePickerModal
                locale="en-GB"
                mode="single"
                visible={showDatePicker}
                onDismiss={() => setShowDatePicker(false)}
                date={formData.shift_date}
                onConfirm={(params) => {
                    setShowDatePicker(false);
                    if (params.date) {
                        setFormData({ ...formData, shift_date: params.date });
                    }
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        color: '#6B7280',
    },
    infoBanner: {
        backgroundColor: '#E0E7FF',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    infoText: {
        color: '#6366F1',
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: '#EF4444',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 16,
        color: '#111827',
    },
    label: {
        marginBottom: 8,
        color: '#374151',
    },
    selectButton: {
        borderRadius: 8,
        borderColor: '#D1D5DB',
    },
    selectButtonContent: {
        justifyContent: 'flex-start',
        paddingVertical: 8,
    },
    helperText: {
        color: '#6B7280',
        marginTop: 4,
    },
    rolesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    roleCard: {
        width: '48%',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    roleCardSelected: {
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
    },
    roleIcon: {
        marginBottom: 8,
    },
    roleIconText: {
        fontSize: 12,
    },
    roleLabel: {
        textAlign: 'center',
        color: '#111827',
    },
    dateButton: {
        borderRadius: 8,
        borderColor: '#D1D5DB',
    },
    timeRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    timeField: {
        flex: 1,
    },
    input: {
        backgroundColor: '#FFFFFF',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    button: {
        flex: 1,
        borderRadius: 8,
    },
    submitButton: {
        flex: 2,
    },
});
