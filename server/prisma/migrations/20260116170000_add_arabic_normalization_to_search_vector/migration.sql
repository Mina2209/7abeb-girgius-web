-- Create Arabic normalization function
CREATE OR REPLACE FUNCTION normalize_arabic(input TEXT) RETURNS TEXT AS $$
BEGIN
  IF input IS NULL THEN RETURN ''; END IF;
  
  RETURN LOWER(TRIM(
    -- Remove Arabic diacritics (tashkeel)
    REGEXP_REPLACE(
      -- Remove tatweel
      REGEXP_REPLACE(
        -- Alif variants (أ إ آ ٱ) -> ا
        REGEXP_REPLACE(
          -- Waw with hamza -> Waw
          REGEXP_REPLACE(
            -- Yeh with hamza -> Yeh
            REGEXP_REPLACE(
              -- Alif maqsurah -> Yeh
              REGEXP_REPLACE(
                -- Taa marbuta -> Heh
                REGEXP_REPLACE(input, 'ة', 'ه', 'g'),
              'ى', 'ي', 'g'),
            'ئ', 'ي', 'g'),
          'ؤ', 'و', 'g'),
        '[أإآٱ]', 'ا', 'g'),
      'ـ', '', 'g'),
    '[\u064B-\u065F\u0670\u06D6-\u06ED]', '', 'g')
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop existing search_vector column and index
DROP INDEX IF EXISTS "public"."Lyric_search_vector_idx";
ALTER TABLE "public"."Lyric" DROP COLUMN IF EXISTS "search_vector";

-- Add search_vector with Arabic normalization
ALTER TABLE "public"."Lyric" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', normalize_arabic(coalesce(content, '')))) STORED;

-- Recreate GIN index
CREATE INDEX "Lyric_search_vector_idx" ON "public"."Lyric" USING GIN (search_vector);
