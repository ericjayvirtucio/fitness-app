import { DomainId, type Result } from '@fitness/domain';
import {
  DataRestoreError,
  type DataRestoreErrorCode,
} from './data-restore-error';
import { dataRestorePolicy } from './data-restore-policy';

/**
 * Narrowing helpers for a document this application did not write.
 *
 * Every value starts as `unknown` and becomes a typed value only by passing a
 * guard here. Nothing is cast, and the export contract's TypeScript interfaces
 * are deliberately not used as parse targets: they describe what the exporter
 * writes, not what an arbitrary file contains.
 *
 * Failures throw rather than returning a result at every field, which keeps the
 * section parsers readable. `parseDataExport` is the only caller and turns the
 * throw back into a `Result`, so no exception escapes the capability.
 */

export function fail(code: DataRestoreErrorCode): never {
  throw new DataRestoreError(code);
}

export type JsonObject = Readonly<Record<string, unknown>>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asObject(value: unknown): JsonObject {
  if (!isJsonObject(value)) fail('invalid-structure');
  return value;
}

/** A required key must be present; optionality is expressed with `null`. */
export function member(source: JsonObject, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(source, key))
    fail('invalid-structure');
  return source[key];
}

export function objectMember(source: JsonObject, key: string): JsonObject {
  return asObject(member(source, key));
}

export function asString(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > dataRestorePolicy.maximumStringLength
  )
    fail('invalid-structure');
  return value;
}

export function asFiniteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail('invalid-structure');
  return value;
}

export function asInteger(value: unknown): number {
  const parsed = asFiniteNumber(value);
  if (!Number.isInteger(parsed)) fail('invalid-structure');
  return parsed;
}

export function asBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') fail('invalid-structure');
  return value;
}

export function asArray(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) fail('invalid-structure');
  const items: readonly unknown[] = value;
  if (items.length > maximum) fail('too-many-records');
  return items;
}

export function asEnum<TOption extends number | string>(
  value: unknown,
  options: readonly TOption[],
): TOption {
  const match = options.find((candidate) => candidate === value);
  if (match === undefined) fail('invalid-structure');
  return match;
}

export function asNullable<TValue>(
  value: unknown,
  read: (value: unknown) => TValue,
): TValue | null {
  return value === null ? null : read(value);
}

export function asId(value: unknown): DomainId {
  const id = DomainId.create(value);
  if (!id.isSuccess) fail('invalid-structure');
  return id.value;
}

/** Rejects a repeated identifier before anything reaches the database. */
export function claimId(seen: Set<string>, id: DomainId): DomainId {
  if (seen.has(id.value)) fail('duplicate-identifier');
  seen.add(id.value);
  return id;
}

/**
 * Domain constructors decide business validity. Their rejection is reported as
 * an unacceptable record, never with the domain's own message, which can name a
 * field and echo a bound.
 */
export function required<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) fail('invalid-record');
  return result.value;
}
