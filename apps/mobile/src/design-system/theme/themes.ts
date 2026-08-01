import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { darkColors, lightColors, type SemanticColors } from './colors';

export type AppTheme = Readonly<{
  colors: SemanticColors;
  navigationTheme: Theme;
}>;

export const lightTheme: AppTheme = {
  colors: lightColors,
  navigationTheme: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: lightColors.background,
      border: lightColors.border,
      card: lightColors.surface,
      notification: lightColors.danger,
      primary: lightColors.accent,
      text: lightColors.textPrimary,
    },
  },
};

export const darkTheme: AppTheme = {
  colors: darkColors,
  navigationTheme: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: darkColors.background,
      border: darkColors.border,
      card: darkColors.surface,
      notification: darkColors.danger,
      primary: darkColors.accent,
      text: darkColors.textPrimary,
    },
  },
};
