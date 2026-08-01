import { useColorScheme } from 'react-native';
import { getAppTheme, type AppTheme } from './themes';

export function useAppTheme(): AppTheme {
  return getAppTheme(useColorScheme());
}
