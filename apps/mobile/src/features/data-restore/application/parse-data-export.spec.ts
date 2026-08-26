import type { DataRestoreErrorCode } from './data-restore-error';
import { parseDataExport } from './parse-data-export';
import type { ParsedDataExport } from './restore-data';
import {
  buildCheckIn,
  buildCompletedSession,
  buildActiveSession,
  buildEmptyExport,
  buildExport,
  buildHydrationEntry,
  buildPlannedWorkout,
  buildProfile,
  buildResult,
  buildSessionExercise,
  syntheticIds as ids,
  syntheticLocalCalendarDate as localCalendarDate,
  syntheticOccurredAt as occurredAt,
  syntheticToday as today,
  syntheticUtcOffsetMinutes as utcOffsetMinutes,
  type Json,
} from './synthetic-data-export.spec-helper';

function parse(document: Json): ParsedDataExport {
  const result = parseDataExport(JSON.stringify(document), today);
  if (!result.isSuccess)
    throw new Error(`expected a valid export but got ${result.error.code}`);
  return result.value;
}

function expectRejection(document: Json, code: DataRestoreErrorCode): void {
  expectTextRejection(JSON.stringify(document), code);
}

function expectTextRejection(text: string, code: DataRestoreErrorCode): void {
  const result = parseDataExport(text, today);
  if (result.isSuccess) throw new Error('expected the export to be rejected');
  expect(result.error.code).toBe(code);
}

describe('parseDataExport', () => {
  it('reads a complete version 1 export', () => {
    const { data, preview } = parse(buildExport());

    expect(preview).toEqual({
      bodyWeightCheckIns: 1,
      completedWorkouts: 1,
      exercises: 1,
      generatedAt: '2026-08-11T09:15:04.123Z',
      hasActiveWorkout: false,
      hasGoal: true,
      hasHydrationTarget: true,
      hasProfile: true,
      hydrationEntries: 1,
      nutritionCatalogItems: 1,
      nutritionEntries: 1,
      plannedWorkouts: 1,
    });
    expect(data.profile?.weight.grams).toBe(72_000);
    expect(data.goal?.adjustmentKilocalories).toBe(300);
  });

  it('reads a valid empty export as a success', () => {
    const { data, preview } = parse(buildEmptyExport());

    expect(preview.hasProfile).toBe(false);
    expect(preview.nutritionEntries).toBe(0);
    expect(data.completedSessions).toHaveLength(0);
  });

  it('preserves exported identifiers exactly', () => {
    const { data } = parse(buildExport());

    expect(data.nutritionEntries[0]?.id.value).toBe(ids.nutritionEntry);
    expect(data.exercises[0]?.definition.id.value).toBe(ids.squat);
    expect(data.completedSessions[0]?.exercises[0]?.sets[0]?.id.value).toBe(
      ids.sessionSet,
    );
  });

  it('preserves canonical amounts without conversion', () => {
    const { data } = parse(buildExport());

    expect(data.bodyWeightCheckIns[0]?.mass.grams).toBe(71_500);
    expect(data.hydrationEntries[0]?.volume.milliliters).toBe(500);
    expect(data.hydrationTarget?.volume.milliliters).toBe(2_000);
    expect(data.nutritionEntries[0]?.facts.energy.kilojoules).toBe(1_500);
  });

  it('preserves the stored occurrence triple', () => {
    const { data } = parse(buildExport());
    const entry = data.hydrationEntries[0];

    expect(entry?.occurredAtEpochMilliseconds).toBe(occurredAt);
    expect(entry?.localCalendarDate).toBe(localCalendarDate);
    expect(entry?.utcOffsetMinutes).toBe(utcOffsetMinutes);
  });

  it('keeps an unknown nutrient unknown and a known zero zero', () => {
    const { data } = parse(buildExport());
    const nutrients = data.nutritionEntries[0]?.facts.nutrients;

    expect(nutrients?.fatGrams).toBeNull();
    expect(nutrients?.carbohydrateGrams).toBe(0);
  });

  it('preserves saved nutrition item favourite and usage state', () => {
    const { data } = parse(buildExport());
    const item = data.nutritionCatalogItems[0];

    expect(item?.isFavorite).toBe(true);
    expect(item?.usage.useCount).toBe(2);
    expect(item?.usage.lastUsedAtEpochMilliseconds).toBe(occurredAt);
  });

  it('ignores an unknown key', () => {
    expect(() =>
      parse(buildExport({ futureSection: { anything: true } })),
    ).not.toThrow();
  });

  it('rejects a file that is not a Fitness App export', () => {
    expectRejection(
      buildExport({ format: 'something-else' }),
      'unsupported-format',
    );
    expectTextRejection('{"hello":"world"}', 'unsupported-format');
  });

  it('rejects an unsupported format version', () => {
    expectRejection(
      buildExport({ formatVersion: 3 }),
      'unsupported-format-version',
    );
  });

  it('rejects invalid JSON', () => {
    expectTextRejection('{ not json', 'invalid-json');
  });

  it('reports contents that did not decode as text', () => {
    expectTextRejection('{ "format": "��', 'invalid-encoding');
  });

  it('does not blame the encoding of a readable file that happens to contain a replacement character', () => {
    const { data } = parse(
      buildExport({
        bodyMeasurements: {
          weightCheckIns: [buildCheckIn({ note: 'E2E � note' })],
        },
      }),
    );

    expect(data.bodyWeightCheckIns[0]?.note).toBe('E2E � note');
  });

  it('rejects a wrong primitive type', () => {
    expectRejection(
      buildExport({ profile: buildProfile({ weightGrams: '72000' }) }),
      'invalid-structure',
    );
  });

  it('rejects a missing required key', () => {
    const document = buildExport();
    delete document['hydration'];

    expectRejection(document, 'invalid-structure');
  });

  it('rejects a null where the contract has no option', () => {
    expectRejection(
      buildExport({ hydration: { currentTarget: null, entries: null } }),
      'invalid-structure',
    );
  });

  it('rejects an unknown enumeration value', () => {
    expectRejection(
      buildExport({
        hydration: {
          currentTarget: null,
          entries: [buildHydrationEntry({ fluidType: 'lemonade' })],
        },
      }),
      'invalid-structure',
    );
  });

  it('rejects a nonfinite number', () => {
    const text = JSON.stringify(buildExport()).replace(
      '"volumeMilliliters":500',
      '"volumeMilliliters":1e999',
    );

    expectTextRejection(text, 'invalid-structure');
  });

  it('rejects an out-of-range value', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: { weightCheckIns: [buildCheckIn({ massGrams: 1 })] },
      }),
      'invalid-record',
    );
  });

  it('rejects a malformed identifier', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: {
          weightCheckIns: [buildCheckIn({ id: 'not-a-uuid' })],
        },
      }),
      'invalid-structure',
    );
  });

  it('rejects a duplicate identifier', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: { weightCheckIns: [buildCheckIn(), buildCheckIn()] },
      }),
      'duplicate-identifier',
    );
  });

  it('rejects a local date that disagrees with the stored instant', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: {
          weightCheckIns: [buildCheckIn({ localCalendarDate: '2026-08-05' })],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects an impossible UTC offset', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: {
          weightCheckIns: [buildCheckIn({ utcOffsetMinutes: 900 })],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects a collection above its ceiling', () => {
    const plannedWorkouts = Array.from({ length: 8 }, (_unused, index) =>
      buildPlannedWorkout({ weekday: index % 7 }),
    );

    expectRejection(
      buildExport({ workoutPlanner: { plannedWorkouts } }),
      'too-many-records',
    );
  });
});

describe('parseDataExport version 2 (reps in reserve)', () => {
  function versionTwoExport(setOverrides: Json = {}): Json {
    return buildExport({
      formatVersion: 2,
      workoutSessions: {
        activeSession: null,
        completedSessions: [
          buildCompletedSession({
            exercises: [
              buildSessionExercise({
                sets: [
                  {
                    id: ids.sessionSet,
                    position: 0,
                    result: buildResult(),
                    ...setOverrides,
                  },
                ],
              }),
            ],
          }),
        ],
      },
    });
  }

  it('reads a version 2 export with no reps-in-reserve estimate', () => {
    const { data } = parse(versionTwoExport({ repsInReserve: null }));

    expect(
      data.completedSessions[0]?.exercises[0]?.sets[0]?.repsInReserve,
    ).toBeNull();
  });

  it('reads a version 2 export recording zero reps in reserve', () => {
    const { data } = parse(versionTwoExport({ repsInReserve: 0 }));

    expect(
      data.completedSessions[0]?.exercises[0]?.sets[0]?.repsInReserve,
    ).toBe(0);
  });

  it('reads a version 2 export recording a nonzero reps-in-reserve estimate', () => {
    const { data } = parse(versionTwoExport({ repsInReserve: 4 }));

    expect(
      data.completedSessions[0]?.exercises[0]?.sets[0]?.repsInReserve,
    ).toBe(4);
  });

  it('treats a version 1 set as recording no reps-in-reserve estimate, even if present', () => {
    const document = buildExport();
    const set = (
      (
        (document['workoutSessions'] as Json)['completedSessions'] as Json[]
      )[0]?.['exercises'] as Json[]
    )[0]?.['sets'] as Json[];
    if (set[0]) set[0]['repsInReserve'] = 7;

    const { data } = parse(document);

    expect(
      data.completedSessions[0]?.exercises[0]?.sets[0]?.repsInReserve,
    ).toBeNull();
  });

  it('rejects a negative reps-in-reserve value', () => {
    expectRejection(versionTwoExport({ repsInReserve: -1 }), 'invalid-record');
  });

  it('rejects a reps-in-reserve value above the accepted range', () => {
    expectRejection(versionTwoExport({ repsInReserve: 11 }), 'invalid-record');
  });

  it('rejects a fractional reps-in-reserve value', () => {
    expectRejection(
      versionTwoExport({ repsInReserve: 2.5 }),
      'invalid-structure',
    );
  });

  it('rejects a reps-in-reserve value of the wrong type', () => {
    expectRejection(
      versionTwoExport({ repsInReserve: '2' }),
      'invalid-structure',
    );
  });

  it('rejects reps-in-reserve recorded on a duration-only set', () => {
    expectRejection(
      buildExport({
        formatVersion: 2,
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise({
                  loggingModeSnapshot: 'duration',
                  plannedPrescriptionSnapshot: null,
                  sets: [
                    {
                      id: ids.sessionSet,
                      position: 0,
                      repsInReserve: 2,
                      result: { durationSeconds: 60, kind: 'duration' },
                    },
                  ],
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });
});

describe('parseDataExport referential integrity', () => {
  it('rejects a planned exercise whose definition is missing', () => {
    expectRejection(
      buildExport({ exerciseCatalog: { exercises: [] } }),
      'unresolved-reference',
    );
  });

  it('allows a completed workout to reference a deleted definition', () => {
    const { data } = parse(
      buildExport({
        exerciseCatalog: { exercises: [] },
        workoutPlanner: { plannedWorkouts: [] },
      }),
    );

    expect(
      data.completedSessions[0]?.exercises[0]?.sourceExerciseDefinitionId.value,
    ).toBe(ids.squat);
    expect(data.exercises).toHaveLength(0);
  });

  it('rejects a repeated weekday in the planner', () => {
    expectRejection(
      buildExport({
        workoutPlanner: {
          plannedWorkouts: [
            buildPlannedWorkout(),
            buildPlannedWorkout({ id: ids.session }),
          ],
        },
      }),
      'duplicate-identifier',
    );
  });

  it('rejects duplicate exercise positions in a session', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise(),
                buildSessionExercise({
                  id: ids.activeSessionExercise,
                  sets: [
                    {
                      id: ids.activeSessionSet,
                      position: 0,
                      result: buildResult(),
                    },
                  ],
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects duplicate set positions', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise({
                  sets: [
                    { id: ids.sessionSet, position: 0, result: buildResult() },
                    {
                      id: ids.activeSessionSet,
                      position: 0,
                      result: buildResult(),
                    },
                  ],
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects a result the logging mode cannot produce', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise({
                  sets: [
                    {
                      id: ids.sessionSet,
                      position: 0,
                      result: { durationSeconds: 60, kind: 'duration' },
                    },
                  ],
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects a planned prescription the logging mode cannot produce', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise({
                  plannedPrescriptionSnapshot: {
                    durationSeconds: 60,
                    kind: 'duration',
                    sets: 3,
                  },
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects an active session listed among completed workouts', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              completedAtEpochMilliseconds: null,
              status: 'active',
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects a completion instant before the start', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              completedAtEpochMilliseconds: occurredAt - 1,
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('keeps the active session out of completed history', () => {
    const { data, preview } = parse(
      buildExport({
        workoutSessions: {
          activeSession: buildActiveSession(),
          completedSessions: [buildCompletedSession()],
        },
      }),
    );

    expect(preview.hasActiveWorkout).toBe(true);
    expect(preview.completedWorkouts).toBe(1);
    expect(data.activeSession?.status).toBe('active');
    expect(data.activeSession?.completedAtEpochMilliseconds).toBeNull();
  });
});
