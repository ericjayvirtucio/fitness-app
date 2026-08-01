import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { iconSizes } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

export type AppIconName = ComponentProps<typeof Ionicons>['name'];
export type AppIconSize = keyof typeof iconSizes;

type AppIconProps = Omit<ComponentProps<typeof Ionicons>, 'color' | 'size'> &
  Readonly<{
    color?: ColorValue;
    size?: AppIconSize;
  }>;

export function AppIcon({
  accessibilityLabel,
  color,
  size = 'medium',
  ...props
}: AppIconProps) {
  const theme = useAppTheme();
  const isAccessible = Boolean(accessibilityLabel);

  return (
    <Ionicons
      accessibilityElementsHidden={!isAccessible}
      accessibilityLabel={accessibilityLabel}
      accessible={isAccessible}
      color={color ?? theme.colors.textPrimary}
      importantForAccessibility={isAccessible ? 'auto' : 'no-hide-descendants'}
      size={iconSizes[size]}
      {...props}
    />
  );
}
