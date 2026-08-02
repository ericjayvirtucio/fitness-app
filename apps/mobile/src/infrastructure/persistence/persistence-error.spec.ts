import { PersistenceError, toPersistenceError } from './persistence-error';

describe('persistence errors', () => {
  it('uses a stable safe message and preserves the cause internally', () => {
    const cause = new Error('database path and raw SQL');
    const error = toPersistenceError(cause, 'operation-failed');

    expect(error).toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
      name: 'PersistenceError',
    });
    expect(error.cause).toBe(cause);
    expect(error.message).not.toContain(cause.message);
  });

  it('does not wrap an already translated persistence error', () => {
    const error = new PersistenceError('migration-failed');

    expect(toPersistenceError(error, 'initialization-failed')).toBe(error);
  });
});
