import type { ViewStyle } from 'react-native';

export type ElevationLevel = 'flat' | 'raised' | 'floating';

export type Elevations = Readonly<Record<ElevationLevel, ViewStyle>>;

export function createElevations(shadowColor: string): Elevations {
  return {
    flat: {},
    raised: {
      elevation: 2,
      shadowColor,
      shadowOffset: { height: 2, width: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    floating: {
      elevation: 6,
      shadowColor,
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
    },
  };
}
