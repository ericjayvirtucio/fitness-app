import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RestCountdown } from './RestCountdown';

describe('RestCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers the four preset durations and no running control before a start', async () => {
    await render(<RestCountdown />);

    expect(
      screen.getByLabelText('Start rest timer, 60 seconds'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Start rest timer, 90 seconds'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Start rest timer, 120 seconds'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Start rest timer, 180 seconds'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Stop rest timer')).not.toBeOnTheScreen();
  });

  it('starts a countdown at the pressed preset and shows remaining time', async () => {
    await render(<RestCountdown />);

    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 90 seconds'),
    );

    expect(screen.getByText('1:30')).toBeOnTheScreen();
    expect(screen.getByLabelText('Stop rest timer')).toBeOnTheScreen();
  });

  it('removes every start control while running, so a second press has nothing to hit', async () => {
    await render(<RestCountdown />);
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 60 seconds'),
    );

    expect(
      screen.queryByLabelText('Start rest timer, 60 seconds'),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByLabelText('Start rest timer, 90 seconds'),
    ).not.toBeOnTheScreen();
  });

  it('counts down as time passes, derived from the deadline rather than a tick count', async () => {
    await render(<RestCountdown />);
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 60 seconds'),
    );

    await act(() => jest.advanceTimersByTime(15_000));
    expect(screen.getByText('0:45')).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText('0:15')).toBeOnTheScreen();
  });

  it('announces completion exactly once and offers dismiss', async () => {
    await render(<RestCountdown />);
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 60 seconds'),
    );

    await act(() => jest.advanceTimersByTime(60_000));

    const announcements = screen.getAllByText('Rest complete');
    expect(announcements).toHaveLength(1);
    expect(screen.getByLabelText('Stop rest timer')).toBeOnTheScreen();

    // Running past the deadline does not repeat the announcement.
    await act(() => jest.advanceTimersByTime(5_000));
    expect(screen.getAllByText('Rest complete')).toHaveLength(1);
  });

  it('stopping a running countdown returns to the preset offer', async () => {
    await render(<RestCountdown />);
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 90 seconds'),
    );
    await fireEvent.press(screen.getByLabelText('Stop rest timer'));

    expect(
      screen.getByLabelText('Start rest timer, 90 seconds'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('1:30')).not.toBeOnTheScreen();
  });

  it('dismissing a completed countdown returns to the preset offer', async () => {
    await render(<RestCountdown />);
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 60 seconds'),
    );
    await act(() => jest.advanceTimersByTime(60_000));
    await fireEvent.press(screen.getByLabelText('Stop rest timer'));

    expect(
      screen.getByLabelText('Start rest timer, 60 seconds'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Rest complete')).not.toBeOnTheScreen();
  });

  it('restarting after a stop computes a fresh countdown', async () => {
    await render(<RestCountdown />);
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 60 seconds'),
    );
    await act(() => jest.advanceTimersByTime(30_000));
    await fireEvent.press(screen.getByLabelText('Stop rest timer'));
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 120 seconds'),
    );

    expect(screen.getByText('2:00')).toBeOnTheScreen();
  });

  // React Native Testing Library and `act` hold their own timers even for a
  // static render, so `jest.getTimerCount()` is never a reliable zero in this
  // environment and a single interaction can move it by more than one. These
  // tests instead spy on `setInterval`/`clearInterval` directly and assert
  // this component's own interval id is the one that gets cleared.
  it('clears its own interval when stopped', async () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    await render(<RestCountdown />);
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 90 seconds'),
    );
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    const intervalId = setIntervalSpy.mock.results[0]?.value as ReturnType<
      typeof setInterval
    >;

    await fireEvent.press(screen.getByLabelText('Stop rest timer'));

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });

  it('clears its own interval when unmounted mid-countdown', async () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    const rendered = await render(<RestCountdown />);
    await fireEvent.press(
      screen.getByLabelText('Start rest timer, 90 seconds'),
    );
    await act(() => jest.advanceTimersByTime(10_000));
    const intervalId = setIntervalSpy.mock.results[0]?.value as ReturnType<
      typeof setInterval
    >;

    await act(() => rendered.unmount());

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });
});
