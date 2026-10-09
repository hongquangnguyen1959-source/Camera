import { POPULAR_LANGUAGE_PACKS, OfflineLanguagePack } from '../data/offlineLanguagePacksData';

const PACKS_STORAGE_KEY = 'offline_language_packs_state_v1';

export interface StoredPackState {
  id: string;
  downloaded: boolean;
  downloadedAt?: number;
  sizeMB: number;
}

// Get raw state from localStorage
export function getSavedPacksState(): Record<string, StoredPackState> {
  try {
    const raw = localStorage.getItem(PACKS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse offline packs state:', e);
  }

  // Default initial state: Gói Tiếng Trung (zh) và Tiếng Anh (en) được cấu hình sẵn để người dùng có thể dùng ngay
  const defaultState: Record<string, StoredPackState> = {
    zh: { id: 'zh', downloaded: true, downloadedAt: Date.now() - 3600000, sizeMB: 2.1 },
    en: { id: 'en', downloaded: true, downloadedAt: Date.now() - 7200000, sizeMB: 1.8 },
  };

  try {
    localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(defaultState));
  } catch {}

  return defaultState;
}

// Save pack state
export function savePackState(id: string, downloaded: boolean): void {
  try {
    const current = getSavedPacksState();
    const packDef = POPULAR_LANGUAGE_PACKS.find(p => p.id === id);
    if (downloaded) {
      current[id] = {
        id,
        downloaded: true,
        downloadedAt: Date.now(),
        sizeMB: packDef ? packDef.sizeMB : 2.0,
      };
    } else {
      delete current[id];
    }
    localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Failed to save pack state:', e);
  }
}

// Check if a pack is downloaded
export function isPackDownloaded(packId: string): boolean {
  const state = getSavedPacksState();
  return Boolean(state[packId]?.downloaded);
}

// Get all downloaded packs
export function getDownloadedPacks(): OfflineLanguagePack[] {
  const state = getSavedPacksState();
  return POPULAR_LANGUAGE_PACKS.filter(pack => Boolean(state[pack.id]?.downloaded));
}

// Get total downloaded size in MB
export function getTotalDownloadedSizeMB(): number {
  const state = getSavedPacksState();
  let total = 0;
  for (const key of Object.keys(state)) {
    if (state[key]?.downloaded) {
      total += state[key].sizeMB || 0;
    }
  }
  return Number(total.toFixed(1));
}
