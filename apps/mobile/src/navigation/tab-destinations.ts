import type { AppIconName } from '../design-system';

export type TabDestination = Readonly<{
  description: string;
  icon: AppIconName;
  route: 'index' | 'nutrition' | 'profile' | 'progress' | 'workout';
  title: string;
}>;

export const tabDestinations = [
  {
    description: 'Track daily hydration while offline.',
    icon: 'today-outline',
    route: 'index',
    title: 'Today',
  },
  {
    description: 'Record food and caloric beverages while offline.',
    icon: 'nutrition-outline',
    route: 'nutrition',
    title: 'Nutrition',
  },
  {
    description: 'Build an offline exercise library for future workouts.',
    icon: 'barbell-outline',
    route: 'workout',
    title: 'Workout',
  },
  {
    description: 'Progress insights will be introduced in a later phase.',
    icon: 'trending-up-outline',
    route: 'progress',
    title: 'Progress',
  },
  {
    description: 'Profile settings will be introduced in a later phase.',
    icon: 'person-outline',
    route: 'profile',
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
