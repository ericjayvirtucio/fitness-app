import { DomainId, ExerciseDefinition } from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import { ExerciseEditorScreen } from './ExerciseEditorScreen';

function catalogItem() {
  const id = DomainId.create('550e8400-e29b-41d4-a716-446655440000');
  if (!id.isSuccess) throw new Error('Invalid fixture');
  const definition = ExerciseDefinition.create({
    equipment: 'barbell',
    id: id.value,
    loggingMode: 'external-load-and-repetitions',
    name: 'Bench Press',
    notes: null,
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

describe('ExerciseEditorScreen', () => {
  it('requires destructive confirmation before deletion', async () => {
    const remove = jest.fn(() => Promise.resolve(true));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation();
    await render(
      <ExerciseEditorScreen
        exerciseId={catalogItem().definition.id.value}
        loadUseCases={() =>
          Promise.resolve({
            delete: { execute: remove },
            get: { execute: () => Promise.resolve(catalogItem()) },
          } as never)
        }
        onDone={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Delete exercise' }),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Delete exercise' }),
    );
    expect(remove).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Delete exercise?',
      'Delete Bench Press? This cannot be undone.',
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel' }),
        expect.objectContaining({ style: 'destructive' }),
      ]),
    );
  });
});
