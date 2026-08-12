import { DomainError, UserProfile, err, isOk, ok } from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { PersonalProfileScreen } from './PersonalProfileScreen';

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

function validProfile() {
  const result = UserProfile.create(
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
  if (!isOk(result)) throw new Error('Fixture must be valid.');
  return result.value;
}

describe('PersonalProfileScreen', () => {
  it('shows an accessible empty state on first launch', async () => {
    await render(
      <PersonalProfileScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(null) },
            saveProfile: { execute: () => Promise.resolve(ok(validProfile())) },
          })
        }
      />,
    );

    expect(
      await screen.findByRole('header', { name: 'Set up your profile' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Create profile' }),
    ).toBeOnTheScreen();
  });

  it('returns to the first-run empty state once no profile is stored', async () => {
    // Erasing local data leaves this tab mounted, and editing is state only
    // this screen owns. Without a reset the screen would keep showing the
    // blank create form instead of the first-run state a fresh install shows.
    const useCases = {
      getProfile: { execute: () => Promise.resolve(null) },
      saveProfile: { execute: () => Promise.resolve(ok(validProfile())) },
    };
    const view = await render(
      <PersonalProfileScreen loadUseCases={() => Promise.resolve(useCases)} />,
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Create profile' }),
    );
    expect(screen.getByTestId('save-profile')).toBeOnTheScreen();

    // A new loader identity refocuses the screen, as returning to the tab does.
    await view.rerender(
      <PersonalProfileScreen loadUseCases={() => Promise.resolve(useCases)} />,
    );

    expect(
      await screen.findByRole('header', { name: 'Set up your profile' }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('save-profile')).toBeNull();
  });

  it('clears a save confirmation that the stored profile no longer justifies', async () => {
    let storedProfile: UserProfile | null = validProfile();
    const useCases = {
      getProfile: { execute: () => Promise.resolve(storedProfile) },
      saveProfile: { execute: () => Promise.resolve(ok(validProfile())) },
    };
    const view = await render(
      <PersonalProfileScreen loadUseCases={() => Promise.resolve(useCases)} />,
    );
    await fireEvent.press(await screen.findByTestId('save-profile'));
    expect(
      await screen.findByText('Profile saved successfully.'),
    ).toBeOnTheScreen();

    storedProfile = null;
    await view.rerender(
      <PersonalProfileScreen loadUseCases={() => Promise.resolve(useCases)} />,
    );

    expect(
      await screen.findByRole('header', { name: 'Set up your profile' }),
    ).toBeOnTheScreen();
    // Starting again must not carry a confirmation describing records that no
    // longer exist.
    await fireEvent.press(
      screen.getByRole('button', { name: 'Create profile' }),
    );
    expect(screen.getByTestId('save-profile')).toBeOnTheScreen();
    expect(screen.queryByText('Profile saved successfully.')).toBeNull();
  });

  it('reaches the data controls from the empty state, where a new device starts', async () => {
    const onOpenDataControls = jest.fn();
    await render(
      <PersonalProfileScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(null) },
            saveProfile: { execute: () => Promise.resolve(ok(validProfile())) },
          })
        }
        onOpenDataControls={onOpenDataControls}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Data controls' }),
    );

    expect(onOpenDataControls).toHaveBeenCalledTimes(1);
  });

  it('reaches the data controls once a profile exists', async () => {
    const onOpenDataControls = jest.fn();
    await render(
      <PersonalProfileScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(validProfile()) },
            saveProfile: { execute: () => Promise.resolve(ok(validProfile())) },
          })
        }
        onOpenDataControls={onOpenDataControls}
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Data controls' }),
    );

    expect(onOpenDataControls).toHaveBeenCalledTimes(1);
  });

  it('loads an existing profile into the edit form', async () => {
    await render(
      <PersonalProfileScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(validProfile()) },
            saveProfile: { execute: () => Promise.resolve(ok(validProfile())) },
          })
        }
      />,
    );

    expect(await screen.findByDisplayValue('165')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('62')).toBeOnTheScreen();
    expect(screen.getByLabelText('Date of birth')).toHaveDisplayValue(
      '1990-06-15',
    );
    expect(screen.getByRole('radio', { name: 'Female' })).toHaveProp(
      'accessibilityState',
      { checked: true },
    );
  });

  it('presents application validation and successful save feedback', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce(
        err([
          DomainError.create('out-of-range', 'Height is invalid.', 'height'),
        ]),
      )
      .mockResolvedValueOnce(ok(validProfile()));
    await render(
      <PersonalProfileScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(validProfile()) },
            saveProfile: { execute },
          })
        }
      />,
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Save profile' }),
    );
    expect(
      await screen.findByText('Error: Height is invalid.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(
      await screen.findByText('Profile saved successfully.'),
    ).toBeOnTheScreen();
  });

  it('handles a safe load failure', async () => {
    await render(
      <PersonalProfileScreen
        loadUseCases={() => Promise.reject(new Error('sensitive details'))}
      />,
    );
    expect(await screen.findByText('Profile unavailable')).toBeOnTheScreen();
    expect(screen.queryByText('sensitive details')).not.toBeOnTheScreen();
  });

  it('handles a safe save failure', async () => {
    await render(
      <PersonalProfileScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(validProfile()) },
            saveProfile: {
              execute: () => Promise.reject(new Error('raw SQL')),
            },
          })
        }
      />,
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Save profile' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('Profile could not be saved. Try again.'),
      ).toBeOnTheScreen(),
    );
    expect(screen.queryByText('raw SQL')).not.toBeOnTheScreen();
  });
  it('offers one data control entry point rather than one action per operation', async () => {
    const openDataControls = jest.fn();
    await render(
      <PersonalProfileScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(validProfile()) },
            saveProfile: {
              execute: () => Promise.resolve(ok(validProfile())),
            },
          })
        }
        onOpenDataControls={openDataControls}
      />,
    );

    await fireEvent.press(await screen.findByTestId('open-data-controls'));

    expect(openDataControls).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('open-data-export')).toBeNull();
    expect(screen.queryByTestId('open-data-restore')).toBeNull();
  });
});
