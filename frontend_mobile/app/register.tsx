import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Checkbox,
  RadioButton,
  Surface,
  Divider,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { label: 'Pharmacy Owner', value: 'OWNER', icon: 'storefront', color: '#4f46e5' },
  { label: 'Pharmacist', value: 'PHARMACIST', icon: 'local-pharmacy', color: '#0ea5e9' },
  {
    label: 'Other Staff (Intern, Technician, Assistant, Student)',
    value: 'OTHER_STAFF',
    icon: 'badge',
    color: '#22c55e',
  },
  { label: 'Explorer (Shadowing/Volunteering)', value: 'EXPLORER', icon: 'travel-explore', color: '#f97316' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'PHARMACIST',
    accepted_terms: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    setError('');

    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.accepted_terms) {
      setError('Please accept the terms and conditions');
      return;
    }

    setLoading(true);
    try {
      await register({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        accepted_terms: formData.accepted_terms,
      });
      router.replace('/verify-otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f7f9fb', '#eef1f7']} style={styles.gradient} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Surface style={styles.card} elevation={2}>
            <View style={styles.logoRow}>
              <Image
                source={require('../assets/images/chemisttasker-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <View>
                <Text variant="headlineSmall" style={styles.title}>Create Account</Text>
                <Text variant="bodySmall" style={styles.subtitle}>Join ChemistTasker today</Text>
              </View>
            </View>

            {error ? (
              <Surface style={styles.errorContainer} elevation={1}>
                <Text style={styles.errorText}>{error}</Text>
              </Surface>
            ) : null}

            <View style={styles.form}>
              <TextInput
                label="First Name"
                value={formData.first_name}
                onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                mode="outlined"
                style={styles.input}
                autoCapitalize="words"
              />

              <TextInput
                label="Last Name"
                value={formData.last_name}
                onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                mode="outlined"
                style={styles.input}
                autoCapitalize="words"
              />

              <TextInput
                label="Email"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                mode="outlined"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                label="Password"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                mode="outlined"
                style={styles.input}
                secureTextEntry={!showPassword}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />

              <TextInput
                label="Confirm Password"
                value={formData.confirm_password}
                onChangeText={(text) => setFormData({ ...formData, confirm_password: text })}
                mode="outlined"
                style={styles.input}
                secureTextEntry={!showPassword}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />

              <Divider style={styles.divider} />

              <Text variant="titleSmall" style={styles.sectionTitle}>I am a:</Text>
              <View style={styles.roleGrid}>
                {ROLE_OPTIONS.map((option) => {
                  const isSelected = formData.role === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.roleCard,
                        { borderColor: isSelected ? option.color : '#e5e7eb' },
                        isSelected && { backgroundColor: '#f8fafc' },
                      ]}
                      activeOpacity={0.85}
                      onPress={() => setFormData({ ...formData, role: option.value })}
                    >
                      <View style={styles.roleHeader}>
                        <View style={[styles.roleIconWrap, { backgroundColor: `${option.color}1A` }]}>
                          <MaterialIcons name={option.icon as any} size={22} color={option.color} />
                        </View>
                        <RadioButton
                          value={option.value}
                          status={isSelected ? 'checked' : 'unchecked'}
                          onPress={() => setFormData({ ...formData, role: option.value })}
                          color={option.color}
                        />
                      </View>
                      <Text style={styles.radioLabel}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Divider style={styles.divider} />

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={formData.accepted_terms ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, accepted_terms: !formData.accepted_terms })}
                />
                <Text style={styles.checkboxLabel}>
                  I accept the Terms of Service and Privacy Policy
                </Text>
              </View>

              <Button
                mode="contained"
                onPress={handleRegister}
                loading={loading}
                disabled={loading}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                Create Account
              </Button>

              <Button
                mode="text"
                onPress={() => router.back()}
                style={styles.backButton}
                labelStyle={styles.linkLabel}
              >
                Already have an account? Login
              </Button>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
    position: 'relative',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logoImage: {
    width: 160,
    height: 48,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
    color: '#0f172a',
  },
  subtitle: {
    color: '#4b5563',
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
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: '#fff',
  },
  divider: {
    marginVertical: 8,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '600',
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  radioLabel: {
    marginTop: 6,
    color: '#111827',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkboxLabel: {
    marginLeft: 8,
    flex: 1,
  },
  button: {
    marginTop: 16,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  backButton: {
    marginTop: 8,
  },
  linkLabel: {
    textTransform: 'none',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  roleCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
