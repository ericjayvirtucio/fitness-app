import {
  BodyWeightEntry,
  DomainId,
  Mass,
  UserProfile,
  isErr,
} from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { BodyWeightEntryScreen } from './BodyWeightEntryScreen';

function profile(
  preferredUnitSystem: 'imperial' | 'metric' = 'metric',
): UserProfile {
  const created = UserProfile.create(
    {
      activityLevel: 'moderately-active',
      biologicalSex: 'female',
      dateOfBirth: '1990-06-15',
      heightMillimeters: 1_650,
      preferredUnitSystem,
      weightGrams: 83_000,
    },
    '2026-08-10',
  );
  if (isErr(created)) throw new Error('Invalid fixture');
  return created.value;
}

function entry(): BodyWeightEntry {
  const id = DomainId.create('123e4567-e89b-42d3-a456-426614174000');
  const mass = Mass.create(82_400, 'gram');
  if (isErr(id) || isErr(mass)) throw new Error('Invalid fixture');
  const created = BodyWeightEntry.create({
    id: id.value,
    localCalendarDate: '2026-08-04',
    mass: mass.value,
    note: 'Morning',
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
    utcOffsetMinutes: 0,
  });
  if (isErr(created)) throw new Error('Invalid fixture');
  return created.value;
}

function useCases(
  overrides: Partial<{
    createCheckIn: { execute: jest.Mock };
    deleteEntry: { execute: jest.Mock };
    getEntry: { execute: jest.Mock };
    preferredUnitSystem: 'imperial' | 'metric';
    updateEntry: { execute: jest.Mock };
  }> = {},
) {
  return {
    createCheckIn: overrides.createCheckIn ?? { execute: jest.fn() },
    deleteEntry: overrides.deleteEntry ?? { execute: jest.fn() },
    getEntry: overrides.getEntry ?? {
      execute: jest.fn().mockResolvedValue(null),
    },
    getProfile: {
      execute: () =>
        Promise.resolve(profile(overrides.preferredUnitSystem ?? 'metric')),
    },
    updateEntry: overrides.updateEntry ?? { execute: jest.fn() },
  };
}

describe('BodyWeightEntryScreen', () => {
  it('offers the profile update only when creating a check-in', async () => {
    await render(
      <BodyWeightEntryScreen
        loadUseCases={() => Promise.resolve(useCases())}
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('body-weight-update-profile')).toBeTruthy(),
    );
    expect(screen.getByText('Add weight check-in')).toBeTruthy();
  });

  it('records a check-in and updates the profile when confirmed', async () => {
    const createCheckIn = {
      execute: jest.fn().mockResolvedValue({
        isSuccess: true,
        value: { entry: entry(), isProfileWeightUpdated: true },
      }),
    };
    const onDone = jest.fn();
    await render(
      <BodyWeightEntryScreen
        loadUseCases={() => Promise.resolve(useCases({ createCheckIn }))}
        onDone={onDone}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('body-weight-value')).toBeTruthy(),
    );
    await fireEvent.changeText(screen.getByTestId('body-weight-value'), '82.4');
    await fireEvent.changeText(
      screen.getByTestId('body-weight-date'),
      '2026-08-04',
    );
    await fireEvent.changeText(screen.getByTestId('body-weight-time'), '12:00');
    await fireEvent.press(screen.getByTestId('save-body-weight'));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(createCheckIn.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        localCalendarDate: '2026-08-04',
        massUnit: 'kilogram',
        massValue: '82.4',
      }),
      { shouldUpdateProfileWeight: true },
    );
  });

  it('records a check-in without touching the profile when declined', async () => {
    const createCheckIn = {
      execute: jest.fn().mockResolvedValue({
        isSuccess: true,
        value: { entry: entry(), isProfileWeightUpdated: false },
      }),
    };
    await render(
      <BodyWeightEntryScreen
        loadUseCases={() => Promise.resolve(useCases({ createCheckIn }))}
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('body-weight-value')).toBeTruthy(),
    );
    await fireEvent.changeText(screen.getByTestId('body-weight-value'), '82.4');
    await fireEvent.changeText(
      screen.getByTestId('body-weight-date'),
      '2026-08-04',
    );
    await fireEvent.changeText(screen.getByTestId('body-weight-time'), '12:00');
    await fireEvent.press(screen.getByTestId('body-weight-update-profile-no'));
    await fireEvent.press(screen.getByTestId('save-body-weight'));

    await waitFor(() =>
      expect(createCheckIn.execute).toHaveBeenCalledWith(expect.anything(), {
        shouldUpdateProfileWeight: false,
      }),
    );
  });

  it('captures the entry in the imperial display unit', async () => {
    const createCheckIn = {
      execute: jest.fn().mockResolvedValue({
        isSuccess: true,
        value: { entry: entry(), isProfileWeightUpdated: false },
      }),
    };
    await render(
      <BodyWeightEntryScreen
        loadUseCases={() =>
          Promise.resolve(
            useCases({ createCheckIn, preferredUnitSystem: 'imperial' }),
          )
        }
        onDone={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Weight (lb)')).toBeTruthy());
    await fireEvent.changeText(
      screen.getByTestId('body-weight-date'),
      '2026-08-04',
    );
    await fireEvent.changeText(screen.getByTestId('body-weight-time'), '12:00');
    await fireEvent.press(screen.getByTestId('save-body-weight'));

    await waitFor(() =>
      expect(createCheckIn.execute).toHaveBeenCalledWith(
        expect.objectContaining({ massUnit: 'pound' }),
        expect.anything(),
      ),
    );
  });

  it('surfaces a domain validation error against its field', async () => {
    const createCheckIn = {
      execute: jest.fn().mockResolvedValue({
        error: [
          {
            code: 'out-of-range',
            field: 'mass',
            message: 'Weight must be between 2 and 500 kilograms.',
          },
        ],
        isSuccess: false,
      }),
    };
    await render(
      <BodyWeightEntryScreen
        loadUseCases={() => Promise.resolve(useCases({ createCheckIn }))}
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('body-weight-value')).toBeTruthy(),
    );
    await fireEvent.changeText(screen.getByTestId('body-weight-value'), '900');
    await fireEvent.changeText(
      screen.getByTestId('body-weight-date'),
      '2026-08-04',
    );
    await fireEvent.changeText(screen.getByTestId('body-weight-time'), '12:00');
    await fireEvent.press(screen.getByTestId('save-body-weight'));

    await waitFor(() =>
      expect(
        screen.getByText(/Weight must be between 2 and 500 kilograms/),
      ).toBeTruthy(),
    );
  });

  it('rejects a malformed date and time before reaching the domain', async () => {
    const createCheckIn = { execute: jest.fn() };
    await render(
      <BodyWeightEntryScreen
        loadUseCases={() => Promise.resolve(useCases({ createCheckIn }))}
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('body-weight-date')).toBeTruthy(),
    );
    await fireEvent.changeText(
      screen.getByTestId('body-weight-date'),
      '04-08-2026',
    );
    await fireEvent.press(screen.getByTestId('save-body-weight'));

    await waitFor(() =>
      expect(
        screen.getByText(/Enter a valid local date and time/),
      ).toBeTruthy(),
    );
    expect(createCheckIn.execute).not.toHaveBeenCalled();
  });

  it('edits a stored check-in without offering a profile update', async () => {
    const updateEntry = {
      execute: jest.fn().mockResolvedValue({ isSuccess: true, value: entry() }),
    };
    await render(
      <BodyWeightEntryScreen
        entryId={entry().id.value}
        loadUseCases={() =>
          Promise.resolve(
            useCases({
              getEntry: { execute: jest.fn().mockResolvedValue(entry()) },
              updateEntry,
            }),
          )
        }
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Edit weight check-in')).toBeTruthy(),
    );
    expect(screen.queryByTestId('body-weight-update-profile')).toBeNull();
    await fireEvent.press(screen.getByTestId('save-body-weight'));
    await waitFor(() => expect(updateEntry.execute).toHaveBeenCalledTimes(1));
  });

  it('confirms deletion and states that the profile is unchanged', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    await render(
      <BodyWeightEntryScreen
        entryId={entry().id.value}
        loadUseCases={() =>
          Promise.resolve(
            useCases({
              getEntry: { execute: jest.fn().mockResolvedValue(entry()) },
            }),
          )
        }
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('delete-body-weight')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('delete-body-weight'));

    expect(alert).toHaveBeenCalledWith(
      'Delete this weight check-in?',
      expect.stringContaining('profile weight is not changed'),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel', text: 'Cancel' }),
        expect.objectContaining({ style: 'destructive', text: 'Delete' }),
      ]),
    );
    alert.mockRestore();
  });

  it('reports a missing check-in', async () => {
    await render(
      <BodyWeightEntryScreen
        entryId={entry().id.value}
        loadUseCases={() => Promise.resolve(useCases())}
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Weight check-in not found')).toBeTruthy(),
    );
  });
});
