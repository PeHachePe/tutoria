import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { encodeIco } from './ico.mjs';

describe('encodeIco', () => {
  const small = { size: 16, png: Uint8Array.from([1, 2, 3]) };
  const large = { size: 48, png: Uint8Array.from([4, 5, 6, 7, 8]) };

  it('writes the header, one directory entry per image and the images after them', () => {
    const ico = encodeIco([small, large]);

    assert.equal(ico.readUInt16LE(0), 0);
    assert.equal(ico.readUInt16LE(2), 1);
    assert.equal(ico.readUInt16LE(4), 2);

    const firstOffset = 6 + 16 * 2;
    assert.equal(ico.readUInt8(6), 16);
    assert.equal(ico.readUInt8(7), 16);
    assert.equal(ico.readUInt16LE(6 + 4), 1);
    assert.equal(ico.readUInt16LE(6 + 6), 32);
    assert.equal(ico.readUInt32LE(6 + 8), 3);
    assert.equal(ico.readUInt32LE(6 + 12), firstOffset);

    assert.equal(ico.readUInt8(22), 48);
    assert.equal(ico.readUInt32LE(22 + 8), 5);
    assert.equal(ico.readUInt32LE(22 + 12), firstOffset + 3);

    assert.deepEqual([...ico.subarray(firstOffset)], [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('writes 256 pixels as 0, as the format requires', () => {
    const ico = encodeIco([{ size: 256, png: Uint8Array.from([9]) }]);

    assert.equal(ico.readUInt8(6), 0);
    assert.equal(ico.readUInt8(7), 0);
  });

  it('rejects an empty list and sizes the format cannot hold', () => {
    assert.throws(() => encodeIco([]), /al menos una imagen/);
    assert.throws(() => encodeIco([{ size: 300, png: small.png }]), /no válido: 300/);
    assert.throws(() => encodeIco([{ size: 0, png: small.png }]), /no válido: 0/);
  });
});
