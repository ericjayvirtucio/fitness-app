/**
 * The platform work a restore needs, described without Expo types so the
 * application layer stays free of filesystem and picker types.
 *
 * Selecting and reading sit behind one port because they are one interaction
 * with one platform-owned file: the picker grants access to exactly that file,
 * and the application reads it once and never touches it again. Cancellation is
 * modelled as an outcome, not an error, because dismissing a picker is a normal
 * thing to do.
 */

export type DataRestoreFile = Readonly<{
  byteSize: number;
  uri: string;
}>;

export type DataRestoreSelection =
  | Readonly<{ file: DataRestoreFile; status: 'selected' }>
  | Readonly<{ status: 'cancelled' }>;

export interface DataRestoreFileSource {
  pick(): Promise<DataRestoreSelection>;
  readText(file: DataRestoreFile): Promise<string>;
}
