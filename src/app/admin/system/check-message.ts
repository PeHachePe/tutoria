import type { AiCheckProblem, AiModelCheck } from '../../data/ai-provider-setting';

const PROBLEM_MESSAGES: Readonly<Record<AiCheckProblem, string>> = {
  invalid: $localize`:@@system.problem.invalid:Falta algún dato del proveedor.`,
  host_not_allowed: $localize`:@@system.problem.host:Ese servidor no está permitido: añádelo al secreto AI_ALLOWED_HOSTS.`,
  no_key: $localize`:@@system.problem.noKey:Falta el secreto con su clave en el servidor.`,
  unauthorized: $localize`:@@system.problem.unauthorized:El proveedor rechaza la clave.`,
  not_found: $localize`:@@system.problem.notFound:El proveedor no conoce ese modelo.`,
  rate_limited: $localize`:@@system.problem.rateLimited:El proveedor ha agotado su cuota por ahora.`,
  timeout: $localize`:@@system.problem.timeout:No ha respondido a tiempo.`,
  unavailable: $localize`:@@system.problem.unavailable:El proveedor no está disponible.`,
};

/** What the check of one model says: its time, or why it did not answer (5.3b). */
export function checkMessage(check: AiModelCheck): string {
  return check.problem
    ? PROBLEM_MESSAGES[check.problem]
    : $localize`:@@system.check.ok:Responde en ${check.ms}:ms: ms`;
}
