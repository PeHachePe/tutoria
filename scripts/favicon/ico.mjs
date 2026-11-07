// Packs PNG images into an .ico file. Every browser accepts PNG inside an .ico (Windows Vista and
// later), so no bitmap conversion is needed.

const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;
const ICON_TYPE = 1;
const COLOUR_PLANES = 1;
const BITS_PER_PIXEL = 32;
/** The width and height fields are one byte: 0 stands for 256 pixels. */
const MAX_SIZE = 256;

/**
 * @param {{ size: number, png: Uint8Array }[]} images square PNG images, one per size
 * @returns {Buffer} the .ico file
 */
export function encodeIco(images) {
  if (images.length === 0) {
    throw new Error('Un .ico necesita al menos una imagen');
  }
  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(ICON_TYPE, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = HEADER_BYTES + ENTRY_BYTES * images.length;
  const entries = images.map(({ size, png }) => {
    if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE) {
      throw new Error(`Tamaño de icono no válido: ${size}`);
    }
    const entry = Buffer.alloc(ENTRY_BYTES);
    entry.writeUInt8(size % MAX_SIZE, 0);
    entry.writeUInt8(size % MAX_SIZE, 1);
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(COLOUR_PLANES, 4);
    entry.writeUInt16LE(BITS_PER_PIXEL, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => Buffer.from(png))]);
}
