import { StyleSheet, View, type ViewProps } from 'react-native';
import { borderWidths } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

type DividerProps = Omit<ViewProps, 'accessibilityRole'>;

export function Divider({ style, ...props }: DividerProps) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityRole="none"
      style={[styles.divider, { backgroundColor: theme.colors.divider }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: borderWidths.thin,
    width: '100%',
  },
});
