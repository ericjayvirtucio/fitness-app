import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { AppText } from './AppText';

export type StatTileVariant = 'row' | 'stacked';

/**
 * The one sentence a stat is read and announced by.
 *
 * A tile is a single accessibility element, so a screen reader hears this rather
 * than the label and the value as two stops. A labelled card is also a single
 * element, so a tile nested inside one never reaches the accessibility tree at
 * all — which is why the cards that hold tiles compose their own names from the
 * same list they render, through this function, and the announced sentence and
 * the read sentence cannot drift apart.
 */
export function describeStatTile(label: string, value: string): string {
  return `${label}, ${value}`;
}

type StatTileProps = Readonly<{
  label: string;
  /**
   * Already formatted, including its unit. A tile states a value; deciding what
   * the value is and how a unit reads belongs to the capability that owns it.
   */
  value: string;
  variant?: StatTileVariant;
}>;

/**
 * One labeled derived value.
 *
 * `row` is a dense line for a card listing many values, where the label and the
 * value share a line and wrap together. `stacked` gives one value its own block,
 * for a card that states two or three. Both announce the same sentence, so the
 * choice is layout rather than meaning.
 */
export function StatTile({ label, value, variant = 'row' }: StatTileProps) {
  const isRow = variant === 'row';

  return (
    <View
      accessible
      accessibilityLabel={describeStatTile(label, value)}
      style={isRow ? styles.row : styles.stacked}
    >
      <AppText color="secondary" variant={isRow ? 'body' : 'label'}>
        {label}
      </AppText>
      <AppText variant={isRow ? 'label' : 'heading'}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  stacked: {
    gap: spacing.xs,
  },
});
