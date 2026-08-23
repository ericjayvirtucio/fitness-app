import { UserProfile, isErr } from '@fitness/domain';
import type { PersonalProfileRepository } from '../application/personal-profile-repository';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import { queueOutboxEntry } from '../../../infrastructure/persistence/sync-outbox';

const tableName = 'personal_profile';

type PersonalProfileRow = Readonly<{
  activity_level: string;
  biological_sex: string;
  date_of_birth: string;
  height_millimeters: number;
  preferred_unit_system: string;
  weight_grams: number;
}>;

export class PersonalProfileSqliteRepository implements PersonalProfileRepository {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  async get(): Promise<UserProfile | null> {
    try {
      const row = await this.database.getFirst<PersonalProfileRow>(
        `SELECT height_millimeters, weight_grams, biological_sex,
                date_of_birth, activity_level, preferred_unit_system
         FROM personal_profile
         WHERE singleton_id = ? AND deleted_at_epoch_ms IS NULL`,
        [1],
      );
      if (row === null) return null;

      const profile = UserProfile.create(
        {
          activityLevel: row.activity_level,
          biologicalSex: row.biological_sex,
          dateOfBirth: row.date_of_birth,
          heightMillimeters: row.height_millimeters,
          preferredUnitSystem: row.preferred_unit_system,
          weightGrams: row.weight_grams,
        },
        '9999-12-31',
      );
      if (isErr(profile)) throw new PersistenceError('operation-failed');
      return profile.value;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async save(profile: UserProfile): Promise<void> {
    try {
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `INSERT INTO personal_profile (
           singleton_id, height_millimeters, weight_grams, biological_sex,
           date_of_birth, activity_level, preferred_unit_system,
           updated_at_epoch_ms, deleted_at_epoch_ms, revision,
           originating_device_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           height_millimeters = excluded.height_millimeters,
           weight_grams = excluded.weight_grams,
           biological_sex = excluded.biological_sex,
           date_of_birth = excluded.date_of_birth,
           activity_level = excluded.activity_level,
           preferred_unit_system = excluded.preferred_unit_system,
           updated_at_epoch_ms = excluded.updated_at_epoch_ms,
           deleted_at_epoch_ms = NULL,
           revision = personal_profile.revision + 1`,
        [
          1,
          profile.height.millimeters,
          profile.weight.grams,
          profile.biologicalSex,
          profile.dateOfBirth,
          profile.activityLevel,
          profile.preferredUnitSystem,
          nowEpochMs,
          this.deviceId,
        ],
      );
      const stored = await this.database.getFirst<{ revision: number }>(
        'SELECT revision FROM personal_profile WHERE singleton_id = 1',
      );
      await queueOutboxEntry(
        this.database,
        tableName,
        '1',
        'upsert',
        stored?.revision ?? 1,
        nowEpochMs,
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
