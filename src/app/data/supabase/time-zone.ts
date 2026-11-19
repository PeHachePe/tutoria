/**
 * The time zone of the browser, as an IANA name (`Europe/Madrid`): the server moves the dates of a
 * copy in it, so 23:59 is still 23:59 for whoever set it (5.2c, D-079).
 */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
