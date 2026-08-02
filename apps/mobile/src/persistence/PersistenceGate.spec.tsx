import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppText } from '../design-system';
import { PersistenceGate } from './PersistenceGate';

function deferred(): Readonly<{
  promise: Promise<void>;
  reject: (error: unknown) => void;
  resolve: () => void;
}> {
  let rejectPromise: (error: unknown) => void = () => undefined;
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });

  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

describe('PersistenceGate', () => {
  it('waits for initialization before rendering the application', async () => {
    const initialization = deferred();

    await render(
      <PersistenceGate initialize={() => initialization.promise}>
        <AppText>Application ready</AppText>
      </PersistenceGate>,
    );

    expect(screen.getAllByLabelText('Preparing local storage')).toHaveLength(2);
    expect(screen.queryByText('Application ready')).toBeNull();

    await act(() => {
      initialization.resolve();
      return Promise.resolve();
    });

    expect(screen.getByText('Application ready')).toBeTruthy();
  });

  it('shows a safe error and retries initialization', async () => {
    const firstAttempt = deferred();
    const secondAttempt = deferred();
    const initialize = jest
      .fn<Promise<void>, []>()
      .mockReturnValueOnce(firstAttempt.promise)
      .mockReturnValueOnce(secondAttempt.promise);

    await render(
      <PersistenceGate initialize={initialize}>
        <AppText>Application ready</AppText>
      </PersistenceGate>,
    );

    await act(() => {
      firstAttempt.reject(new Error('raw failure'));
      return Promise.resolve();
    });
    expect(screen.getByText('Local storage is unavailable')).toBeTruthy();
    expect(screen.queryByText('raw failure')).toBeNull();

    await fireEvent.press(
      screen.getByLabelText('Try preparing local storage again'),
    );
    expect(initialize).toHaveBeenCalledTimes(2);

    await act(() => {
      secondAttempt.resolve();
      return Promise.resolve();
    });
    expect(screen.getByText('Application ready')).toBeTruthy();
  });
});
