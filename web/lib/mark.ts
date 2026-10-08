// The mark: a key whose bow is a house, with a door-shaped hole for the ring. One SVG source for the
// header, the browser-tab icon, the app icon and the shared-link image.

export const MARK_PATHS = {
  /** the bow: a house with a chimney, the door cut out */
  bow: "M6 30 L19 16.5 L25 22.7 V18 H29 V26.8 L32 30 V48 H6 Z M15 48 V40 A4 4 0 0 1 23 40 V48 Z",
  /** the collar, the shaft and the two teeth of the bit */
  blade: "M32 31.5 H35.5 V33.5 H58 A1.5 1.5 0 0 1 59.5 35 V38.5 A1.5 1.5 0 0 1 58 40 H57 V50 H52 V40 H50.5 V46 H46 V40 H35.5 V42.5 H32 Z",
};

/** The mark as an SVG document string, on a transparent ground or on a paper tile. */
export function markSvg(opts: { tile?: boolean; size?: number } = {}): string {
  const size = opts.size ?? 64;
  const tile = opts.tile ? '<rect x="1" y="1" width="62" height="62" rx="14" fill="#F6F1E7" stroke="#22303A" stroke-width="2"/>' : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    tile +
    `<g transform="translate(0 -1)"><path d="${MARK_PATHS.bow}" fill="#B85C38" fill-rule="evenodd"/>` +
    `<path d="${MARK_PATHS.blade}" fill="#22303A"/></g></svg>`
  );
}

/** The mark as a data URI, for the generated images (server side). */
export const markDataUri = (opts: { tile?: boolean; size?: number } = {}): string => {
  const svg = markSvg(opts);
  const b64 = typeof Buffer !== "undefined" ? Buffer.from(svg).toString("base64") : btoa(svg);
  return "data:image/svg+xml;base64," + b64;
};
