import type { AttemptStatus } from '../../data/attempt';

/** The button of a catalog card: what it says and how much it stands out. */
export interface CatalogAction {
  readonly label: string;
  /** Appearance of `matButton`: the exercise left halfway is the one that stands out most. */
  readonly appearance: 'filled' | 'tonal' | 'outlined';
}

const START: CatalogAction = {
  label: $localize`:@@catalog.action.start:Empezar`,
  appearance: 'tonal',
};
const CONTINUE: CatalogAction = {
  label: $localize`:@@catalog.action.continue:Continuar`,
  appearance: 'filled',
};
const REVIEW: CatalogAction = {
  label: $localize`:@@catalog.action.review:Repasar`,
  appearance: 'outlined',
};

/** Start a new exercise, continue an open attempt or review a submitted one (2.2, 2.4). */
export function catalogAction(status: AttemptStatus): CatalogAction {
  switch (status) {
    case 'not_started':
      return START;
    case 'submitted':
      return REVIEW;
    default:
      return CONTINUE;
  }
}
