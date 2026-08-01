import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  borderWidths,
  minimumTouchTarget,
  opacity,
  radii,
  spacing,
} from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

export type AppButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

type AppButtonProps = Omit<
  ComponentProps<typeof Pressable>,
  'accessibilityRole' | 'children'
> &
  Readonly<{
    icon?: AppIconName;
    isLoading?: boolean;
    label: string;
    variant?: AppButtonVariant;
  }>;

export function AppButton({
  accessibilityLabel,
  disabled = false,
  icon,
  isLoading = false,
  label,
  onBlur,
  onFocus,
  style,
  variant = 'primary',
  ...props
}: AppButtonProps) {
  const theme = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const isDisabled = disabled || isLoading;
  const appearance = {
    danger: {
      backgroundColor: theme.colors.danger,
      borderColor: theme.colors.danger,
      foregroundColor: theme.colors.onDanger,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      foregroundColor: theme.colors.primary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.primary,
      foregroundColor: theme.colors.primary,
    },
    primary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      foregroundColor: theme.colors.onPrimary,
    },
    secondary: {
      backgroundColor: theme.colors.secondary,
      borderColor: theme.colors.secondary,
      foregroundColor: theme.colors.onSecondary,
    },
  }[variant];

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isDisabled }}
      disabled={isDisabled}
      onBlur={(event) => {
        setIsFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: appearance.backgroundColor,
          borderColor: isFocused ? theme.colors.focus : appearance.borderColor,
          borderWidth: isFocused ? borderWidths.strong : borderWidths.thin,
          opacity: isDisabled
            ? opacity.disabled
            : pressed
              ? opacity.pressed
              : opacity.visible,
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      <View accessibilityElementsHidden style={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={appearance.foregroundColor} size="small" />
        ) : icon ? (
          <AppIcon color={appearance.foregroundColor} name={icon} />
        ) : null}
        <AppText style={{ color: appearance.foregroundColor }} variant="button">
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radii.round,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
});
