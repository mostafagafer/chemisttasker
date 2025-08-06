import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Home Screen (ChemistTasker Mobile)</Text>
      <Button
        title="Go to Login"
        onPress={() => router.push('/login')}
      />
    </View>
  );
}
