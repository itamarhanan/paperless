const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "just now" — how long since a stored timestamp. */
export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size)
      return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor",
  "of", "on", "or", "over", "per", "the", "to", "via", "vs", "with",
]);
const ROMAN = /^(?=[MDCLXVI]+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/**
 * Titles set in capitals ("RECOGNIZE YOUR POWER") read as shouting outside
 * the page they were designed for. Shown in title case instead; the words are
 * the book's, only the capitalization changes. Mixed-case titles are left alone.
 */
export function displayTitle(title: string): string {
  const letters = title.match(/\p{L}/gu) ?? [];
  if (letters.length < 3 || title !== title.toUpperCase() || title === title.toLowerCase()) return title;

  const words = title.split(/(\s+)/);
  let first = true;
  return words
    .map((word, i) => {
      if (/^\s+$/.test(word)) return word;
      const bare = word.replace(/[^\p{L}]/gu, "");
      if (ROMAN.test(bare)) {
        first = false;
        return word; // PART I, BOOK IV
      }
      const lower = word.toLowerCase();
      const isLast = i === words.length - 1;
      const afterColon = i >= 2 && /[:—–]$/.test(words[i - 2]);
      const keepSmall = !first && !isLast && !afterColon && SMALL_WORDS.has(bare.toLowerCase());
      first = false;
      if (keepSmall) return lower;
      // Capitalize each part of hyphenated words ("Self-Made"), after any opening quote
      return lower.replace(/(^|[-‐/(“"‘'])(\p{Ll})/gu, (_, before, letter) => before + letter.toUpperCase());
    })
    .join("");
}
