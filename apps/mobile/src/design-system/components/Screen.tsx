import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { spacing, tabBarHeight } from '../theme/tokens';
import { useAppTheme } from '../theme/use-app-theme';

type ScreenProps = Omit<ScrollViewProps, 'children' | 'style'> &
  Readonly<{
    children: ReactNode;
    edges?: readonly Edge[];
    hasTabBar?: boolean;
    isCentered?: boolean;
    isKeyboardAware?: boolean;
    isScrollable?: boolean;
    style?: StyleProp<ViewStyle>;
  }>;

export function Screen({
  children,
  contentContainerStyle,
  edges,
  hasTabBar = false,
  isCentered = false,
  isKeyboardAware = false,
  isScrollable = true,
  style,
  ...props
}: ScreenProps) {
  const theme = useAppTheme();
  const resolvedEdges: readonly Edge[] =
    edges ?? (hasTabBar ? (['top', 'bottom'] as const) : (['top'] as const));
  const contentStyle = [
    styles.content,
    isCentered && styles.centered,
    contentContainerStyle,
  ];
  const content = isScrollable ? (
    <ScrollView
      contentContainerStyle={contentStyle}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode={isKeyboardAware ? 'on-drag' : 'none'}
      keyboardShouldPersistTaps="handled"
      style={[styles.fill, style]}
      {...props}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, ...contentStyle, style]} {...props}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={resolvedEdges}
      style={[
        styles.safeArea,
        hasTabBar && styles.tabBarClearance,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {isKeyboardAware ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.fill}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  fill: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  tabBarClearance: {
    paddingBottom: tabBarHeight,
  },
});
