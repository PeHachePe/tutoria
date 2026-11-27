// The captures of each screen's evolution: drop those that add nothing and write the rest as WebP.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Width the captures are compared at: enough to see a change, cheap to read. */
const COMPARE_WIDTH = 400;
/** A pixel counts as changed when its R+G+B differ by more than this. */
const PIXEL_TOLERANCE = 30;
/** A version that changes less than this share of pixels, on desktop and on phone, repeats the previous one. */
const SAME_SHARE = 0.005;
/** The pink of the app's error banner, and the share of it that means the capture shows an error page. */
const ERROR_SHARE = 0.02;
const isErrorPink = (r, g, b) => r > 235 && g > 195 && g < 225 && b > 195 && b < 228;

export const IMAGE_SIZES = {
  desktop: { width: 1100, quality: 66 },
  phone: { width: 300, quality: 66 },
};

/** Share of pixels that differ between two raw images of the same size (1 when sizes differ). */
export function changedShare(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let changed = 0;
  for (let p = 0; p < a.data.length; p += 3) {
    if (
      Math.abs(a.data[p] - b.data[p]) +
        Math.abs(a.data[p + 1] - b.data[p + 1]) +
        Math.abs(a.data[p + 2] - b.data[p + 2]) >
      PIXEL_TOLERANCE
    )
      changed++;
  }
  return changed / (a.width * a.height);
}

/** Whether a raw RGB image shows the app's error banner over enough of it to be an error page. */
export function looksLikeErrorPage({ data }) {
  let pink = 0;
  for (let p = 0; p < data.length; p += 3)
    if (isErrorPink(data[p], data[p + 1], data[p + 2])) pink++;
  return pink / (data.length / 3) > ERROR_SHARE;
}

const raw = async (sharp, file) => {
  const { data, info } = await sharp(file)
    .resize({ width: COMPARE_WIDTH })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

/** Keeps, per screen, the versions that show the screen and change something; says which it dropped. */
export async function selectCaptures(screens, sharp) {
  const skipped = [];
  const kept = [];
  for (const screen of screens) {
    const versions = [];
    let previous = null;
    for (const version of screen.versions) {
      const current = {
        desktop: await raw(sharp, version.desktop),
        phone: await raw(sharp, version.phone),
      };
      if (looksLikeErrorPage(current.desktop)) {
        skipped.push(`${screen.key}/${version.step} (página de error)`);
        continue;
      }
      if (
        previous &&
        changedShare(previous.desktop, current.desktop) < SAME_SHARE &&
        changedShare(previous.phone, current.phone) < SAME_SHARE
      ) {
        skipped.push(`${screen.key}/${version.step} (igual que la anterior)`);
        continue;
      }
      versions.push(version);
      previous = current;
    }
    if (versions.length) kept.push({ ...screen, versions });
  }
  return { screens: kept, skipped };
}

/** Writes each kept capture as WebP under `img/` and returns their paths, by «screen/step/d|m». */
export async function writeImages(screens, sharp, folder) {
  const images = {};
  for (const screen of screens) {
    mkdirSync(join(folder, 'img', screen.key), { recursive: true });
    for (const version of screen.versions) {
      for (const [device, source, size] of [
        ['d', version.desktop, IMAGE_SIZES.desktop],
        ['m', version.phone, IMAGE_SIZES.phone],
      ]) {
        const path = `img/${screen.key}/${version.step}-${device}.webp`;
        await sharp(source)
          .resize({ width: size.width, withoutEnlargement: true })
          .webp({ quality: size.quality })
          .toFile(join(folder, path));
        images[`${screen.key}/${version.step}/${device}`] = path;
      }
      delete version.desktop;
      delete version.phone;
    }
  }
  return images;
}
