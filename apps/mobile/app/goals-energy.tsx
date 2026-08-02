import { router } from 'expo-router';
import { GoalsEnergyScreen } from '../src/features/goals-energy/presentation/GoalsEnergyScreen';

export default function GoalsEnergyRoute() {
  return (
    <GoalsEnergyScreen
      onBack={() => router.back()}
      onEditProfile={() => router.replace('/(tabs)/profile')}
    />
  );
}
