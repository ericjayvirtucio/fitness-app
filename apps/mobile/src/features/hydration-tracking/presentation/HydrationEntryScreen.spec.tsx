import { DomainId, HydrationEntry, Volume } from '@fitness/domain';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HydrationEntryScreen } from './HydrationEntryScreen';

function entry() {
  const id = DomainId.create('550e8400-e29b-41d4-a716-446655440000');
  const volume = Volume.create(500, 'milliliter');
  if (!id.isSuccess || !volume.isSuccess) throw new Error('Invalid fixture');
  const result = HydrationEntry.create({
    fluidType: 'plain-water',
    id: id.value,
    localCalendarDate: '2026-08-04',
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
    utcOffsetMinutes: 480,
    volume: volume.value,
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('HydrationEntryScreen', () => {
  it('requires destructive confirmation before deleting', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    await render(
      <HydrationEntryScreen
        entryId={entry().id.value}
        loadUseCases={() =>
          Promise.resolve({
            createEntry: { execute: jest.fn() },
            deleteEntry: { execute: jest.fn() },
            getEntry: { execute: () => Promise.resolve(entry()) },
            updateEntry: { execute: jest.fn() },
          })
        }
        onDone={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete fluid' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete fluid' }));
    expect(alert).toHaveBeenCalledWith(
      'Delete fluid entry?',
      expect.stringContaining('cannot be undone'),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel', text: 'Cancel' }),
        expect.objectContaining({ style: 'destructive', text: 'Delete' }),
      ]),
    );
    alert.mockRestore();
  });
});
