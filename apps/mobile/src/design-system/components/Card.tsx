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

/**
 * The accessible name of a card that groups its own children.
 *
 * A card carrying an `accessibilityLabel` is one accessibility element, so its
 * children never reach the accessibility tree and the card's own name is the
 * only thing announced. A name that states an identity and stops therefore
 * announces none of the values below it. This composes the identity with the
 * strings the card renders, from the same list the card maps over, so the
 * announced sentence and the read sentence cannot drift apart.
 *
 * `Card` does not do this for itself. Composing from children would have to walk
 * the views, fragments, and conditionals every affected card nests, would produce
 * render order where a pressable card's name must lead with the act its press
 * performs, and could not be opted out of.
 */
export function describeCardContents(
  identity: string,
  lines: readonly string[],
): string {
  return [identity, ...lines].join(', ');
}

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
        accessible={Boolean(accessibilityLabel)}
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
