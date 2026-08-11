import {
  isErr,
  type Result,
  type UserProfile,
  type UserProfileValidationErrors,
} from '@fitness/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { createPersonalProfileUseCases } from '../../../composition/personal-profile';
import {
  AppButton,
  AppText,
  EmptyState,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import type { SaveProfileInput } from '../application/save-profile-use-case';
import {
  PersonalProfileForm,
  type ProfileFormValues,
} from './PersonalProfileForm';

type ProfileUseCases = Readonly<{
  getProfile: Readonly<{ execute: () => Promise<UserProfile | null> }>;
  saveProfile: Readonly<{
    execute: (
      input: SaveProfileInput,
    ) => Promise<Result<UserProfile, UserProfileValidationErrors>>;
  }>;
}>;

type ScreenState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ profile: UserProfile | null; status: 'ready' }>;

type PersonalProfileScreenProps = Readonly<{
  loadUseCases?: () => Promise<ProfileUseCases>;
  onOpenBodyMeasurements?: () => void;
  onOpenDataExport?: () => void;
  onOpenDataRestore?: () => void;
  onOpenGoals?: () => void;
}>;

function formValues(profile: UserProfile | null): ProfileFormValues {
  if (profile === null) {
    return {
      activityLevel: undefined,
      biologicalSex: undefined,
      dateOfBirth: '',
      height: '',
      preferredUnitSystem: 'metric',
      weight: '',
    };
  }
  const isImperial = profile.preferredUnitSystem === 'imperial';
  return {
    activityLevel: profile.activityLevel,
    biologicalSex: profile.biologicalSex,
    dateOfBirth: profile.dateOfBirth,
    height: String(
      Math.round(profile.height.in(isImperial ? 'inch' : 'centimeter') * 10) /
        10,
    ),
    preferredUnitSystem: profile.preferredUnitSystem,
    weight: String(
      Math.round(profile.weight.in(isImperial ? 'pound' : 'kilogram') * 10) /
        10,
    ),
  };
}

export function PersonalProfileScreen({
  loadUseCases = createPersonalProfileUseCases,
  onOpenBodyMeasurements,
  onOpenDataExport,
  onOpenDataRestore,
  onOpenGoals,
}: PersonalProfileScreenProps) {
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [useCases, setUseCases] = useState<ProfileUseCases>();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [successMessage, setSuccessMessage] = useState<string>();

  const load = useCallback(() => {
    setState({ status: 'loading' });
    void loadUseCases()
      .then(async (loadedUseCases) => {
        setUseCases(loadedUseCases);
        const profile = await loadedUseCases.getProfile.execute();
        setState({ profile, status: 'ready' });
      })
      .catch(() => setState({ status: 'error' }));
  }, [loadUseCases]);

  // Reloads on focus like every other screen, so returning here after a
  // restore shows the restored profile instead of the state this screen was
  // mounted with.
  useFocusEffect(load);

  const save = async (input: SaveProfileInput) => {
    if (!useCases) return;
    setErrors({});
    setSuccessMessage(undefined);
    setIsSaving(true);
    try {
      const result = await useCases.saveProfile.execute(input);
      if (isErr(result)) {
        setErrors(
          Object.fromEntries(
            result.error.map((error) => [error.field ?? 'form', error.message]),
          ),
        );
        return;
      }
      setState({ profile: result.value, status: 'ready' });
      setSuccessMessage('Profile saved successfully.');
    } catch {
      setErrors({ form: 'Profile could not be saved. Try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <Screen
        accessibilityLabel="Loading personal profile"
        hasTabBar
        isCentered
      >
        <LoadingIndicator label="Loading personal profile" />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen accessibilityLabel="Personal profile error" hasTabBar isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Profile unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Your profile could not be loaded. No information was changed.
        </AppText>
        <AppButton label="Try again" onPress={load} />
      </Screen>
    );
  }

  if (state.profile === null && !isEditing) {
    return (
      <Screen accessibilityLabel="Personal profile" hasTabBar isCentered>
        <EmptyState
          actionLabel="Create profile"
          description="Add the personal details future fitness features will use. Your profile stays on this device."
          icon="person-outline"
          onAction={() => setIsEditing(true)}
          title="Set up your profile"
        />
        {/*
          Restoring is only supported on an installation with no information,
          so this is exactly where someone returning to a new device needs it.
        */}
        {onOpenDataRestore ? (
          <AppButton
            label="Restore my data"
            onPress={onOpenDataRestore}
            style={{ marginTop: spacing.lg }}
            testID="open-data-restore"
            variant="outline"
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Personal profile" hasTabBar isKeyboardAware>
      <PersonalProfileForm
        errors={errors}
        initialValues={formValues(state.profile)}
        isSaving={isSaving}
        onSave={(input) => void save(input)}
        successMessage={successMessage}
      />
      {onOpenGoals ? (
        <AppButton
          label="Open goals and energy"
          onPress={onOpenGoals}
          style={{ marginTop: spacing.xl }}
          testID="open-goals-energy"
          variant="outline"
        />
      ) : null}
      {onOpenBodyMeasurements ? (
        <AppButton
          label="Open body measurements"
          onPress={onOpenBodyMeasurements}
          style={{ marginTop: spacing.md }}
          testID="open-body-measurements"
          variant="outline"
        />
      ) : null}
      {onOpenDataExport ? (
        <AppButton
          label="Export my data"
          onPress={onOpenDataExport}
          style={{ marginTop: spacing.md }}
          testID="open-data-export"
          variant="outline"
        />
      ) : null}
      {onOpenDataRestore ? (
        <AppButton
          label="Restore my data"
          onPress={onOpenDataRestore}
          style={{ marginTop: spacing.md }}
          testID="open-data-restore"
          variant="outline"
        />
      ) : null}
    </Screen>
  );
}
