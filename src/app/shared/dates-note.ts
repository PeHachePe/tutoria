import { schoolYearShiftDays } from '../data/school-year-shift';

/** Like `2026/27` and of two years in a row. */
const SCHOOL_YEAR = /^(\d{4})\/(\d{2})$/;

/**
 * Where the dates of copied blocks fall, said before copying (5.2c, D-079): the same ones in the
 * same year, the same weekday in another, or nothing while the year is not valid. Grupos
 * («Duplicar») and Bloques («Copiar de otro grupo») say it alike.
 */
export function datesNote(sourceYear: string, targetYear: string): string | null {
  const match = SCHOOL_YEAR.exec(targetYear);
  if (!match || (Number(match[1]) + 1) % 100 !== Number(match[2])) return null;
  if (schoolYearShiftDays(sourceYear, targetYear) === 0) {
    return $localize`:@@datesNote.same:Las mismas fechas de apertura y entrega.`;
  }
  return $localize`:@@datesNote.moved:Las fechas de apertura y entrega pasan a ${targetYear}:year:, el mismo día de la semana.`;
}
