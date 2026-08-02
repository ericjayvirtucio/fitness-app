import {
  DomainError,
  GoalConfiguration,
  UserProfile,
  isOk,
} from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  deriveEnergySummary,
  type EnergySummaryOutcome,
} from '../application/energy-summary';
import { GoalsEnergyScreen } from './GoalsEnergyScreen';

jest.mock('expo-router', () => {
  const invokedCallbacks = new WeakSet<() => void>();
  return {
    useFocusEffect: (callback: () => void) => {
      if (!invokedCallbacks.has(callback)) {
        invokedCallbacks.add(callback);
        queueMicrotask(callback);
      }
    },
  };
});

function readyOutcome(
  goal: GoalConfiguration | null = null,
): EnergySummaryOutcome {
  const profile = UserProfile.create(
    {
      activityLevel: 'moderately-active',
      biologicalSex: 'female',
      dateOfBirth: '1990-06-15',
      heightMillimeters: 1_650,
      preferredUnitSystem: 'metric',
      weightGrams: 62_000,
    },
    '2026-08-02',
  );
  if (!isOk(profile)) throw new Error('Invalid fixture.');
  return deriveEnergySummary(profile.value, goal, '2026-08-02');
}

function useCases(outcome: EnergySummaryOutcome) {
  return {
    getEnergySummary: { execute: jest.fn().mockResolvedValue(outcome) },
    saveGoal: {
      execute: jest.fn().mockImplementation((input: { goalType: unknown }) => {
        const goal = GoalConfiguration.create(
          input.goalType,
          input.goalType === 'maintain-weight' ? 0 : 250,
        );
        if (!isOk(goal)) throw new Error('Invalid test goal.');
        return Promise.resolve({ isSuccess: true as const, value: goal.value });
      }),
    },
  };
}

describe('GoalsEnergyScreen', () => {
  it('routes a missing profile to profile setup', async () => {
    const onEditProfile = jest.fn();
    await render(
      <GoalsEnergyScreen
        loadUseCases={() =>
          Promise.resolve(useCases({ status: 'profile-required' }))
        }
        onBack={jest.fn()}
        onEditProfile={onEditProfile}
      />,
    );
    expect(await screen.findByText('Complete your profile')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Set up profile' }),
    );
    expect(onEditProfile).toHaveBeenCalledTimes(1);
  });

  it('shows calculated estimates with accessible labels', async () => {
    await render(
      <GoalsEnergyScreen
        loadUseCases={() => Promise.resolve(useCases(readyOutcome()))}
        onBack={jest.fn()}
        onEditProfile={jest.fn()}
      />,
    );
    expect(await screen.findByText('Goals & energy')).toBeOnTheScreen();
    expect(screen.getByLabelText(/BMI, 22\.8/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Estimated BMR,/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Estimated maintenance,/)).toBeOnTheScreen();
    expect(
      screen.getByText(/screening classification, not a diagnosis/i),
    ).toBeOnTheScreen();
  });

  it('selects and saves each supported goal type', async () => {
    const loaded = useCases(readyOutcome());
    await render(
      <GoalsEnergyScreen
        loadUseCases={() => Promise.resolve(loaded)}
        onBack={jest.fn()}
        onEditProfile={jest.fn()}
      />,
    );
    await fireEvent.press(
      await screen.findByRole('radio', { name: 'Lose weight' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('Daily calorie deficit'),
      '250',
    );
    expect(screen.getByText('Calculated target')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() =>
      expect(loaded.saveGoal.execute.mock.calls).toHaveLength(1),
    );

    await fireEvent.press(
      screen.getByRole('radio', { name: 'Maintain weight' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() =>
      expect(loaded.saveGoal.execute.mock.calls).toHaveLength(2),
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Gain weight' }));
    await fireEvent.changeText(
      screen.getByLabelText('Daily calorie surplus'),
      '250',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() =>
      expect(loaded.saveGoal.execute.mock.calls).toHaveLength(3),
    );
  });

  it('shows unsupported profile and safe load failure states', async () => {
    const unavailable: EnergySummaryOutcome = {
      reason: DomainError.create(
        'unsupported-option',
        'The selected profile option is not supported by this energy equation.',
        'biologicalSex',
      ),
      status: 'calculation-unavailable',
    };
    const first = await render(
      <GoalsEnergyScreen
        loadUseCases={() => Promise.resolve(useCases(unavailable))}
        onBack={jest.fn()}
        onEditProfile={jest.fn()}
      />,
    );
    expect(
      await screen.findByText('Energy estimate unavailable'),
    ).toBeOnTheScreen();
    await first.unmount();

    await render(
      <GoalsEnergyScreen
        loadUseCases={() => Promise.reject(new Error('sensitive details'))}
        onBack={jest.fn()}
        onEditProfile={jest.fn()}
      />,
    );
    expect(
      await screen.findByText('Goals & energy unavailable'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('sensitive details')).not.toBeOnTheScreen();
  });
});
