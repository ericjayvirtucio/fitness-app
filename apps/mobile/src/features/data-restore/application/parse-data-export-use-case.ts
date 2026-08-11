import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import { parseDataExport } from './parse-data-export';
import type { ParsedDataExport } from './restore-data';

/**
 * Validates the selected text completely, outside any write transaction.
 *
 * The clock is injected because one domain rule needs it: a profile cannot be
 * born in the future. Nothing else about the restore depends on the current
 * date, and no record is given a timestamp it did not already have.
 */
export class ParseDataExportUseCase {
  constructor(private readonly now: () => Date) {}

  execute(text: string): ParsedDataExport {
    const result = parseDataExport(text, formatLocalCalendarDate(this.now()));
    if (!result.isSuccess) throw result.error;
    return result.value;
  }
}
