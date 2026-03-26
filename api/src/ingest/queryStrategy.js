const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

const DIGRAPHS = [
  'aa','ae','ai','au','ch','ee','ei','eu','ie','ij','oe','oi','oo','ou','sch','ui','uu'
];

const COMMON_TERMS = [
  'ik','jij','jou','u','wij','jullie','hij','zij','het',
  'zijn','hebben','help','helpen','doen','gaan','komen',
  'eten','drinken','werken','school','huis','vandaag','morgen','gisteren',
  'dankjewel','bedanken','hallo','sorry','alsjeblieft','goed','slecht','ja','nee',
  'waarom','hoe','wat','wie','waar'
];

function unique(values) {
  return [...new Set(values.map((v) => String(v).trim().toLowerCase()).filter(Boolean))];
}

export function buildQuerySet({ mode = 'expanded', maxQueries = 120, overrideSet = '' } = {}) {
  if (overrideSet) {
    return unique(overrideSet.split(',')).slice(0, maxQueries);
  }

  if (mode === 'letters') {
    return LETTERS.slice(0, maxQueries);
  }

  const merged = unique([...LETTERS, ...DIGRAPHS, ...COMMON_TERMS]);
  return merged.slice(0, maxQueries);
}
