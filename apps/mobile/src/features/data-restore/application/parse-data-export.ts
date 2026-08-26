import { err, ok, type Result } from '@fitness/domain';
import { dataExportFormat } from '../../data-export/application/data-export-contract';
import { DataRestoreError, isDataRestoreError } from './data-restore-error';
import { asObject } from './data-restore-parsing';
import { dataRestorePolicy } from './data-restore-policy';
import {
  parseDataExportV1,
  parseDataExportV2,
} from './parse-data-export-versions';
import type { ParsedDataExport } from './restore-data';

/**
 * The version boundary.
 *
 * A saved file is only ever read by the parser for the version it declares.
 * Version 2 added its branch here rather than a migration framework, exactly
 * as this boundary was designed to accept it; a future version 3 adds another
 * branch the same way. The format constant is imported from the export
 * contract so the two sides of one public promise cannot drift apart.
 *
 * The discriminator is read leniently on purpose: a file with no `format` at
 * all is not a malformed Fitness App export, it is a different file, and saying
 * so is more useful than reporting a structural failure.
 */
export function parseDataExport(
  text: string,
  currentLocalCalendarDate: string,
): Result<ParsedDataExport, DataRestoreError> {
  try {
    const document = asObject(parseJson(text));
    if (document['format'] !== dataExportFormat)
      throw new DataRestoreError('unsupported-format');
    const formatVersion = document['formatVersion'];
    if (formatVersion === 1)
      return ok(parseDataExportV1(document, currentLocalCalendarDate));
    if (formatVersion === dataRestorePolicy.currentFormatVersion)
      return ok(parseDataExportV2(document, currentLocalCalendarDate));
    throw new DataRestoreError('unsupported-format-version');
  } catch (error: unknown) {
    return err(
      isDataRestoreError(error)
        ? error
        : new DataRestoreError('invalid-structure', { cause: error }),
    );
  }
}

/** U+FFFD only appears where a decoder could not represent the input bytes. */
const replacementCharacter = '�';

function parseJson(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error: unknown) {
    // Text that both failed to parse and carries replacement characters was
    // almost certainly not UTF-8, and saying so is more useful than "invalid
    // JSON". The two conditions are required together so a valid export whose
    // own note text contains U+FFFD is never rejected as an encoding failure.
    throw new DataRestoreError(
      text.includes(replacementCharacter) ? 'invalid-encoding' : 'invalid-json',
      { cause: error },
    );
  }
}
