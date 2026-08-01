import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { minimumTouchTarget } from '../../src/design-system/theme/tokens';
import { useAppTheme } from '../../src/design-system';
import { tabDestinations } from '../../src/navigation/tab-destinations';

export default function TabLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          minHeight: 60,
        },
        tabBarItemStyle: { minHeight: minimumTouchTarget },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      {tabDestinations.map((destination) => (
        <Tabs.Screen
          key={destination.route}
          name={destination.route}
          options={{
            tabBarAccessibilityLabel: `${destination.title} tab`,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                accessibilityElementsHidden
                color={color}
                name={destination.icon}
                size={size}
              />
            ),
            title: destination.title,
          }}
        />
      ))}
    </Tabs>
  );
}
