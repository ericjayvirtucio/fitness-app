import { useId, useRef, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
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
    error?: string | undefined;
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
  onBlur,
  onFocus,
  style,
  testID,
  trailingIcon,
  ...props
}: TextFieldProps) {
  const theme = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputId = useId();
  const supportingTextId = useId();
  const supportingText = error ?? helperText;

  return (
    <View style={styles.field}>
      <AppText nativeID={`${inputId}-label`} variant="label">
        {label}
      </AppText>
      <Pressable
        accessible={false}
        disabled={isDisabled}
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.inputFrame,
          {
            backgroundColor: isDisabled
              ? theme.colors.surfaceVariant
              : theme.colors.surface,
            borderColor: error
              ? theme.colors.danger
              : isFocused
                ? theme.colors.focus
                : theme.colors.border,
            borderWidth: isFocused ? borderWidths.strong : borderWidths.thin,
            opacity: isDisabled ? opacity.disabled : opacity.visible,
          },
        ]}
        testID={testID ? `${testID}-touch-target` : undefined}
      >
        {leadingIcon ? (
          <AppIcon color={theme.colors.textSecondary} name={leadingIcon} />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={`${inputId}-label`}
          accessibilityHint={error ? `Error: ${error}` : helperText}
          accessibilityState={{ disabled: isDisabled }}
          aria-describedby={supportingText ? supportingTextId : undefined}
          editable={!isDisabled}
          ref={inputRef}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.colors.textDisabled}
          style={[styles.input, { color: theme.colors.textPrimary }, style]}
          testID={testID}
          {...props}
        />
        {trailingIcon ? (
          <AppIcon color={theme.colors.textSecondary} name={trailingIcon} />
        ) : null}
      </Pressable>
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
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
});
