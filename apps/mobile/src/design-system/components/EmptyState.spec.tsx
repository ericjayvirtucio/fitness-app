import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('presents meaningful copy and supports an optional recovery action', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        actionLabel="Add item"
        description="There are no saved items."
        icon="document-outline"
        onAction={onAction}
        title="Nothing here yet"
      />,
    );

    expect(
      screen.getByRole('header', { name: 'Nothing here yet' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('There are no saved items.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add item' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
