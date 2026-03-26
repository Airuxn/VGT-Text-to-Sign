export function normalizeText(input) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text) {
  if (!text) return [];
  return text.split(' ').filter(Boolean);
}
