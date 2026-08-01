import { useId, type ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  borderWidths,
  minimumTouchTarget,
  opacity,
  radii,
  spacing,
  typography,
} from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

type TextFieldProps = Omit<
  ComponentProps<typeof TextInput>,
  'accessibilityLabel' | 'editable'
> &
  Readonly<{
    error?: string;
    helperText?: string;
    isDisabled?: boolean;
    label: string;
    leadingIcon?: AppIconName;
    trailingIcon?: AppIconName;
  }>;

export function TextField({
  error,
  helperText,
  isDisabled = false,
  label,
  leadingIcon,
  style,
  trailingIcon,
  ...props
}: TextFieldProps) {
  const theme = useAppTheme();
  const inputId = useId();
  const supportingTextId = useId();
  const supportingText = error ?? helperText;

  return (
    <View style={styles.field}>
      <AppText nativeID={`${inputId}-label`} variant="label">
        {label}
      </AppText>
      <View
        style={[
          styles.inputFrame,
          {
            backgroundColor: isDisabled
              ? theme.colors.surfaceVariant
              : theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            opacity: isDisabled ? opacity.disabled : opacity.visible,
          },
        ]}
      >
        {leadingIcon ? (
          <AppIcon color={theme.colors.textSecondary} name={leadingIcon} />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={`${inputId}-label`}
          accessibilityState={{ disabled: isDisabled }}
          accessibilityValue={error ? { text: `Error: ${error}` } : undefined}
          aria-describedby={supportingText ? supportingTextId : undefined}
          editable={!isDisabled}
          placeholderTextColor={theme.colors.textDisabled}
          style={[styles.input, { color: theme.colors.textPrimary }, style]}
          {...props}
        />
        {trailingIcon ? (
          <AppIcon color={theme.colors.textSecondary} name={trailingIcon} />
        ) : null}
      </View>
      {supportingText ? (
        <AppText
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          color={error ? 'danger' : 'secondary'}
          nativeID={supportingTextId}
          variant="caption"
        >
          {error ? `Error: ${error}` : supportingText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: minimumTouchTarget,
    paddingVertical: spacing.sm,
  },
  inputFrame: {
    alignItems: 'center',
    borderRadius: radii.medium,
    borderWidth: borderWidths.thin,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
});
