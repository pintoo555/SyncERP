const KEY = 'chat_settings';

export interface ChatSettings {
  soundEnabled: boolean;
  notifyEnabled: boolean;
  /** Service code of the AI model to use for chat improvement (e.g. OPENAI, CLAUDE). Empty = use default. */
  aiServiceCode: string;
}

const defaults: ChatSettings = {
  soundEnabled: true,
  notifyEnabled: false,
  aiServiceCode: '',
};

export function getChatSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<ChatSettings>;
    return {
      soundEnabled: parsed.soundEnabled ?? defaults.soundEnabled,
      notifyEnabled: parsed.notifyEnabled ?? defaults.notifyEnabled,
      aiServiceCode: typeof parsed.aiServiceCode === 'string' ? parsed.aiServiceCode : defaults.aiServiceCode,
    };
  } catch {
    return { ...defaults };
  }
}

export function setChatSettings(settings: Partial<ChatSettings>): void {
  const current = getChatSettings();
  const next = { ...current, ...settings };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

const FAVOURITES_KEY_PREFIX = 'chat_favourites_';

export function getChatFavourites(myUserId: number): number[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY_PREFIX + myUserId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id: unknown) => typeof id === 'number' && Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

export function setChatFavourites(myUserId: number, partnerIds: number[]): void {
  try {
    localStorage.setItem(FAVOURITES_KEY_PREFIX + myUserId, JSON.stringify(partnerIds));
  } catch {
    // ignore
  }
}

export function toggleChatFavourite(myUserId: number, partnerId: number): boolean {
  const current = getChatFavourites(myUserId);
  const set = new Set(current);
  if (set.has(partnerId)) {
    set.delete(partnerId);
  } else {
    set.add(partnerId);
  }
  setChatFavourites(myUserId, Array.from(set));
  return set.has(partnerId);
}

/** Play a short notification beep (no audio file required). */
export function playChatSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore
  }
}
