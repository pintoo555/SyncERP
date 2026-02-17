const KEY = 'chat_settings';
const FLOATING_POSITION_KEY = 'chat_floating_position';

export interface ChatSettings {
  soundEnabled: boolean;
  notifyEnabled: boolean;
  /** Service code of the AI model to use for chat improvement (e.g. OPENAI, CLAUDE). Empty = use default. */
  aiServiceCode: string;
  /** Show floating chat widget on all pages (user preference). */
  floatingWidgetEnabled: boolean;
}

export interface FloatingChatPosition {
  x: number;
  y: number;
}

const defaults: ChatSettings = {
  soundEnabled: true,
  notifyEnabled: false,
  aiServiceCode: '',
  floatingWidgetEnabled: true,
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
      floatingWidgetEnabled: parsed.floatingWidgetEnabled ?? defaults.floatingWidgetEnabled,
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
    if ('floatingWidgetEnabled' in settings) {
      window.dispatchEvent(new CustomEvent('chat-settings-changed'));
    }
  } catch {
    // ignore
  }
}

export function getFloatingChatPosition(): FloatingChatPosition | null {
  try {
    const raw = localStorage.getItem(FLOATING_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

export function setFloatingChatPosition(pos: FloatingChatPosition): void {
  try {
    localStorage.setItem(FLOATING_POSITION_KEY, JSON.stringify(pos));
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
