import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type AppTheme } from './themes';

export function useAppTheme(): AppTheme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
