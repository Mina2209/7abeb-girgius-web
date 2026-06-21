export function normalizeArabic(text: string): string {
  if (text === null || text === undefined) return "";

  return String(text)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/\u0640/g, "")
    .trim();
}
