import {
  DomainId,
  ExerciseDefinition,
  PlannedExercise,
  PlannedWorkout,
  Weekday,
  createPlannedPrescription,
} from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import { PlannedWorkoutEditorScreen } from './PlannedWorkoutEditorScreen';

const ids = [
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
];
function exercise() {
  const id = DomainId.create(ids[2]);
  if (!id.isSuccess) throw new Error('Invalid fixture');
  const definition = ExerciseDefinition.create({
    equipment: 'barbell',
    id: id.value,
    loggingMode: 'external-load-and-repetitions',
    name: 'Bench Press',
    primaryMuscleGroup: 'chest',
  });
  if (!definition.isSuccess) throw new Error('Invalid fixture');
  const item = ExerciseCatalogItem.create({
    definition: definition.value,
    isFavorite: false,
  });
  if (!item.isSuccess) throw new Error('Invalid fixture');
  return item.value;
}

function existingWorkout() {
  const item = exercise();
  const prescription = createPlannedPrescription({
    loggingMode: item.definition.loggingMode,
    repetitions: 8,
    sets: 4,
  });
  const plannedId = DomainId.create(ids[1]);
  const workoutId = DomainId.create(ids[0]);
  const weekday = Weekday.create(1);
  if (
    !prescription.isSuccess ||
    !plannedId.isSuccess ||
    !workoutId.isSuccess ||
    !weekday.isSuccess
  )
    throw new Error('Invalid fixture');
  const plannedExercise = PlannedExercise.create({
    exerciseDefinitionId: item.definition.id,
    id: plannedId.value,
    position: 0,
    prescription: prescription.value,
  });
  if (!plannedExercise.isSuccess) throw new Error('Invalid fixture');
  const workout = PlannedWorkout.create({
    exercises: [plannedExercise.value],
    id: workoutId.value,
    name: 'Push Day',
    weekday: weekday.value,
  });
  if (!workout.isSuccess) throw new Error('Invalid fixture');
  return {
    exercises: [
      { definition: item.definition, plannedExercise: plannedExercise.value },
    ],
    workout: workout.value,
  };
}

function useCases(
  save: (workout: unknown) => Promise<unknown> = () =>
    Promise.resolve({ status: 'saved' }),
  existing: ReturnType<typeof existingWorkout> | null = null,
) {
  return {
    browseExercises: {
      listAll: () => Promise.resolve([exercise()]),
      listRecentlyPerformed: () => Promise.resolve([]),
      search: () => Promise.resolve([exercise()]),
    },
    generateId: jest
      .fn()
      .mockReturnValueOnce(ids[0])
      .mockReturnValueOnce(ids[1]),
    get: { execute: () => Promise.resolve(existing) },
    getProfile: { execute: () => Promise.resolve(null) },
    save: { execute: save },
    setRest: { execute: jest.fn() },
  };
}

describe('PlannedWorkoutEditorScreen', () => {
  it('creates a weighted planned workout with only relevant target fields', async () => {
    const save = jest.fn((workout: unknown) => {
      void workout;
      return Promise.resolve({ status: 'saved' });
    });
    const loaded = useCases(save);
    const onDone = jest.fn();
    await render(
      <PlannedWorkoutEditorScreen
        loadUseCases={() => Promise.resolve(loaded as never)}
        onDone={onDone}
        weekdayValue={1}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Workout name')).toBeOnTheScreen(),
    );
    await fireEvent.changeText(
      screen.getByLabelText('Workout name'),
      'Push Day',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Bench Press' }),
      ).toBeOnTheScreen(),
    );
    // The picker composes its own filtering, so the Planner offers the same
    // narrowing as its two siblings without wiring anything for it.
    expect(
      screen.getByTestId('exercise-picker-filters-toggle'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add Bench Press' }),
    );
    expect(screen.getByLabelText('Sets')).toBeOnTheScreen();
    expect(screen.getByLabelText('Repetitions')).toBeOnTheScreen();
    expect(screen.getByLabelText('Planned weight (kg)')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Duration')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Distance (km)')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Move Bench Press up' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move Bench Press down' }),
    ).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Sets'), '4');
    await fireEvent.changeText(screen.getByLabelText('Repetitions'), '8');
    await fireEvent.changeText(
      screen.getByLabelText('Planned weight (kg)'),
      '60',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save workout' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      exercises: [
        {
          prescription: {
            kind: 'resistance-and-repetitions',
            repetitions: 8,
            sets: 4,
          },
        },
      ],
      name: 'Push Day',
      weekday: { value: 1 },
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('announces validation without writing an invalid workout', async () => {
    const save = jest.fn((workout: unknown) => {
      void workout;
      return Promise.resolve({ status: 'saved' });
    });
    await render(
      <PlannedWorkoutEditorScreen
        loadUseCases={() => Promise.resolve(useCases(save) as never)}
        onDone={jest.fn()}
        weekdayValue={2}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save workout' }),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save workout' }));
    expect(
      await screen.findByText('Error: Workout name is required.'),
    ).toBeOnTheScreen();
    expect(save).not.toHaveBeenCalled();
  });

  it('requires deliberate confirmation before changing a workout to Rest', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation();
    const loaded = useCases(undefined, existingWorkout());
    await render(
      <PlannedWorkoutEditorScreen
        loadUseCases={() => Promise.resolve(loaded as never)}
        onDone={jest.fn()}
        weekdayValue={1}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Change to Rest' }),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Change to Rest' }),
    );
    expect(loaded.setRest.execute).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Change workout to Rest?',
      'Remove Push Day and its 1 planned exercise?',
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel', text: 'Keep workout' }),
        expect.objectContaining({
          style: 'destructive',
          text: 'Change to Rest',
        }),
      ]),
    );
  });
});
