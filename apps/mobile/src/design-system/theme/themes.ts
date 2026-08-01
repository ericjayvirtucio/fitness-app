import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import type { ColorSchemeName } from 'react-native';
import { darkColors, lightColors, type SemanticColors } from './colors';
import { createElevations, type Elevations } from './elevation';

export type AppTheme = Readonly<{
  colors: SemanticColors;
  elevations: Elevations;
  isDark: boolean;
  navigationTheme: Theme;
}>;

function createAppTheme(
  colors: SemanticColors,
  isDark: boolean,
  navigationBase: Theme,
): AppTheme {
  return {
    colors,
    elevations: createElevations(colors.overlay),
    isDark,
    navigationTheme: {
      ...navigationBase,
      colors: {
        ...navigationBase.colors,
        background: colors.background,
        border: colors.border,
        card: colors.surface,
        notification: colors.danger,
        primary: colors.primary,
        text: colors.textPrimary,
      },
    },
  };
}

export const lightTheme = createAppTheme(lightColors, false, DefaultTheme);
export const darkTheme = createAppTheme(darkColors, true, DarkTheme);

export function getAppTheme(colorScheme: ColorSchemeName): AppTheme {
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}
