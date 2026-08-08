import type { AppIconName } from '../design-system';

export type TabDestination = Readonly<{
  description: string;
  icon: AppIconName;
  route: 'index' | 'nutrition' | 'profile' | 'progress' | 'workout';
  testID: string;
  title: string;
}>;

export const tabDestinations = [
  {
    description: 'Track daily hydration while offline.',
    icon: 'today-outline',
    route: 'index',
    testID: 'tab-today',
    title: 'Today',
  },
  {
    description: 'Record food and caloric beverages while offline.',
    icon: 'nutrition-outline',
    route: 'nutrition',
    testID: 'tab-nutrition',
    title: 'Nutrition',
  },
  {
    description: 'Build an offline exercise library for future workouts.',
    icon: 'barbell-outline',
    route: 'workout',
    testID: 'tab-workout',
    title: 'Workout',
  },
  {
    description: 'Progress insights will be introduced in a later phase.',
    icon: 'trending-up-outline',
    route: 'progress',
    testID: 'tab-progress',
    title: 'Progress',
  },
  {
    description: 'Profile settings will be introduced in a later phase.',
    icon: 'person-outline',
    route: 'profile',
    testID: 'tab-profile',
    title: 'Profile',
  },
] as const satisfies readonly TabDestination[];

export function getTabDestination(
  route: TabDestination['route'],
): TabDestination {
  const destination = tabDestinations.find((item) => item.route === route);

  if (!destination) {
    throw new Error(`Unknown tab destination: ${route}`);
  }

  return destination;
}
