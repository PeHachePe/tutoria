import { Service } from '@angular/core';

import { formatCode, type FormatResult } from './format-code';

/**
 * Puts the code of the editor in order (2.5d), with Prettier downloaded the first time. A service, so
 * the editor gets it by injection and a test can give it one that fails, as it would offline.
 */
@Service()
export class CodeFormatter {
  format(code: string, cursor: number): Promise<FormatResult> {
    return formatCode(code, cursor);
  }
}
