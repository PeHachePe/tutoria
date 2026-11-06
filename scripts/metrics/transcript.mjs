/**
 * Summarizes the lines of a Claude Code session log (`~/.claude/projects/<project>/<session>.jsonl`).
 * Each model response can appear in several lines with the same usage, so responses are
 * counted once per `message.id` and `requestId`.
 *
 * @param {string[]} lines
 */
export function summarizeTranscript(lines) {
  const byModel = {};
  const seen = new Set();
  let first = Infinity;
  let last = -Infinity;

  for (const line of lines) {
    const record = parse(line);
    if (!record) {
      continue;
    }

    const time = Date.parse(record.timestamp);
    if (!Number.isNaN(time)) {
      first = Math.min(first, time);
      last = Math.max(last, time);
    }

    const message = record.message;
    if (record.type !== 'assistant' || !message?.usage || message.model === '<synthetic>') {
      continue;
    }
    const key = `${message.id}:${record.requestId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    addUsage((byModel[message.model] ??= emptyUsage()), message.usage);
  }

  const hasTime = Number.isFinite(first);
  return {
    start: hasTime ? new Date(first).toISOString() : null,
    end: hasTime ? new Date(last).toISOString() : null,
    durationMinutes: hasTime ? Math.round((last - first) / 60_000) : 0,
    requests: seen.size,
    byModel,
  };
}

export function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
}

function addUsage(total, usage) {
  const written = usage.cache_creation_input_tokens ?? 0;
  const write1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  total.input += usage.input_tokens ?? 0;
  total.output += usage.output_tokens ?? 0;
  total.cacheRead += usage.cache_read_input_tokens ?? 0;
  total.cacheWrite1h += write1h;
  total.cacheWrite5m += written - write1h;
}

function parse(line) {
  if (!line.trim()) {
    return null;
  }
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
