import { DomainError, UserProfile, err, isOk, ok } from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { PersonalProfileScreen } from './PersonalProfileScreen';

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
  it('opens data export from the profile', async () => {
    const openDataExport = jest.fn();
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
        onOpenDataExport={openDataExport}
      />,
    );

    await fireEvent.press(await screen.findByTestId('open-data-export'));

    expect(openDataExport).toHaveBeenCalledTimes(1);
  });
});
