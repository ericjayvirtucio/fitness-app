import { Energy, isOk } from '@fitness/domain';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GoalConfigurationForm } from './GoalConfigurationForm';

function maintenance() {
  const energy = Energy.create(2_096, 'kilocalorie');
  if (!isOk(energy)) throw new Error('Invalid fixture.');
  return energy.value;
}

async function renderForm() {
  await render(
    <GoalConfigurationForm
      errors={{}}
      initialGoal={null}
      isSaving={false}
      maintenanceEnergy={maintenance()}
      onSave={jest.fn()}
    />,
  );
}

async function chooseDeficit(amount: string) {
  await fireEvent.press(screen.getByRole('radio', { name: 'Lose weight' }));
  await fireEvent.changeText(
    screen.getByLabelText('Daily calorie deficit'),
    amount,
  );
}

describe('GoalConfigurationForm', () => {
  it('announces the calculated target card contents it displays', async () => {
    await renderForm();
    await chooseDeficit('250');

    expect(screen.getByText('Calculated target')).toBeOnTheScreen();
    expect(screen.getByText('1,846 kcal/day')).toBeOnTheScreen();
    expect(screen.getByText(/Results are not guaranteed/)).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        [
          'Calculated daily calorie target',
          'Calculated target',
          '1,846 kcal/day',
          'Based on estimated maintenance and your selected adjustment. Results are not guaranteed.',
          'Protein target',
          '92 g',
          'Carbohydrate target',
          '231 g',
          'Fat target',
          '62 g',
          'A general target based on a fixed macronutrient split within published dietary reference ranges, not personalized nutrition or medical advice.',
        ].join(', '),
      ),
    ).toBeOnTheScreen();
  });

  it('derives macro targets from the same calorie target it displays', async () => {
    await renderForm();
    await chooseDeficit('250');

    expect(screen.getByText('Protein target')).toBeOnTheScreen();
    expect(screen.getByText('92 g')).toBeOnTheScreen();
    expect(screen.getByText('Carbohydrate target')).toBeOnTheScreen();
    expect(screen.getByText('231 g')).toBeOnTheScreen();
    expect(screen.getByText('Fat target')).toBeOnTheScreen();
    expect(screen.getByText('62 g')).toBeOnTheScreen();
    expect(
      screen.getByText(/not personalized nutrition or medical advice/),
    ).toBeOnTheScreen();
  });

  it('renders no target card, and no macro targets, while the adjustment is out of range', async () => {
    await renderForm();
    await chooseDeficit('12');

    expect(
      screen.queryByLabelText(/Calculated daily calorie target/),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText('Calculated target')).not.toBeOnTheScreen();
    expect(screen.queryByText('Protein target')).not.toBeOnTheScreen();
  });

  it('offers no target card or macro targets before a goal type is chosen', async () => {
    await renderForm();

    expect(
      screen.queryByLabelText(/Calculated daily calorie target/),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText('Protein target')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save goal' })).toBeOnTheScreen();
  });
});
