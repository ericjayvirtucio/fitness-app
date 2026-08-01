import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  borderWidths,
  minimumTouchTarget,
  opacity,
  radii,
  spacing,
} from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

export type CardVariant = 'filled' | 'outlined' | 'elevated';

type CardProps = Readonly<{
  accessibilityLabel?: string;
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: CardVariant;
}>;

export function Card({
  accessibilityLabel,
  children,
  onPress,
  style,
  testID,
  variant = 'filled',
}: CardProps) {
  const theme = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const variantStyle: ViewStyle = {
    backgroundColor:
      variant === 'filled' ? theme.colors.surfaceVariant : theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: variant === 'outlined' ? borderWidths.thin : borderWidths.none,
    ...(variant === 'elevated' ? theme.elevations.raised : {}),
  };

  if (!onPress) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={[styles.card, variantStyle, style]}
        testID={testID}
      >
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.interactive,
        variantStyle,
        isFocused && {
          borderColor: theme.colors.focus,
          borderWidth: borderWidths.strong,
        },
        pressed && { opacity: opacity.pressed },
        style,
      ]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.large,
    gap: spacing.md,
    padding: spacing.lg,
  },
  interactive: {
    minHeight: minimumTouchTarget,
  },
});
