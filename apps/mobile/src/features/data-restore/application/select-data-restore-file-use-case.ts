import { DataRestoreError } from './data-restore-error';
import type {
  DataRestoreFile,
  DataRestoreFileSource,
} from './data-restore-file';
import { dataRestorePolicy } from './data-restore-policy';

export type DataRestoreFileContents =
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{ status: 'selected'; text: string }>;

/** U+FFFD only appears when a decoder could not represent the input bytes. */
const replacementCharacter = '�';

/**
 * Opens the system picker and reads exactly one selected file.
 *
 * Size is checked from file metadata before the contents are loaded, so an
 * enormous file is refused without ever being held in memory, and again against
 * the decoded text in case the platform reported no size. Character length is a
 * safe second check: UTF-8 never uses fewer bytes than characters.
 */
export class SelectDataRestoreFileUseCase {
  constructor(private readonly source: DataRestoreFileSource) {}

  async execute(): Promise<DataRestoreFileContents> {
    const selection = await this.pick();
    if (selection.status === 'cancelled')
      return Object.freeze({ status: 'cancelled' });

    assertAcceptableSize(selection.file.byteSize);
    const text = await this.read(selection.file);
    if (text.trim() === '') throw new DataRestoreError('file-empty');
    if (text.length > dataRestorePolicy.maximumFileBytes)
      throw new DataRestoreError('file-too-large');
    if (text.includes(replacementCharacter))
      throw new DataRestoreError('invalid-encoding');

    return Object.freeze({ status: 'selected', text });
  }

  private async pick() {
    try {
      return await this.source.pick();
    } catch (error: unknown) {
      throw new DataRestoreError('picker-unavailable', { cause: error });
    }
  }

  private async read(file: DataRestoreFile): Promise<string> {
    try {
      return await this.source.readText(file);
    } catch (error: unknown) {
      throw new DataRestoreError('file-unreadable', { cause: error });
    }
  }
}

function assertAcceptableSize(byteSize: number): void {
  if (!Number.isFinite(byteSize) || byteSize < 0)
    throw new DataRestoreError('file-unreadable');
  if (byteSize === 0) throw new DataRestoreError('file-empty');
  if (byteSize > dataRestorePolicy.maximumFileBytes)
    throw new DataRestoreError('file-too-large');
}
