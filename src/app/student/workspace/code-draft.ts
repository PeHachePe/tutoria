/**
 * The code the editor has and the server does not yet, kept per attempt in this browser (D-041):
 * a cut in the network, an expired session or a closed tab never lose what the student typed.
 */
export interface CodeDraft {
  readonly code: string;
  /**
   * The server's code the draft started from: if the server has another one now (another device
   * saved since), the draft is older than the server and is dropped.
   */
  readonly base: string;
}

const DRAFT_KEY = 'tutoria.code-draft';

function draftKey(attemptId: string): string {
  return `${DRAFT_KEY}.${attemptId}`;
}

export function readDraft(attemptId: string): CodeDraft | undefined {
  try {
    const draft: unknown = JSON.parse(localStorage.getItem(draftKey(attemptId)) ?? 'null');
    return isDraft(draft) ? draft : undefined;
  } catch {
    // Unavailable storage or a broken value: as without a draft
    return undefined;
  }
}

export function saveDraft(attemptId: string, draft: CodeDraft): void {
  try {
    localStorage.setItem(draftKey(attemptId), JSON.stringify(draft));
  } catch {
    // Storage unavailable or full: the code still goes to the server as usual
  }
}

export function clearDraft(attemptId: string): void {
  try {
    localStorage.removeItem(draftKey(attemptId));
  } catch {
    // Storage unavailable: there was no draft to clear
  }
}

function isDraft(value: unknown): value is CodeDraft {
  const draft = value as Partial<CodeDraft> | null;
  return typeof draft?.code === 'string' && typeof draft.base === 'string';
}
