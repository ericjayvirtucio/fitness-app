import { DomainError } from './domain-error';
import { err, ok, type Result } from './result';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DomainId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  static create(value: unknown): Result<DomainId, DomainError> {
    if (typeof value !== 'string' || !uuidPattern.test(value)) {
      return err(
        DomainError.create(
          'invalid-identifier',
          'Identifier must be a valid UUID.',
          'identifier',
        ),
      );
    }

    return ok(new DomainId(value.toLowerCase()));
  }

  equals(other: DomainId): boolean {
    return this.value === other.value;
  }
}
