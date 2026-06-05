const BULLET_GLYPH_RE = /^[◆●•▪▫–—\-\*►▶•◆■▶→\s]+/;

export function cleanBullet(text) {
  return typeof text === "string" ? text.replace(BULLET_GLYPH_RE, "").trim() : text;
}
