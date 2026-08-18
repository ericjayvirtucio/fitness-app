import { DomainId } from '@fitness/domain';
import type { ExercisePersonalRecord } from '../application/exercise-personal-records';
import {
  absentRecordedLoadVolumeMessage,
  describePersonalRecord,
  formatPersonalRecordSpokenValue,
  formatPersonalRecordValue,
  formatRecordedDistance,
  formatRecordedLoadVolume,
  formatRecordedLoadVolumeSummary,
  formatRecordedMass,
} from './workout-history-formatting';

function sessionId(): DomainId {
  const result = DomainId.create('550e8400-e29b-41d4-a716-446655440000');
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function record(
  overrides: Partial<ExercisePersonalRecord> = {},
): ExercisePersonalRecord {
  return {
    canonicalValue: 60_000,
    category: 'heaviest-load',
    loggingMode: 'external-load-and-repetitions',
    occurrence: {
      exerciseNameSnapshot: 'Bench Press',
      sessionId: sessionId(),
      sessionNameSnapshot: 'Push Day',
      setPosition: 2,
      startedLocalCalendarDate: '2026-08-08',
    },
    ...overrides,
  };
}

describe('workout history formatting', () => {
  it('rounds converted measurements instead of printing raw division', () => {
    expect(formatRecordedMass(453.59237, 'imperial')).toBe('1 lb');
    expect(formatRecordedMass(60_000, 'metric')).toBe('60 kg');
    expect(formatRecordedDistance(1_609_344, 'imperial')).toBe('1 mi');
    expect(formatRecordedDistance(5_000_000, 'metric')).toBe('5 km');
  });

  it('writes each record dimension in its preferred unit', () => {
    expect(formatPersonalRecordValue(record(), 'metric')).toBe('60 kg');
    expect(
      formatPersonalRecordValue(
        record({ canonicalValue: 12, category: 'most-repetitions' }),
        'metric',
      ),
    ).toBe('12 reps');
    expect(
      formatPersonalRecordValue(
        record({ canonicalValue: 1_800, category: 'longest-duration' }),
        'metric',
      ),
    ).toBe('30 min 0 sec');
    expect(
      formatPersonalRecordValue(
        record({ canonicalValue: 5_000_000, category: 'longest-distance' }),
        'metric',
      ),
    ).toBe('5 km');
  });

  it('speaks units as words for assistive technology', () => {
    expect(formatPersonalRecordSpokenValue(record(), 'metric')).toBe(
      '60 kilograms',
    );
    expect(formatPersonalRecordSpokenValue(record(), 'imperial')).toBe(
      '132.28 pounds',
    );
    expect(
      formatPersonalRecordSpokenValue(
        record({ canonicalValue: 1, category: 'most-repetitions' }),
        'metric',
      ),
    ).toBe('1 repetition');
    expect(
      formatPersonalRecordSpokenValue(
        record({ canonicalValue: 90, category: 'longest-duration' }),
        'metric',
      ),
    ).toBe('1 minute 30 seconds');
    expect(
      formatPersonalRecordSpokenValue(
        record({ canonicalValue: 5_000_000, category: 'longest-distance' }),
        'metric',
      ),
    ).toBe('5 kilometers');
  });

  it('writes and speaks assistance in both unit systems', () => {
    const assisted = record({
      canonicalValue: 22_500,
      category: 'least-assistance',
      loggingMode: 'assistance-and-repetitions',
    });

    expect(formatPersonalRecordValue(assisted, 'metric')).toBe('22.5 kg');
    expect(formatPersonalRecordValue(assisted, 'imperial')).toBe('49.6 lb');
    expect(formatPersonalRecordSpokenValue(assisted, 'metric')).toBe(
      '22.5 kilograms',
    );
    expect(formatPersonalRecordSpokenValue(assisted, 'imperial')).toBe(
      '49.6 pounds',
    );
  });

  it('claims the assistance a record needed and nothing about repetitions', () => {
    const description = describePersonalRecord(
      record({
        canonicalValue: 22_500,
        category: 'least-assistance',
        loggingMode: 'assistance-and-repetitions',
      }),
      'metric',
      false,
    );

    expect(description).toContain('Least recorded assistance in a set');
    expect(description).toContain('22.5 kilograms');
    expect(description).toContain('in Push Day');
    expect(description).toContain('set 3');
    expect(description).not.toMatch(/repetition/i);
    expect(description).not.toMatch(/best|strongest|easier|progress|score/i);
  });

  it('describes a record with its evidence and no unsupported claim', () => {
    const description = describePersonalRecord(record(), 'metric', false);

    expect(description).toContain('Heaviest recorded load in a set');
    expect(description).toContain('60 kilograms');
    expect(description).toContain('in Push Day');
    expect(description).toContain('set 3');
    expect(description).not.toMatch(/best|strongest|estimated|score/i);
  });

  it('names the captured snapshot only when it differs from the heading', () => {
    expect(describePersonalRecord(record(), 'metric', false)).not.toContain(
      'recorded as',
    );
    expect(describePersonalRecord(record(), 'metric', true)).toContain(
      'recorded as Bench Press',
    );
  });

  it('states what a recorded load volume covers, in both unit systems', () => {
    expect(formatRecordedLoadVolumeSummary(160_000, 'metric')).toBe(
      '160 kg-reps recorded load volume from weighted sets',
    );
    expect(formatRecordedLoadVolumeSummary(453_592.37, 'imperial')).toBe(
      '1,000 lb-reps recorded load volume from weighted sets',
    );
  });

  it('states the absence in the same words, with no unit and no number', () => {
    expect(absentRecordedLoadVolumeMessage).toBe(
      'No recorded load volume from weighted sets',
    );
    expect(absentRecordedLoadVolumeMessage).not.toMatch(/0|kg|lb/);
  });

  it('keeps the bare value formatter unchanged for its existing callers', () => {
    expect(formatRecordedLoadVolume(160_000, 'metric')).toBe('160 kg-reps');
    expect(formatRecordedLoadVolume(453_592.37, 'imperial')).toBe(
      '1,000 lb-reps',
    );
  });

  it('claims coverage and nothing about the work it does not count', () => {
    const sentence = formatRecordedLoadVolumeSummary(160_000, 'metric');
    for (const forbidden of [
      'assist',
      'bodyweight',
      'because',
      'only',
      'excluded',
      'instead',
    ])
      expect(sentence.toLowerCase()).not.toContain(forbidden);
  });
});
