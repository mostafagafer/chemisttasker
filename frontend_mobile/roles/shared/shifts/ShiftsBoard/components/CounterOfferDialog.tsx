// CounterOfferDialog - Mobile React Native version
// Complex counter offer form with exact web logic adapted for mobile

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, Dialog, Button, Text, TextInput, Checkbox, Card, ActivityIndicator } from 'react-native-paper';
import { Shift } from '@chemisttasker/shared-core';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { CounterOfferFormSlot, TravelLocation } from '../types';
import { getShiftFlexibleTime, getShiftNegotiable, getShiftPharmacyName } from '../utils/shift';

type CounterOfferDialogProps = {
    visible: boolean;
    onDismiss: () => void;
    counterOfferShift: Shift | null;
    counterOfferError: string | null;
    counterOfferSlots: CounterOfferFormSlot[];
    counterOfferTravel: boolean;
    counterOfferTravelLocation: TravelLocation;
    hasCounterOfferTravelLocation: boolean;
    counterSubmitting: boolean;
    counterOfferMessage: string;
    onCounterSlotChange: (index: number, key: keyof CounterOfferFormSlot, value: string) => void;
    onCounterOfferTravelChange: (checked: boolean) => void;
    setCounterOfferTravelLocation: React.Dispatch<React.SetStateAction<TravelLocation>>;
    onClearTravelLocation: () => void;
    onMessageChange: (value: string) => void;
    onSubmit: () => void;
};

const CounterOfferDialog: React.FC<CounterOfferDialogProps> = ({
    visible,
    onDismiss,
    counterOfferShift,
    counterOfferError,
    counterOfferSlots,
    counterOfferTravel,
    counterOfferTravelLocation,
    hasCounterOfferTravelLocation,
    counterSubmitting,
    counterOfferMessage,
    onCounterSlotChange,
    onCounterOfferTravelChange,
    setCounterOfferTravelLocation,
    onClearTravelLocation,
    onMessageChange,
    onSubmit,
}) => (
    <Portal>
        <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
            <Dialog.Title>
                Submit Counter Offer
                {counterOfferShift && (
                    <Text variant="bodySmall" style={styles.pharmacy}>
                        {getShiftPharmacyName(counterOfferShift)}
                    </Text>
                )}
            </Dialog.Title>
            <Dialog.ScrollArea>
                <ScrollView contentContainerStyle={styles.content}>
                    {counterOfferError && (
                        <Text variant="bodyMedium" style={styles.error}>
                            {counterOfferError}
                        </Text>
                    )}
                    {counterOfferShift && (
                        <View style={styles.formContainer}>
                            <Card style={styles.infoCard} mode="outlined">
                                <Card.Content>
                                    <Text variant="bodyMedium">
                                        Negotiation options:{' '}
                                        {getShiftNegotiable(counterOfferShift) ? 'Rate negotiable.' : 'Rate fixed.'}{' '}
                                        {getShiftFlexibleTime(counterOfferShift) ? 'Time flexible.' : 'Time fixed.'}
                                    </Text>
                                </Card.Content>
                            </Card>

                            {counterOfferSlots.map((slot, idx) => (
                                <Card
                                    key={slot.slotId != null ? `${slot.slotId}-${slot.dateLabel || idx}` : `new-${idx}`}
                                    style={styles.slotCard}
                                    mode="outlined"
                                >
                                    <Card.Content>
                                        <Text variant="titleMedium" style={styles.slotTitle}>
                                            {slot.dateLabel}
                                        </Text>
                                        <View style={styles.slotRow}>
                                            <TextInput
                                                label="Start time"
                                                value={slot.startTime}
                                                onChangeText={(value) => onCounterSlotChange(idx, 'startTime', value)}
                                                disabled={!getShiftFlexibleTime(counterOfferShift)}
                                                style={styles.halfInput}
                                                mode="outlined"
                                                dense
                                            />
                                            <TextInput
                                                label="End time"
                                                value={slot.endTime}
                                                onChangeText={(value) => onCounterSlotChange(idx, 'endTime', value)}
                                                disabled={!getShiftFlexibleTime(counterOfferShift)}
                                                style={styles.halfInput}
                                                mode="outlined"
                                                dense
                                            />
                                        </View>
                                        <TextInput
                                            label="Hourly rate"
                                            value={slot.rate}
                                            onChangeText={(value) => onCounterSlotChange(idx, 'rate', value)}
                                            disabled={!getShiftNegotiable(counterOfferShift)}
                                            keyboardType="numeric"
                                            style={styles.rateInput}
                                            mode="outlined"
                                            dense
                                        />
                                    </Card.Content>
                                </Card>
                            ))}

                            {getShiftNegotiable(counterOfferShift) && (
                                <View style={styles.checkboxRow}>
                                    <Checkbox
                                        status={counterOfferTravel ? 'checked' : 'unchecked'}
                                        onPress={() => onCounterOfferTravelChange(!counterOfferTravel)}
                                    />
                                    <Text variant="bodyMedium" style={styles.checkboxLabel}>
                                        Request travel allowance
                                    </Text>
                                </View>
                            )}

                            {counterOfferTravel && (
                                <Card style={styles.travelCard} mode="outlined">
                                    <Card.Content>
                                        <Text variant="titleSmall" style={styles.travelTitle}>
                                            Traveling from
                                        </Text>
                                        {!hasCounterOfferTravelLocation ? (
                                            <GooglePlacesAutocomplete
                                                placeholder="Search Address"
                                                onPress={(data, details = null) => {
                                                    if (details) {
                                                        let streetNumber = '';
                                                        let route = '';
                                                        let locality = '';
                                                        let postalCode = '';
                                                        let stateShort = '';

                                                        details.address_components?.forEach((component) => {
                                                            const types = component.types;
                                                            if (types.includes('street_number')) streetNumber = component.long_name;
                                                            if (types.includes('route')) route = component.short_name;
                                                            if (types.includes('locality')) locality = component.long_name;
                                                            if (types.includes('postal_code')) postalCode = component.long_name;
                                                            if (types.includes('administrative_area_level_1'))
                                                                stateShort = component.short_name;
                                                        });

                                                        setCounterOfferTravelLocation({
                                                            streetAddress: `${streetNumber} ${route}`.trim(),
                                                            suburb: locality,
                                                            postcode: postalCode,
                                                            state: stateShort,
                                                            googlePlaceId: details.place_id || '',
                                                            latitude: details.geometry?.location.lat ?? null,
                                                            longitude: details.geometry?.location.lng ?? null,
                                                        });
                                                    }
                                                }}
                                                query={{
                                                    key: process.env.EXPO_PUBLIC_ANDROID_PLACES || '',
                                                    language: 'en',
                                                    components: 'country:au',
                                                }}
                                                styles={{
                                                    container: { flex: 0 },
                                                    textInput: styles.placesInput,
                                                }}
                                                fetchDetails
                                            />
                                        ) : (
                                            <View style={styles.addressForm}>
                                                <TextInput
                                                    label="Street Address"
                                                    value={counterOfferTravelLocation.streetAddress}
                                                    onChangeText={(value) =>
                                                        setCounterOfferTravelLocation((prev) => ({
                                                            ...prev,
                                                            streetAddress: value,
                                                        }))
                                                    }
                                                    style={styles.addressInput}
                                                    mode="outlined"
                                                    dense
                                                />
                                                <TextInput
                                                    label="Suburb"
                                                    value={counterOfferTravelLocation.suburb}
                                                    onChangeText={(value) =>
                                                        setCounterOfferTravelLocation((prev) => ({
                                                            ...prev,
                                                            suburb: value,
                                                        }))
                                                    }
                                                    style={styles.addressInput}
                                                    mode="outlined"
                                                    dense
                                                />
                                                <TextInput
                                                    label="State"
                                                    value={counterOfferTravelLocation.state}
                                                    onChangeText={(value) =>
                                                        setCounterOfferTravelLocation((prev) => ({
                                                            ...prev,
                                                            state: value,
                                                        }))
                                                    }
                                                    style={styles.addressInput}
                                                    mode="outlined"
                                                    dense
                                                />
                                                <TextInput
                                                    label="Postcode"
                                                    value={counterOfferTravelLocation.postcode}
                                                    onChangeText={(value) =>
                                                        setCounterOfferTravelLocation((prev) => ({
                                                            ...prev,
                                                            postcode: value,
                                                        }))
                                                    }
                                                    style={styles.addressInput}
                                                    mode="outlined"
                                                    dense
                                                />
                                                <Button mode="text" onPress={onClearTravelLocation} style={styles.clearButton}>
                                                    Clear Address & Search Again
                                                </Button>
                                            </View>
                                        )}
                                    </Card.Content>
                                </Card>
                            )}

                            <TextInput
                                label="Message"
                                value={counterOfferMessage}
                                onChangeText={onMessageChange}
                                multiline
                                numberOfLines={3}
                                style={styles.messageInput}
                                mode="outlined"
                            />
                        </View>
                    )}
                </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
                <Button onPress={onDismiss}>Cancel</Button>
                <Button
                    mode="contained"
                    onPress={onSubmit}
                    disabled={!counterOfferShift || counterSubmitting}
                    loading={counterSubmitting}
                >
                    {counterSubmitting ? 'Sending...' : 'Send Offer'}
                </Button>
            </Dialog.Actions>
        </Dialog>
    </Portal>
);

const styles = StyleSheet.create({
    dialog: {
        maxHeight: '90%',
    },
    pharmacy: {
        marginTop: 4,
        color: '#666',
    },
    content: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    error: {
        color: '#d32f2f',
        marginBottom: 12,
    },
    formContainer: {
        gap: 16,
    },
    infoCard: {
        backgroundColor: '#f5f5f5',
    },
    slotCard: {
        marginVertical: 8,
    },
    slotTitle: {
        marginBottom: 12,
    },
    slotRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    halfInput: {
        flex: 1,
    },
    rateInput: {
        marginTop: 8,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
    },
    checkboxLabel: {
        marginLeft: 8,
    },
    travelCard: {
        marginVertical: 8,
    },
    travelTitle: {
        marginBottom: 12,
    },
    placesInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 12,
    },
    addressForm: {
        gap: 12,
        marginTop: 12,
    },
    addressInput: {
        marginVertical: 4,
    },
    clearButton: {
        marginTop: 8,
    },
    messageInput: {
        marginTop: 12,
    },
});

export default CounterOfferDialog;
