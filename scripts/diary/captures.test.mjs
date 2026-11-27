import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { changedShare, looksLikeErrorPage } from './captures.mjs';

/** A raw RGB image of `width` × `height` filled with one colour. */
const image = (width, height, [r, g, b]) => ({
  width,
  height,
  data: Buffer.from(Array.from({ length: width * height }, () => [r, g, b]).flat()),
});

describe('changedShare', () => {
  it('is 0 for two identical images', () => {
    assert.equal(changedShare(image(4, 4, [10, 10, 10]), image(4, 4, [10, 10, 10])), 0);
  });

  it('ignores differences within the tolerance', () => {
    assert.equal(changedShare(image(2, 2, [10, 10, 10]), image(2, 2, [20, 20, 15])), 0);
  });

  it('counts the share of pixels that really change', () => {
    const a = image(2, 2, [0, 0, 0]);
    const b = image(2, 2, [0, 0, 0]);
    b.data[0] = 255;
    assert.equal(changedShare(a, b), 0.25);
  });

  it('treats images of different sizes as different', () => {
    assert.equal(changedShare(image(2, 2, [0, 0, 0]), image(2, 3, [0, 0, 0])), 1);
  });
});

describe('looksLikeErrorPage', () => {
  it('spots the pink of the error banner', () => {
    assert.equal(looksLikeErrorPage(image(10, 10, [253, 216, 216])), true);
  });

  it('does not take a grey page for an error', () => {
    assert.equal(looksLikeErrorPage(image(10, 10, [238, 237, 235])), false);
  });
});
