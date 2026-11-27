import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bullets, escapeHtml, inline, markdown, sections } from './markdown.mjs';

describe('escapeHtml', () => {
  it('escapes the characters that would open markup', () => {
    assert.equal(
      escapeHtml('<script>"a" & b</script>'),
      '&lt;script&gt;&quot;a&quot; &amp; b&lt;/script&gt;',
    );
  });

  it('turns null and undefined into an empty string', () => {
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(null), '');
  });
});

describe('inline', () => {
  it('renders code, bold and italics', () => {
    assert.equal(
      inline('`npm run check` es **obligatorio** y _rápido_'),
      '<code>npm run check</code> es <strong>obligatorio</strong> y <em>rápido</em>',
    );
  });

  it('keeps the text of a link and drops its target', () => {
    assert.equal(inline('ver [la bitácora](bitacora/1.2.md)'), 'ver la bitácora');
  });

  it('links each decision to its card', () => {
    assert.equal(inline('según D-044'), 'según <a class="dref" href="#decisiones/D-044">D-044</a>');
  });

  it('escapes HTML before adding its own', () => {
    assert.equal(inline('<b>no</b>'), '&lt;b&gt;no&lt;/b&gt;');
  });

  it('shows a bare URL without its angle brackets', () => {
    assert.equal(inline('en <https://tutoria.example>'), 'en https://tutoria.example');
  });
});

describe('markdown', () => {
  it('joins the lines of a paragraph and separates paragraphs', () => {
    assert.equal(markdown('uno\ndos\n\ntres'), '<p>uno dos</p><p>tres</p>');
  });

  it('renders dashed, numbered and nested items as one flat list', () => {
    assert.equal(markdown('- a\n  - a1\n1. b'), '<ul><li>a</li><li>a1</li><li>b</li></ul>');
  });

  it('joins an indented continuation line to its item', () => {
    assert.equal(markdown('- a\n  sigue'), '<ul><li>a sigue</li></ul>');
  });

  it('skips tables and comments', () => {
    assert.equal(markdown('texto\n\n| a | b |\n| - | - |\n\n<!-- nota -->'), '<p>texto</p>');
  });

  it('returns an empty string for nothing', () => {
    assert.equal(markdown(undefined), '');
  });
});

describe('bullets', () => {
  it('returns the top-level bullets, with their continuation lines', () => {
    assert.deepEqual(bullets('- uno\n  sigue\n- **dos**\ntexto'), [
      'uno sigue',
      '<strong>dos</strong>',
    ]);
  });
});

describe('sections', () => {
  it('maps each second-level heading to its body', () => {
    assert.deepEqual(sections('# T\n\n## Objetivo\n\nHacer X.\n\n## Tests\n\n- 3'), {
      Objetivo: 'Hacer X.',
      Tests: '- 3',
    });
  });
});
