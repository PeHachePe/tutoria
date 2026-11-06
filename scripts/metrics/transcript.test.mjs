import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { summarizeTranscript } from './transcript.mjs';

function assistant({ id, requestId, timestamp, model = 'claude-opus-5-5', usage }) {
  return JSON.stringify({
    type: 'assistant',
    timestamp,
    requestId,
    message: { id, model, usage },
  });
}

const usage = {
  input_tokens: 2,
  output_tokens: 100,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 300,
  cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 },
};

describe('summarizeTranscript', () => {
  it('counts each model response once even if it is logged in several lines', () => {
    const line = assistant({
      id: 'msg_1',
      requestId: 'req_1',
      timestamp: '2026-11-06T18:00:00Z',
      usage,
    });
    const summary = summarizeTranscript([line, line, line]);

    assert.equal(summary.requests, 1);
    assert.deepEqual(summary.byModel['claude-opus-5-5'], {
      input: 2,
      output: 100,
      cacheRead: 1000,
      cacheWrite5m: 100,
      cacheWrite1h: 200,
    });
  });

  it('adds up the responses of each model', () => {
    const summary = summarizeTranscript([
      assistant({ id: 'msg_1', requestId: 'req_1', timestamp: '2026-11-06T18:00:00Z', usage }),
      assistant({ id: 'msg_2', requestId: 'req_2', timestamp: '2026-11-06T18:01:00Z', usage }),
      assistant({
        id: 'msg_3',
        requestId: 'req_3',
        timestamp: '2026-11-06T18:02:00Z',
        model: 'claude-haiku-5-5',
        usage,
      }),
    ]);

    assert.equal(summary.requests, 3);
    assert.equal(summary.byModel['claude-opus-5-5'].output, 200);
    assert.equal(summary.byModel['claude-haiku-5-5'].output, 100);
  });

  it('treats cache writes without a breakdown as five-minute writes', () => {
    const summary = summarizeTranscript([
      assistant({
        id: 'msg_1',
        requestId: 'req_1',
        timestamp: '2026-11-06T18:00:00Z',
        usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 50 },
      }),
    ]);

    assert.equal(summary.byModel['claude-opus-5-5'].cacheWrite5m, 50);
    assert.equal(summary.byModel['claude-opus-5-5'].cacheWrite1h, 0);
  });

  it('takes the start and end from the first and last timestamps of any line', () => {
    const summary = summarizeTranscript([
      JSON.stringify({ type: 'user', timestamp: '2026-11-06T17:59:00Z' }),
      assistant({ id: 'msg_1', requestId: 'req_1', timestamp: '2026-11-06T18:00:00Z', usage }),
      JSON.stringify({ type: 'system', timestamp: '2026-11-06T19:30:00Z' }),
    ]);

    assert.equal(summary.start, '2026-11-06T17:59:00.000Z');
    assert.equal(summary.end, '2026-11-06T19:30:00.000Z');
    assert.equal(summary.durationMinutes, 91);
  });

  it('skips synthetic messages, blank lines and invalid JSON', () => {
    const summary = summarizeTranscript([
      '',
      '{not json',
      assistant({
        id: 'msg_1',
        requestId: 'req_1',
        timestamp: '2026-11-06T18:00:00Z',
        model: '<synthetic>',
        usage,
      }),
    ]);

    assert.equal(summary.requests, 0);
    assert.deepEqual(summary.byModel, {});
  });

  it('returns an empty summary for an empty transcript', () => {
    const summary = summarizeTranscript([]);
    assert.equal(summary.start, null);
    assert.equal(summary.durationMinutes, 0);
  });
});
