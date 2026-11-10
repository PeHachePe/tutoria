/** Segments and paths of the development pages (dev.routes.ts), linked from the dev toolbar. */
export const DEV_SEGMENTS = { area: 'dev', showcase: 'ui' } as const;

export const DEV_PATHS = {
  showcase: `/${DEV_SEGMENTS.area}/${DEV_SEGMENTS.showcase}`,
} as const;
