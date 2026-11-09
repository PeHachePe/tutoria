// npm run emojis
// Brings the emoji of the tutor's reactions (step 1.8, D-036) from Microsoft's official Fluent
// Emoji repositories (MIT) and leaves them in public/reactions/ as light WebP files, one per emoji:
// animated ones from Fluent Emoji Animated (animated PNGs of about 2 MB, turned into animated WebP)
// and, for those with no animation, the still 3D ones from Fluent Emoji. Only the emoji the
// reactions use are downloaded, into a temporary folder, and the licenses go with them.
// It needs the network; the output is committed, so the app never fetches anything from outside.
// It only makes the emoji that are missing and removes those no longer used; `-- --force` makes
// them all again.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import UPNG from 'upng-js';

const ANIMATED = 'microsoft/fluentui-emoji-animated';
const STILL = 'microsoft/fluentui-emoji';
const BRANCH = 'main';
/** Animated PNGs are stored with Git LFS: this host serves the real files. */
const MEDIA = `https://media.githubusercontent.com/media/${ANIMATED}/refs/heads/${BRANCH}`;
const raw = (repository) => `https://raw.githubusercontent.com/${repository}/${BRANCH}`;

/** Side and quality of the WebP: enough for the big icon, a few hundred KB each when animated. */
const SIZE = 192;
const QUALITY = 72;
/** Browsers play frames shorter than this one more slowly, so none is shorter. */
const MIN_FRAME_MS = 20;
/**
 * Share of the side, at each edge, that fades to transparent: some animations go off their canvas
 * (the monkeys' hands) and would end in a straight cut, which looks like a frame.
 */
const FEATHER = 0.06;

/**
 * The emoji the reactions use, by their name in the repositories; the file each one leaves is its
 * name in kebab case (reaction-particles.ts refers to them). Those with skin tones keep the default
 * one; `still` ones have no animation and come in 3D.
 */
const EMOJIS = [
  // Hearts
  'Smiling face with hearts',
  'Smiling face with heart-eyes',
  'Sparkling heart',
  'Revolving hearts',
  'Growing heart',
  'Two hearts',
  'Beating heart',
  'Heart on fire',
  // Cheer, celebration and progress
  { name: 'Thumbs up', skinTone: true },
  'Party popper',
  'Partying face',
  'Rocket',
  'Fire',
  { name: 'Clapping hands', skinTone: true },
  // Surprise and laughter
  'Exploding head',
  'Knocked-out face',
  'Face with tears of joy',
  'Rolling on the floor laughing',
  // Thinking and ideas (hints)
  'Thinking face',
  'Face with monocle',
  'Nerd face',
  { name: 'Light bulb', still: true },
  // Jokes when the student asks for the solution: always jokes, never for mistakes (D-037)
  'Winking face',
  'Smirking face',
  'Unamused face',
  'Face with rolling eyes',
  'Face with raised eyebrow',
  'Melting face',
  'See-no-evil monkey',
  'Hear-no-evil monkey',
  'Speak-no-evil monkey',
  'Face with steam from nose',
  'Pouting face',
  'Face with symbols on mouth',
  'Bomb',
  'Pile of poo',
  { name: 'Baseball', still: true },
  { name: 'Egg', still: true },
  { name: 'Pie', still: true },
  { name: 'Tomato', still: true },
  // The proactive tutor (6.2): looking in, empathy and a long wait
  'Eyes',
  'Relieved face',
  'Hugging face',
  'Pleading face',
  'Yawning face',
].map((emoji) => (typeof emoji === 'string' ? { name: emoji } : emoji));

/**
 * Small still 3D emoji for the pieces around the big one (rain, sparks, flames, steam), in
 * public/reactions/mini/: reaction-blocks.ts knows which icon each one replaces.
 */
const MINIS = [
  'Red heart',
  'Smiling face with smiling eyes',
  { name: 'Heart hands', skinTone: true },
  'Cherry blossom',
  'Sun',
  'Star',
  'Sparkles',
  'High voltage',
  { name: 'Flexed biceps', skinTone: true },
  '1st place medal',
  'Trophy',
  'Sports medal',
  'Birthday cake',
  'Gem stone',
  'Glowing star',
  'Collision',
  'Red question mark',
  'Slightly smiling face',
  'Grinning squinting face',
  'Locked',
  'Crescent moon',
  'Zzz',
  'Cloud',
  { name: 'Thumbs up', skinTone: true },
  { name: 'Clapping hands', skinTone: true },
  'Fire',
  'Party popper',
  'See-no-evil monkey',
].map((emoji) => ({ ...(typeof emoji === 'string' ? { name: emoji } : emoji), still: true }));
/** Side of the small ones: enough for the pieces around, a few KB each. */
const MINI_SIZE = 64;

const force = process.argv.includes('--force');
const output = join(process.cwd(), 'public', 'reactions');
const miniOutput = join(output, 'mini');
/** The flat 2D versions, SVG, for students who turn the 3D emoji off. */
const flatOutput = join(output, 'flat');
const downloads = mkdtempSync(join(tmpdir(), 'tutoria-emojis-'));
mkdirSync(miniOutput, { recursive: true });
mkdirSync(flatOutput, { recursive: true });

/** Its file name in the repositories: lower case, underscores for spaces, hyphens kept. */
const snake = (name) => name.toLowerCase().replaceAll(' ', '_');
const kebab = (name) => name.toLowerCase().replaceAll(' ', '-');
const encode = (path) => path.split('/').map(encodeURIComponent).join('/');

/** The flat 2D version of an emoji: every emoji in the still repository has one. */
function flatSource({ name, skinTone }) {
  const folder = skinTone ? `${name}/Default` : name;
  const tone = skinTone ? '_default' : '';
  return `${raw(STILL)}/assets/${encode(`${folder}/Flat/${snake(name)}_flat${tone}.svg`)}`;
}

function source({ name, skinTone, still }) {
  const folder = skinTone ? `${name}/Default` : name;
  const tone = skinTone ? '_default' : '';
  if (still) return `${raw(STILL)}/assets/${encode(`${folder}/3D/${snake(name)}_3d${tone}.png`)}`;
  return `${MEDIA}/assets/${encode(`${folder}/animated/${snake(name)}_animated${tone}.png`)}`;
}

async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

/** Every frame of the PNG (one, if it is still), composed and resized, into one WebP. */
/** Fades the alpha of the pixels near the edges, so nothing ends in a straight cut. */
function feather(frame, width, height) {
  const pixels = new Uint8Array(frame);
  const band = Math.max(1, Math.round(Math.min(width, height) * FEATHER));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (distance >= band) continue;
      const alpha = (y * width + x) * 4 + 3;
      pixels[alpha] = Math.round(pixels[alpha] * (distance / band));
    }
  }
  return Buffer.from(pixels);
}

async function toWebp(input, file, side) {
  // Exactly the bytes of the file: the memory behind a Buffer can be larger and shared with other
  // reads, and the decoder read leftovers of the previous emoji (the egg came out a bulb)
  const bytes = readFileSync(input);
  const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  const frames = await Promise.all(
    UPNG.toRGBA8(png).map((frame) =>
      sharp(feather(frame, png.width, png.height), {
        raw: { width: png.width, height: png.height, channels: 4 },
      })
        .resize(side, side)
        .png()
        .toBuffer(),
    ),
  );
  if (frames.length === 1) return sharp(frames[0]).webp({ quality: QUALITY }).toFile(file);
  const delay = png.frames.map((frame) => Math.max(Math.round(frame.delay), MIN_FRAME_MS));
  return sharp(frames, { join: { animated: true } })
    .webp({ quality: QUALITY, effort: 6, delay, loop: 0 })
    .toFile(file);
}

try {
  let made = 0;
  for (const [emojis, folder, side] of [
    [EMOJIS, output, SIZE],
    [MINIS, miniOutput, MINI_SIZE],
  ]) {
    // Emoji the reactions no longer use go away
    const used = new Set(emojis.map(({ name }) => `${kebab(name)}.webp`));
    for (const file of readdirSync(folder)) {
      if (file.endsWith('.webp') && !used.has(file)) {
        rmSync(join(folder, file));
        console.log(`${file}  borrado`);
      }
    }
    for (const emoji of emojis) {
      const file = join(folder, `${kebab(emoji.name)}.webp`);
      if (!force && existsSync(file)) continue;
      const input = join(downloads, `${kebab(emoji.name)}.png`);
      const url = source(emoji);
      await download(url, input);
      const { size } = await toWebp(input, file, side).catch((error) => {
        throw new Error(`${emoji.name} (${url}): ${error?.message ?? error}`);
      });
      made++;
      console.log(`${kebab(emoji.name)}.webp  ${Math.round(size / 1024)} KB`);
    }
  }
  // The flat 2D ones: SVG, taken as they are, one per emoji of both lists
  const flats = [
    ...new Map([...EMOJIS, ...MINIS].map((emoji) => [kebab(emoji.name), emoji])).values(),
  ];
  const usedFlats = new Set(flats.map(({ name }) => `${kebab(name)}.svg`));
  for (const file of readdirSync(flatOutput)) {
    if (file.endsWith('.svg') && !usedFlats.has(file)) {
      rmSync(join(flatOutput, file));
      console.log(`flat/${file}  borrado`);
    }
  }
  for (const emoji of flats) {
    const file = join(flatOutput, `${kebab(emoji.name)}.svg`);
    if (!force && existsSync(file)) continue;
    const url = flatSource(emoji);
    const response = await fetch(url);
    const svg = await response.text();
    if (!response.ok || !svg.trimStart().startsWith('<svg')) {
      throw new Error(`${emoji.name} (${url}): no es un SVG (${response.status})`);
    }
    writeFileSync(file, svg);
    made++;
    console.log(`flat/${kebab(emoji.name)}.svg  ${Math.round(svg.length / 1024)} KB`);
  }
  await download(`${raw(ANIMATED)}/LICENSE`, join(output, 'LICENSE-fluentui-emoji-animated.txt'));
  await download(`${raw(STILL)}/LICENSE`, join(output, 'LICENSE-fluentui-emoji.txt'));
  console.log(`${made} ficheros generados, con las licencias`);
} finally {
  rmSync(downloads, { recursive: true, force: true });
}
