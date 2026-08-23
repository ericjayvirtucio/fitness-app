import type { DatabaseConnection } from './database';
import { toPersistenceError } from './persistence-error';

/**
 * Returns this installation's device identifier, generating and persisting
 * one on first call. The identifier is a random, locally generated value with
 * no personal or platform-derived content; it is provenance for a future sync
 * design, never a value this application transmits or exports today.
 */
export async function getOrCreateDeviceId(
  database: DatabaseConnection,
  randomUUID: () => string,
): Promise<string> {
  try {
    const existing = await database.getFirst<{ device_id: string }>(
      'SELECT device_id FROM device_identity WHERE singleton_id = 1',
    );
    if (existing !== null) return existing.device_id;

    const deviceId = randomUUID();
    await database.run(
      'INSERT INTO device_identity (singleton_id, device_id) VALUES (1, ?)',
      [deviceId],
    );
    return deviceId;
  } catch (error: unknown) {
    throw toPersistenceError(error, 'operation-failed');
  }
}
