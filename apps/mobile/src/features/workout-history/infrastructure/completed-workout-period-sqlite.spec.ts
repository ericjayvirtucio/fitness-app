import type { WorkoutHistoryCursor } from '../application/workout-history-models';
import { SyntheticWorkoutHistory } from './synthetic-workout-history.spec-helper';
import { WorkoutHistorySqliteRepository } from './workout-history-sqlite-repository';

/**
 * A period-bounded completed list against a real SQLite engine with the
 * repository's own migrations.
 *
 * Inclusive boundaries, midnight membership, keyset paging inside a period, and
 * the index a bounded page uses are all engine behaviour. A fake that returns
 * the rows it was handed can assert the statement text but cannot assert which
 * workouts come back, which period a workout crossing midnight lands in, or
 * whether the query still avoids a sort.
 */

const reps = (repetitions: number) => ({
  loggingMode: 'repetitions' as const,
  sets: [{ repetitions }],
});

/** 2026-01-01 is day zero, so a day index is the offset from it. */
const januaryFirst = 0;
const januaryThirtyFirst = 30;
const februaryFirst = 31;

const january = Object.freeze({
  endLocalCalendarDate: '2026-01-31',
  startLocalCalendarDate: '2026-01-01',
});

describe('A period-bounded completed workout list on a real database', () => {
  let history: SyntheticWorkoutHistory;

  afterEach(() => {
    history.close();
  });

  it('includes both boundary days and excludes the days beside them', async () => {
    history = await SyntheticWorkoutHistory.create();
    await history.store(
      { dayIndex: januaryFirst, exercises: [reps(10)], name: 'First of Jan' },
      { dayIndex: 15, exercises: [reps(10)], name: 'Mid Jan' },
      {
        dayIndex: januaryThirtyFirst,
        exercises: [reps(10)],
        name: 'Last of Jan',
      },
      { dayIndex: februaryFirst, exercises: [reps(10)], name: 'First of Feb' },
    );

    const page = await new WorkoutHistorySqliteRepository(
      history.database,
    ).listCompletedPage({ limit: 20, range: january });

    expect(page.items.map((item) => item.nameSnapshot)).toEqual([
      'Last of Jan',
      'Mid Jan',
      'First of Jan',
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('keeps a workout that finishes after midnight in the period it started in', async () => {
    history = await SyntheticWorkoutHistory.create();
    await history.store({
      dayIndex: januaryThirtyFirst,
      exercises: [reps(10)],
      name: 'Late Night',
      startHour: 23,
    });

    const repository = new WorkoutHistorySqliteRepository(history.database);
    const januaryPage = await repository.listCompletedPage({
      limit: 20,
      range: january,
    });
    const februaryPage = await repository.listCompletedPage({
      limit: 20,
      range: {
        endLocalCalendarDate: '2026-02-28',
        startLocalCalendarDate: '2026-02-01',
      },
    });

    expect(januaryPage.items.map((item) => item.nameSnapshot)).toEqual([
      'Late Night',
    ]);
    expect(januaryPage.items[0]?.completedAtEpochMilliseconds).toBe(
      Date.UTC(2026, 1, 1, 0),
    );
    expect(februaryPage.items).toEqual([]);
  });

  it('pages through every workout in a period exactly once and then stops', async () => {
    history = await SyntheticWorkoutHistory.create();
    await history.store(
      ...Array.from({ length: 5 }, (_unused, index) => ({
        dayIndex: index,
        exercises: [reps(10)],
        name: `January ${index + 1}`,
      })),
      { dayIndex: februaryFirst, exercises: [reps(10)], name: 'February 1' },
    );
    const repository = new WorkoutHistorySqliteRepository(history.database);

    const names: string[] = [];
    let cursor: WorkoutHistoryCursor | undefined;
    let pageCount = 0;
    do {
      const page = await repository.listCompletedPage(
        cursor === undefined
          ? { limit: 2, range: january }
          : { cursor, limit: 2, range: january },
      );
      names.push(...page.items.map((item) => item.nameSnapshot));
      cursor = page.nextCursor ?? undefined;
      pageCount += 1;
    } while (cursor !== undefined);

    expect(pageCount).toBe(3);
    expect(names).toEqual([
      'January 5',
      'January 4',
      'January 3',
      'January 2',
      'January 1',
    ]);
  });

  it('returns an empty page and no cursor for a period holding no workouts', async () => {
    history = await SyntheticWorkoutHistory.create();
    await history.store({
      dayIndex: februaryFirst,
      exercises: [reps(10)],
      name: 'February 1',
    });

    const page = await new WorkoutHistorySqliteRepository(
      history.database,
    ).listCompletedPage({ limit: 20, range: january });

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('lists every completed workout when no range is given', async () => {
    history = await SyntheticWorkoutHistory.create();
    await history.store(
      { dayIndex: januaryFirst, exercises: [reps(10)], name: 'January 1' },
      { dayIndex: februaryFirst, exercises: [reps(10)], name: 'February 1' },
      {
        dayIndex: februaryFirst,
        exercises: [reps(10)],
        name: 'Still Active',
        status: 'active',
      },
    );

    const page = await new WorkoutHistorySqliteRepository(
      history.database,
    ).listCompletedPage({ limit: 20 });

    expect(page.items.map((item) => item.nameSnapshot)).toEqual([
      'February 1',
      'January 1',
    ]);
  });

  it('reads a bounded page through the completed local date index without sorting', async () => {
    history = await SyntheticWorkoutHistory.create();
    await history.store({
      dayIndex: januaryFirst,
      exercises: [reps(10)],
      name: 'January 1',
    });

    const plan = await history.database.getAll<{ detail: string }>(
      `EXPLAIN QUERY PLAN
        SELECT session.id FROM workout_session session
        WHERE session.status = ?
          AND session.started_local_calendar_date BETWEEN ? AND ?
        ORDER BY session.started_local_calendar_date DESC,
          session.started_at_epoch_ms DESC, session.id DESC
        LIMIT ?`,
      [
        'completed',
        january.startLocalCalendarDate,
        january.endLocalCalendarDate,
        21,
      ],
    );

    const details = plan.map((row) => row.detail).join('\n');
    expect(details).toContain('workout_session_completed_local_date');
    expect(details).not.toContain('TEMP B-TREE');
  });
});
