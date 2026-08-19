import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { DomainId } from '@fitness/domain';
import { WorkoutHistoryScreen } from './WorkoutHistoryScreen';

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

function id(value: string) {
  const result = DomainId.create(value);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('WorkoutHistoryScreen', () => {
  it('shows derived progress and opens immutable completed history', async () => {
    const onOpenSession = jest.fn();
    await render(
      <WorkoutHistoryScreen
        loadUseCases={() =>
          Promise.resolve({
            listPerformedExercises: { execute: () => Promise.resolve([]) },
            getProfile: { execute: () => Promise.resolve(null) },
            getSummary: {
              execute: () =>
                Promise.resolve({
                  actualSetCount: 3,
                  completedWorkoutCount: 1,
                  distanceMillimeters: null,
                  durationSeconds: null,
                  elapsedWorkoutSeconds: 1_800,
                  performedExerciseCount: 1,
                  recordedLoadVolumeGramRepetitions: 240_000,
                  repetitions: 24,
                }),
            },
            list: {
              execute: () =>
                Promise.resolve({
                  items: [
                    {
                      actualSetCount: 3,
                      completedAtEpochMilliseconds: 1_800_000,
                      elapsedSeconds: 1_800,
                      exerciseCount: 1,
                      nameSnapshot: 'Push Day',
                      performedExerciseCount: 1,
                      sessionId: id('550e8400-e29b-41d4-a716-446655440000'),
                      startedAtEpochMilliseconds: 0,
                      startedLocalCalendarDate: '2026-08-08',
                      startedUtcOffsetMinutes: 0,
                    },
                  ],
                  nextCursor: null,
                }),
            },
          } as never)
        }
        onOpenSession={onOpenSession}
        onOpenExercise={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Workout History')).toBeOnTheScreen(),
    );
    expect(screen.getByText('1 completed workouts')).toBeOnTheScreen();
    expect(
      screen.getByText('240 kg-reps recorded load volume from weighted sets'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('completed-workout-card'));
    expect(onOpenSession).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('lists a performed exercise whose catalog definition no longer exists', async () => {
    const onOpenExercise = jest.fn();
    await render(
      <WorkoutHistoryScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(null) },
            getSummary: {
              execute: () =>
                Promise.resolve({
                  actualSetCount: 1,
                  completedWorkoutCount: 1,
                  distanceMillimeters: null,
                  durationSeconds: null,
                  elapsedWorkoutSeconds: 600,
                  performedExerciseCount: 1,
                  recordedLoadVolumeGramRepetitions: null,
                  repetitions: 12,
                }),
            },
            list: {
              execute: () => Promise.resolve({ items: [], nextCursor: null }),
            },
            listPerformedExercises: {
              execute: () =>
                Promise.resolve([
                  {
                    exerciseNameSnapshot: 'Removed Push-up',
                    latestStartedLocalCalendarDate: '2026-08-08',
                    sourceExerciseDefinitionId: id(
                      '550e8400-e29b-41d4-a716-446655440000',
                    ),
                  },
                ]),
            },
          } as never)
        }
        onOpenSession={jest.fn()}
        onOpenExercise={onOpenExercise}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Removed Push-up')).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByLabelText('Open performance history for Removed Push-up'),
    );
    expect(onOpenExercise).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('shows an actionable empty state', async () => {
    await render(
      <WorkoutHistoryScreen
        loadUseCases={() =>
          Promise.resolve({
            listPerformedExercises: { execute: () => Promise.resolve([]) },
            getProfile: { execute: () => Promise.resolve(null) },
            getSummary: {
              execute: () =>
                Promise.resolve({
                  actualSetCount: 0,
                  completedWorkoutCount: 0,
                  distanceMillimeters: null,
                  durationSeconds: null,
                  elapsedWorkoutSeconds: 0,
                  performedExerciseCount: 0,
                  recordedLoadVolumeGramRepetitions: null,
                  repetitions: null,
                }),
            },
            list: {
              execute: () => Promise.resolve({ items: [], nextCursor: null }),
            },
          } as never)
        }
        onOpenSession={jest.fn()}
        onOpenExercise={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('No completed workouts yet')).toBeOnTheScreen(),
    );
  });

  it('announces a deletion and shows the empty state when it removed the last workout', async () => {
    await render(
      <WorkoutHistoryScreen
        hasDeletedWorkout
        loadUseCases={() =>
          Promise.resolve({
            listPerformedExercises: { execute: () => Promise.resolve([]) },
            getProfile: { execute: () => Promise.resolve(null) },
            getSummary: {
              execute: () =>
                Promise.resolve({
                  actualSetCount: 0,
                  completedWorkoutCount: 0,
                  distanceMillimeters: null,
                  durationSeconds: null,
                  elapsedWorkoutSeconds: 0,
                  performedExerciseCount: 0,
                  recordedLoadVolumeGramRepetitions: null,
                  repetitions: null,
                }),
            },
            list: {
              execute: () => Promise.resolve({ items: [], nextCursor: null }),
            },
          } as never)
        }
        onOpenSession={jest.fn()}
        onOpenExercise={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Completed workout deleted.')).toBeOnTheScreen(),
    );
    expect(screen.getByText('No completed workouts yet')).toBeOnTheScreen();
    expect(screen.getByText('0 completed workouts')).toBeOnTheScreen();
  });

  describe('the selected period', () => {
    const summary = {
      actualSetCount: 1,
      completedWorkoutCount: 1,
      distanceMillimeters: null,
      durationSeconds: null,
      elapsedWorkoutSeconds: 600,
      performedExerciseCount: 1,
      recordedLoadVolumeGramRepetitions: null,
      repetitions: 12,
    };

    function item(name: string, sessionId: string) {
      return {
        actualSetCount: 1,
        completedAtEpochMilliseconds: 600_000,
        elapsedSeconds: 600,
        exerciseCount: 1,
        nameSnapshot: name,
        performedExerciseCount: 1,
        sessionId: id(sessionId),
        startedAtEpochMilliseconds: 0,
        startedLocalCalendarDate: '2026-08-08',
        startedUtcOffsetMinutes: 0,
      };
    }

    it('reads the list and the summary for the same span, and moves both together', async () => {
      const listRanges: unknown[] = [];
      const summaryRanges: unknown[] = [];
      const list = {
        execute: (query: { range?: { startLocalCalendarDate: string } }) => {
          listRanges.push(query.range);
          return Promise.resolve({
            items: [
              item(
                `Workout of ${query.range?.startLocalCalendarDate ?? 'nowhere'}`,
                '550e8400-e29b-41d4-a716-446655440000',
              ),
            ],
            nextCursor: null,
          });
        },
      };

      await render(
        <WorkoutHistoryScreen
          loadUseCases={() =>
            Promise.resolve({
              getProfile: { execute: () => Promise.resolve(null) },
              getSummary: {
                execute: (range: unknown) => {
                  summaryRanges.push(range);
                  return Promise.resolve(summary);
                },
              },
              list,
              listPerformedExercises: { execute: () => Promise.resolve([]) },
            } as never)
          }
          onOpenExercise={jest.fn()}
          onOpenSession={jest.fn()}
        />,
      );

      await waitFor(() =>
        expect(screen.getByTestId('completed-workout-card')).toBeOnTheScreen(),
      );
      expect(listRanges).toHaveLength(1);
      expect(listRanges[0]).toEqual(summaryRanges[0]);
      const first = listRanges[0];

      await fireEvent.press(screen.getByLabelText('Show previous week'));

      await waitFor(() => expect(listRanges).toHaveLength(2));
      expect(listRanges[1]).not.toEqual(first);
      expect(listRanges[1]).toEqual(summaryRanges[1]);
    });

    it('pages within the period the page on screen belongs to', async () => {
      const queries: { cursor?: unknown; range?: unknown }[] = [];
      const cursor = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        startedAtEpochMilliseconds: 0,
        startedLocalCalendarDate: '2026-08-08',
      };
      const list = {
        execute: (query: { cursor?: unknown; range?: unknown }) => {
          queries.push(query);
          return Promise.resolve(
            query.cursor === undefined
              ? {
                  items: [
                    item('First', '550e8400-e29b-41d4-a716-446655440000'),
                  ],
                  nextCursor: cursor,
                }
              : {
                  items: [
                    item('Second', '550e8400-e29b-41d4-a716-446655440001'),
                  ],
                  nextCursor: null,
                },
          );
        },
      };

      await render(
        <WorkoutHistoryScreen
          loadUseCases={() =>
            Promise.resolve({
              getProfile: { execute: () => Promise.resolve(null) },
              getSummary: { execute: () => Promise.resolve(summary) },
              list,
              listPerformedExercises: { execute: () => Promise.resolve([]) },
            } as never)
          }
          onOpenExercise={jest.fn()}
          onOpenSession={jest.fn()}
        />,
      );

      await waitFor(() => expect(screen.getByText('First')).toBeOnTheScreen());
      await fireEvent.press(screen.getByLabelText('Load More Workouts'));

      await waitFor(() => expect(screen.getByText('Second')).toBeOnTheScreen());
      expect(screen.getByText('First')).toBeOnTheScreen();
      expect(queries).toHaveLength(2);
      expect(queries[1]?.cursor).toEqual(cursor);
      expect(queries[1]?.range).toEqual(queries[0]?.range);
    });

    it('lets only the newest period read write what the screen shows', async () => {
      const pending: ((name: string) => void)[] = [];
      let callCount = 0;
      const list = {
        execute: () => {
          callCount += 1;
          if (callCount === 1)
            return Promise.resolve({
              items: [item('First', '550e8400-e29b-41d4-a716-446655440000')],
              nextCursor: null,
            });
          return new Promise((resolve) => {
            pending.push((name: string) =>
              resolve({
                items: [item(name, '550e8400-e29b-41d4-a716-446655440000')],
                nextCursor: null,
              }),
            );
          });
        },
      };

      await render(
        <WorkoutHistoryScreen
          loadUseCases={() =>
            Promise.resolve({
              getProfile: { execute: () => Promise.resolve(null) },
              getSummary: { execute: () => Promise.resolve(summary) },
              list,
              listPerformedExercises: { execute: () => Promise.resolve([]) },
            } as never)
          }
          onOpenExercise={jest.fn()}
          onOpenSession={jest.fn()}
        />,
      );
      await waitFor(() => expect(screen.getByText('First')).toBeOnTheScreen());

      await fireEvent.press(screen.getByLabelText('Show previous week'));
      await waitFor(() => expect(pending).toHaveLength(1));
      await fireEvent.press(screen.getByLabelText('Show previous week'));
      await waitFor(() => expect(pending).toHaveLength(2));

      // The newer read answers first; the older one answers last and must lose.
      await act(async () => {
        pending[1]?.('Newest period');
        pending[0]?.('Superseded period');
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.getByText('Newest period')).toBeOnTheScreen(),
      );
      expect(screen.queryByText('Superseded period')).not.toBeOnTheScreen();
    });
  });

  describe('summary total coverage', () => {
    function renderSummary(
      summary: Partial<{
        actualSetCount: number;
        distanceMillimeters: number | null;
        durationSeconds: number | null;
        recordedLoadVolumeGramRepetitions: number | null;
        repetitions: number | null;
      }>,
      preferredUnitSystem: 'imperial' | 'metric' = 'metric',
    ) {
      return render(
        <WorkoutHistoryScreen
          loadUseCases={() =>
            Promise.resolve({
              listPerformedExercises: { execute: () => Promise.resolve([]) },
              getProfile: {
                execute: () => Promise.resolve({ preferredUnitSystem }),
              },
              getSummary: {
                execute: () =>
                  Promise.resolve({
                    actualSetCount: 4,
                    completedWorkoutCount: 2,
                    distanceMillimeters: null,
                    durationSeconds: null,
                    elapsedWorkoutSeconds: 2_700,
                    performedExerciseCount: 2,
                    recordedLoadVolumeGramRepetitions: null,
                    repetitions: 32,
                    ...summary,
                  }),
              },
              list: {
                execute: () => Promise.resolve({ items: [], nextCursor: null }),
              },
            } as never)
          }
          onOpenExercise={jest.fn()}
          onOpenSession={jest.fn()}
        />,
      );
    }

    it('states what a covered total counts', async () => {
      await renderSummary({ recordedLoadVolumeGramRepetitions: 160_000 });

      await waitFor(() =>
        expect(
          screen.getByText(
            '160 kg-reps recorded load volume from weighted sets',
          ),
        ).toBeOnTheScreen(),
      );
    });

    it('states the same coverage for a period that also recorded ineligible work', async () => {
      // A mixed period is indistinguishable from an eligible-only one in the
      // reader, which is why the wording is unconditional: the eligible total is
      // unchanged and the sentence is true either way.
      await renderSummary({
        actualSetCount: 9,
        recordedLoadVolumeGramRepetitions: 160_000,
        repetitions: 62,
      });

      await waitFor(() =>
        expect(
          screen.getByText(
            '160 kg-reps recorded load volume from weighted sets',
          ),
        ).toBeOnTheScreen(),
      );
    });

    it('states the absence when work was recorded and none of it counts', async () => {
      await renderSummary({ recordedLoadVolumeGramRepetitions: null });

      await waitFor(() =>
        expect(
          screen.getByText('No recorded load volume from weighted sets'),
        ).toBeOnTheScreen(),
      );
    });

    it('says nothing about load volume when nothing was recorded', async () => {
      await renderSummary({
        actualSetCount: 0,
        recordedLoadVolumeGramRepetitions: null,
        repetitions: null,
      });

      await waitFor(() =>
        expect(screen.getByText('0 actual sets')).toBeOnTheScreen(),
      );
      expect(
        screen.queryByText('No recorded load volume from weighted sets'),
      ).not.toBeOnTheScreen();
      expect(screen.queryByText(/recorded load volume/)).not.toBeOnTheScreen();
    });

    it('writes the covered total in the preferred unit system', async () => {
      await renderSummary(
        { recordedLoadVolumeGramRepetitions: 453_592.37 },
        'imperial',
      );

      await waitFor(() =>
        expect(
          screen.getByText(
            '1,000 lb-reps recorded load volume from weighted sets',
          ),
        ).toBeOnTheScreen(),
      );
    });

    it('announces every sentence it displays, because the card is one element', async () => {
      await renderSummary({ recordedLoadVolumeGramRepetitions: 160_000 });

      await waitFor(() =>
        expect(
          screen.getByLabelText(
            'Workout progress summary, 2 completed workouts, 4 actual sets, 2 performed exercises, 45 min 0 sec workout time, 32 repetitions, 160 kg-reps recorded load volume from weighted sets',
          ),
        ).toBeOnTheScreen(),
      );
    });

    it('announces the absence in the same words it displays it', async () => {
      await renderSummary({ recordedLoadVolumeGramRepetitions: null });

      await waitFor(() =>
        expect(
          screen.getByLabelText(
            'Workout progress summary, 2 completed workouts, 4 actual sets, 2 performed exercises, 45 min 0 sec workout time, 32 repetitions, No recorded load volume from weighted sets',
          ),
        ).toBeOnTheScreen(),
      );
    });
  });
});
