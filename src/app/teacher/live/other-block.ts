import type { ClassBlock } from '../../data/exercise';
import type { LiveExercise } from '../../data/live-service';
import { blockTitle, type ContentLocale } from '../../data/localized-text';

/**
 * The title of the block of an exercise when it is not the block the panel shows («Tema 2»), so a
 * row or an entry of the queue says where the student works; always with the whole class (`blockId`
 * null). Null for the chosen block, without an exercise or if its block is gone.
 */
export function otherBlockTitle(
  blocks: readonly ClassBlock[],
  exercise: LiveExercise | null,
  blockId: string | null,
  locale: ContentLocale,
): string | null {
  if (!exercise || exercise.blockId === blockId) return null;
  const block = blocks.find((candidate) => candidate.id === exercise.blockId);
  return block ? blockTitle(block, locale).title : null;
}
