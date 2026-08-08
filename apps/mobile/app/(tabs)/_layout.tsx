import { Tabs } from 'expo-router';
import {
  AppIcon,
  minimumTouchTarget,
  typography,
  useAppTheme,
} from '../../src/design-system';
import { tabDestinations } from '../../src/navigation/tab-destinations';

export default function TabLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          minHeight: 60,
        },
        tabBarItemStyle: { minHeight: minimumTouchTarget },
        tabBarLabelStyle: typography.caption,
      }}
    >
      {tabDestinations.map((destination) => (
        <Tabs.Screen
          key={destination.route}
          name={destination.route}
          options={{
            tabBarAccessibilityLabel: `${destination.title} tab`,
            tabBarButtonTestID: destination.testID,
            tabBarIcon: ({ color, size }) => (
              <AppIcon
                color={color}
                name={destination.icon}
                size={size <= 20 ? 'medium' : 'large'}
              />
            ),
            title: destination.title,
          }}
        />
      ))}
    </Tabs>
  );
}
