import type { ContentId } from "../types/content";

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

// توليد كود قصير (8 خانات) من الـ ID لاستخدامه في روابط المشاركة
// بدلاً من إظهار الـ UUID الكامل القبيح في اللينك.
export function shortContentId(id: ContentId): string {
  const s = String(id);
  const hexOnly = s.replace(/[^a-f0-9]/gi, "");
  const isUuidLike =
    hexOnly.length >= 24 && /^[a-f0-9]{24,}$/i.test(hexOnly);

  if (isUuidLike) return hexOnly.slice(-8);

  const cleaned = s.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.length > 8 ? cleaned.slice(-8) : cleaned;
}
