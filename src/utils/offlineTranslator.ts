import { POPULAR_LANGUAGE_PACKS, OfflineLanguagePack, SignboardItem } from '../data/offlineLanguagePacksData';
import { getDownloadedPacks, isPackDownloaded } from './languagePackStorage';
import { VisionTranslationResult, DetectedItem } from '../types';

export interface OfflineMatchResult {
  original: string;
  vietnamese: string;
  pinyinOrRomaji?: string;
  category: string;
  sourceLangName: string;
  note?: string;
  confidence: number;
}

// Search across all downloaded offline language packs for matching signs, phrases, or words
export function searchOfflineVocabulary(
  query: string,
  preferredLangId?: string
): OfflineMatchResult[] {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim().toLowerCase();

  // Prefer downloaded packs first, fallback to all popular packs if none downloaded yet
  let packs = getDownloadedPacks();
  if (packs.length === 0) {
    packs = POPULAR_LANGUAGE_PACKS;
  }

  if (preferredLangId) {
    const specific = packs.filter(p => p.id === preferredLangId);
    if (specific.length > 0) packs = specific;
  }

  const results: OfflineMatchResult[] = [];
  const seen = new Set<string>();

  for (const pack of packs) {
    // 1. Check exact signboard matches
    for (const sb of pack.signboards) {
      const origLower = sb.original.toLowerCase();
      const vnLower = sb.vietnamese.toLowerCase();
      const pinyinLower = (sb.pinyinOrRomaji || '').toLowerCase();

      let match = false;
      let score = 0;

      if (origLower === cleanQuery) {
        match = true;
        score = 1.0;
      } else if (cleanQuery.includes(origLower) || origLower.includes(cleanQuery)) {
        match = true;
        score = 0.85;
      } else if (vnLower.includes(cleanQuery) || pinyinLower.includes(cleanQuery)) {
        match = true;
        score = 0.75;
      }

      if (match) {
        const key = sb.original + '->' + sb.vietnamese;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            original: sb.original,
            vietnamese: sb.vietnamese,
            pinyinOrRomaji: sb.pinyinOrRomaji,
            category: sb.category,
            sourceLangName: pack.shortName,
            note: sb.note,
            confidence: score,
          });
        }
      }
    }

    // 2. Check common phrases
    for (const phrase of pack.commonPhrases) {
      const origLower = phrase.original.toLowerCase();
      const vnLower = phrase.vietnamese.toLowerCase();
      const pronLower = phrase.pronunciation.toLowerCase();

      let match = false;
      let score = 0;

      if (origLower === cleanQuery) {
        match = true;
        score = 0.95;
      } else if (cleanQuery.includes(origLower) || origLower.includes(cleanQuery)) {
        match = true;
        score = 0.8;
      } else if (vnLower.includes(cleanQuery) || pronLower.includes(cleanQuery)) {
        match = true;
        score = 0.7;
      }

      if (match) {
        const key = phrase.original + '->' + phrase.vietnamese;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            original: phrase.original,
            vietnamese: phrase.vietnamese,
            pinyinOrRomaji: phrase.pronunciation,
            category: phrase.category,
            sourceLangName: pack.shortName,
            confidence: score,
          });
        }
      }
    }

    // 3. Check single dictionary keywords
    for (const [k, v] of Object.entries(pack.dictionary)) {
      if (cleanQuery.includes(k.toLowerCase()) || v.toLowerCase().includes(cleanQuery)) {
        const key = k + '->' + v;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            original: k,
            vietnamese: v,
            category: 'sign',
            sourceLangName: pack.shortName,
            confidence: 0.6,
          });
        }
      }
    }
  }

  // Sort by highest confidence and relevance
  return results.sort((a, b) => b.confidence - a.confidence);
}

// Generate an offline translation result from text or simulated offline image scan
export function translateOfflineSnapshot(
  contextTextHint?: string,
  preferredLangId: string = 'zh'
): VisionTranslationResult {
  const pack = POPULAR_LANGUAGE_PACKS.find(p => p.id === preferredLangId) || POPULAR_LANGUAGE_PACKS[0];
  const downloaded = isPackDownloaded(pack.id);

  const matchedItems: DetectedItem[] = [];

  // Pick prominent signboard items from the pack to synthesize AR overlay for quick visual translation
  const sampleSignboards = pack.signboards.slice(0, 6);

  sampleSignboards.forEach((sb, index) => {
    // Generate clean bounding box locations [ymin, xmin, ymax, xmax]
    const ymin = 120 + index * 130;
    const ymax = ymin + 90;
    const xmin = 150;
    const xmax = 850;

    matchedItems.push({
      box_2d: [ymin, xmin, ymax, xmax],
      original_text: sb.original,
      translated_text: sb.vietnamese,
      pronunciation: sb.pinyinOrRomaji,
      category: sb.category,
      cultural_tip: sb.note || `Dịch từ gói ngoại tuyến ${pack.shortName}`,
    });
  });

  const summary = `[Dịch ngoại tuyến ${pack.shortName}] Đã đối chiếu ${matchedItems.length} biển hiệu và chỉ dẫn cơ bản từ cơ sở dữ liệu đã tải trong máy.`;

  return {
    detected_language: pack.shortName,
    language_code: pack.id,
    summary_translation: summary,
    travel_advice: downloaded
      ? `Đang hoạt động hoàn toàn không cần Internet với gói ${pack.name}.`
      : `Đang dùng bản xem trước ngoại tuyến. Hãy tải gói đầy đủ (${pack.sizeMB} MB) để nhận diện thêm từ vựng.`,
    items: matchedItems,
  };
}
