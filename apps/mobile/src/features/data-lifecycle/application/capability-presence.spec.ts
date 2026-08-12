import { parseDataExport } from '../../data-restore/application/parse-data-export';
import type { RestoreData } from '../../data-restore/application/restore-data';
import {
  buildActiveSession,
  buildEmptyExport,
  buildExport,
  syntheticToday,
} from '../../data-restore/application/synthetic-data-export.spec-helper';
import {
  isSameCapabilityPresence,
  toExpectedCapabilityPresence,
} from './capability-presence';

function parse(document: Record<string, unknown>): RestoreData {
  const parsed = parseDataExport(JSON.stringify(document), syntheticToday);
  if (!parsed.isSuccess) throw new Error('the synthetic export must be valid');
  return parsed.value.data;
}

describe('toExpectedCapabilityPresence', () => {
  it('expects every capability to hold records for a complete export', () => {
    expect(toExpectedCapabilityPresence(parse(buildExport()))).toEqual({
      bodyWeight: true,
      exerciseCatalog: true,
      goal: true,
      hydration: true,
      nutrition: true,
      personalProfile: true,
      workoutPlanner: true,
      workoutSession: true,
    });
  });

  it('expects nothing anywhere for a valid empty export', () => {
    const expected = toExpectedCapabilityPresence(parse(buildEmptyExport()));

    expect(Object.values(expected).every((value) => value === false)).toBe(
      true,
    );
  });

  it('expects hydration to hold records when only a current target is present', () => {
    const data = parse(
      buildExport({
        hydration: { currentTarget: { targetMilliliters: 2_000 }, entries: [] },
      }),
    );

    expect(toExpectedCapabilityPresence(data).hydration).toBe(true);
  });

  it('expects a workout session when the export carries only an active one', () => {
    const data = parse(
      buildExport({
        workoutSessions: {
          activeSession: buildActiveSession(),
          completedSessions: [],
        },
      }),
    );

    expect(toExpectedCapabilityPresence(data).workoutSession).toBe(true);
  });
});

describe('isSameCapabilityPresence', () => {
  const populated = toExpectedCapabilityPresence(parse(buildExport()));
  const empty = toExpectedCapabilityPresence(parse(buildEmptyExport()));

  it('accepts an installation whose capabilities match the export', () => {
    expect(isSameCapabilityPresence(populated, populated)).toBe(true);
    expect(isSameCapabilityPresence(empty, empty)).toBe(true);
  });

  it('rejects a capability that holds nothing when the export populates it', () => {
    expect(
      isSameCapabilityPresence(populated, { ...populated, goal: false }),
    ).toBe(false);
  });

  it('rejects a capability that holds records when the export leaves it empty', () => {
    expect(isSameCapabilityPresence(empty, { ...empty, nutrition: true })).toBe(
      false,
    );
  });
});
