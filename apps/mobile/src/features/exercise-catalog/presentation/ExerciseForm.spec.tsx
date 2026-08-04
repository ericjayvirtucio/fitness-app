import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExerciseForm, type ExerciseFormValues } from './ExerciseForm';

const values: ExerciseFormValues = {
  equipment: 'barbell',
  isFavorite: false,
  loggingMode: 'external-load-and-repetitions',
  name: 'Bench Press',
  notes: '',
  primaryMuscleGroup: 'chest',
};

describe('ExerciseForm', () => {
  it('exposes controlled selections, favorite semantics, and save values', async () => {
    const onSave = jest.fn();
    await render(
      <ExerciseForm
        errors={{}}
        initialValues={values}
        isEditing={false}
        isSaving={false}
        onCancel={jest.fn()}
        onSave={onSave}
      />,
    );
    expect(screen.getByLabelText('Equipment')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('How this exercise is logged'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add Bench Press to favorites' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save exercise' }),
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ isFavorite: true, name: 'Bench Press' }),
    );
  });

  it('shows field and live form errors and a destructive edit action', async () => {
    await render(
      <ExerciseForm
        errors={{
          form: 'Nothing changed.',
          loggingMode: 'Choose a valid mode.',
        }}
        initialValues={values}
        isEditing
        isSaving={false}
        onCancel={jest.fn()}
        onDelete={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Error: Choose a valid mode.')).toBeOnTheScreen();
    expect(screen.getByText('Nothing changed.')).toHaveProp(
      'accessibilityLiveRegion',
      'polite',
    );
    expect(
      screen.getByRole('button', { name: 'Delete exercise' }),
    ).toBeOnTheScreen();
  });
});
