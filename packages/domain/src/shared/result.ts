export type Result<TValue, TError> =
  | Readonly<{ isSuccess: true; value: TValue }>
  | Readonly<{ error: TError; isSuccess: false }>;

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return Object.freeze({ isSuccess: true, value });
}

export function err<TError>(error: TError): Result<never, TError> {
  return Object.freeze({ error, isSuccess: false });
}

export function isOk<TValue, TError>(
  result: Result<TValue, TError>,
): result is Readonly<{ isSuccess: true; value: TValue }> {
  return result.isSuccess;
}

export function isErr<TValue, TError>(
  result: Result<TValue, TError>,
): result is Readonly<{ error: TError; isSuccess: false }> {
  return !result.isSuccess;
}
