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
import { BodyMeasurementHistoryScreen } from './BodyMeasurementHistoryScreen';

jest.mock('expo-router', () => ({
  useFocusEffect: (() => {
    const invoked = new WeakSet<() => void>();
    return (callback: () => void) => {
      if (!invoked.has(callback)) {
        invoked.add(callback);
        queueMicrotask(callback);
      }
    };
  })(),
}));

function profile(preferredUnitSystem: 'imperial' | 'metric'): UserProfile {
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

function entry(id: string, grams: number, date: string): BodyWeightEntry {
  const domainId = DomainId.create(id);
  const mass = Mass.create(grams, 'gram');
  if (isErr(domainId) || isErr(mass)) throw new Error('Invalid fixture');
  const [year, month, day] = date.split('-').map(Number);
  const created = BodyWeightEntry.create({
    id: domainId.value,
    localCalendarDate: date,
    mass: mass.value,
    note: null,
    occurredAtEpochMilliseconds: Date.UTC(
      year ?? 0,
      (month ?? 1) - 1,
      day ?? 1,
      4,
    ),
    utcOffsetMinutes: 0,
  });
  if (isErr(created)) throw new Error('Invalid fixture');
  return created.value;
}

const firstEntry = entry(
  '123e4567-e89b-42d3-a456-426614174000',
  82_400,
  '2026-08-04',
);
const olderEntry = entry(
  '223e4567-e89b-42d3-a456-426614174000',
  83_000,
  '2026-08-01',
);

function useCases(
  overrides: Partial<{
    listHistory: { execute: jest.Mock };
    preferredUnitSystem: 'imperial' | 'metric';
  }> = {},
) {
  return {
    getProfile: {
      execute: () =>
        Promise.resolve(profile(overrides.preferredUnitSystem ?? 'metric')),
    },
    listHistory: overrides.listHistory ?? {
      execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    },
  };
}

describe('BodyMeasurementHistoryScreen', () => {
  it('invites a first check-in when no history exists', async () => {
    await render(
      <BodyMeasurementHistoryScreen
        loadUseCases={() => Promise.resolve(useCases())}
        onAddCheckIn={jest.fn()}
        onOpenEntry={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('No weight check-ins yet')).toBeTruthy(),
    );
    expect(screen.getByTestId('add-body-weight')).toBeTruthy();
  });

  it('lists recorded check-ins with combined accessibility labels', async () => {
    await render(
      <BodyMeasurementHistoryScreen
        loadUseCases={() =>
          Promise.resolve(
            useCases({
              listHistory: {
                execute: jest
                  .fn()
                  .mockResolvedValue({ items: [firstEntry], nextCursor: null }),
              },
            }),
          )
        }
        onAddCheckIn={jest.fn()}
        onOpenEntry={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('82.4 kg')).toBeTruthy());
    expect(
      screen.getByLabelText(/Weight check-in 82\.4 kilograms/),
    ).toBeTruthy();
  });

  it('renders stored grams in the profile display unit', async () => {
    await render(
      <BodyMeasurementHistoryScreen
        loadUseCases={() =>
          Promise.resolve(
            useCases({
              listHistory: {
                execute: jest
                  .fn()
                  .mockResolvedValue({ items: [firstEntry], nextCursor: null }),
              },
              preferredUnitSystem: 'imperial',
            }),
          )
        }
        onAddCheckIn={jest.fn()}
        onOpenEntry={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('181.7 lb')).toBeTruthy());
  });

  it('opens a check-in for editing', async () => {
    const onOpenEntry = jest.fn();
    await render(
      <BodyMeasurementHistoryScreen
        loadUseCases={() =>
          Promise.resolve(
            useCases({
              listHistory: {
                execute: jest
                  .fn()
                  .mockResolvedValue({ items: [firstEntry], nextCursor: null }),
              },
            }),
          )
        }
        onAddCheckIn={jest.fn()}
        onOpenEntry={onOpenEntry}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(`body-weight-entry-${firstEntry.id.value}`),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByTestId(`body-weight-entry-${firstEntry.id.value}`),
    );

    expect(onOpenEntry).toHaveBeenCalledWith(firstEntry.id.value);
  });

  it('loads older check-ins through the keyset cursor', async () => {
    const cursor = {
      id: firstEntry.id.value,
      localCalendarDate: '2026-08-04',
      occurredAtEpochMilliseconds: firstEntry.occurredAtEpochMilliseconds,
    };
    const listHistory = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({ items: [firstEntry], nextCursor: cursor })
        .mockResolvedValueOnce({ items: [olderEntry], nextCursor: null }),
    };
    await render(
      <BodyMeasurementHistoryScreen
        loadUseCases={() => Promise.resolve(useCases({ listHistory }))}
        onAddCheckIn={jest.fn()}
        onOpenEntry={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('load-older-body-weight')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('load-older-body-weight'));

    await waitFor(() => expect(screen.getByText('83.0 kg')).toBeTruthy());
    expect(listHistory.execute).toHaveBeenLastCalledWith({ cursor });
  });

  it('reports a read failure without claiming data was changed', async () => {
    await render(
      <BodyMeasurementHistoryScreen
        loadUseCases={() => Promise.reject(new Error('operation-failed'))}
        onAddCheckIn={jest.fn()}
        onOpenEntry={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Body measurements unavailable')).toBeTruthy(),
    );
    expect(screen.getByText(/Nothing was changed/)).toBeTruthy();
  });
});
