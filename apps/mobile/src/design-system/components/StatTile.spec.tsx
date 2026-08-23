import { render, screen } from '@testing-library/react-native';
import { describeStatTile, StatTile } from './StatTile';
import { typography } from '../theme/tokens';

describe('StatTile', () => {
  it('announces its label and value as one sentence', async () => {
    await render(<StatTile label="Total fluid" value="2,450 mL" />);

    expect(screen.getByLabelText('Total fluid, 2,450 mL')).toBeOnTheScreen();
    expect(screen.getByText('Total fluid')).toBeOnTheScreen();
    expect(screen.getByText('2,450 mL')).toBeOnTheScreen();
  });

  it('composes the same sentence a card holding it announces', () => {
    // A labelled card is one accessibility element, so the card's own name is
    // the only thing announced. Both come from here so they cannot drift apart.
    expect(describeStatTile('Estimated maintenance', '2,310 kcal/day')).toBe(
      'Estimated maintenance, 2,310 kcal/day',
    );
  });

  it('reads both variants aloud identically, because they differ only in layout', async () => {
    await render(
      <>
        <StatTile label="Protein" value="120 g" variant="row" />
        <StatTile label="Carbohydrate" value="220 g" variant="stacked" />
      </>,
    );

    expect(screen.getByLabelText('Protein, 120 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Carbohydrate, 220 g')).toBeOnTheScreen();
  });

  it('gives a stacked value more weight than a dense row gives it', async () => {
    await render(
      <>
        <StatTile label="BMI" value="22.4" variant="stacked" />
        <StatTile label="Entries" value="6" variant="row" />
      </>,
    );

    expect(screen.getByText('22.4')).toHaveStyle({
      fontSize: typography.heading.fontSize,
    });
    expect(screen.getByText('6')).toHaveStyle({
      fontSize: typography.label.fontSize,
    });
  });

  it('lays a row out so a long label and its value wrap together', async () => {
    await render(
      <StatTile label="Average sodium per logged day" value="450 mg" />,
    );

    expect(
      screen.getByLabelText('Average sodium per logged day, 450 mg'),
    ).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
  });
});
