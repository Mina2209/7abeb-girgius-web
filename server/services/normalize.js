// Arabic normalization utility for search
// - Unify different alif and hamza forms to ا
// - Convert alif maqsurah ى to ي
// - Normalize taa marbuta ة to ه (wider match)
// - Remove tatweel and diacritics

export function normalizeArabic(input) {
  if (!input || typeof input !== 'string') return '';
  let s = input;
  // Remove diacritics
  s = s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  // Tatweel
  s = s.replace(/\u0640/g, '');
  // Unify Alif variants: أ إ آ ٱ -> ا
  s = s.replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627');
  // Unify Waw with hamza to Waw, Yeh with hamza to Yeh (optional)
  s = s.replace(/[\u0624]/g, '\u0648');
  s = s.replace(/[\u0626]/g, '\u064A');
  // Alif maqsurah to Yeh
  s = s.replace(/[\u0649]/g, '\u064A');
  // Taa marbuta to Heh for broader matching
  s = s.replace(/[\u0629]/g, '\u0647');
  // Standardize digits (Arabic-Indic to ASCII)
  s = s.replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48));
  // Trim and lowercase for safe comparisons
  return s.trim().toLowerCase();
}


