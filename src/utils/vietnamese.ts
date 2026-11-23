export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Standard, short, embed, live, and shorts YouTube URLs
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function slugifyTitle(title: string): string {
  const clean = removeVietnameseTones(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return clean || 'bai-hat';
}

export function buildSongUrlPath(title: string, youtubeId: string, kind: 'karaoke' | 'mp3'): string {
  let slug = slugifyTitle(title);
  if (kind === 'karaoke' && !slug.includes('karaoke')) {
    slug = `${slug}-karaoke`;
  } else if (kind === 'mp3' && !slug.includes('mp3')) {
    slug = `${slug}-mp3`;
  }
  return `/${slug}-${youtubeId}`;
}

export function parseMediaUrlPath(
  pathname: string
): { youtubeId: string; kind: 'karaoke' | 'mp3'; rawSlug: string } | null {
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
  if (!cleanPath || cleanPath.startsWith('api/')) return null;
  const match = cleanPath.match(/^(.*)-([a-zA-Z0-9_-]{11})$/);
  if (!match) return null;
  const rawSlug = match[1];
  const youtubeId = match[2];
  const kind: 'karaoke' | 'mp3' = rawSlug.endsWith('-mp3') || rawSlug.includes('-mp3-') ? 'mp3' : 'karaoke';
  return { youtubeId, kind, rawSlug };
}

export function parseStaticSeoView(
  pathname: string
): 'browse' | 'music' | 'rooms' | 'social' | null {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (clean === 'hat-karaoke-khong-quang-cao') return 'browse';
  if (clean === 'nghe-nhac-youtube-mp3' || clean === 'nghe-nhac-khong-quang-cao') return 'music';
  if (clean === 'phong-hat-karaoke-truc-tuyen') return 'rooms';
  if (clean === 'phong-chat-va-game') return 'social';
  return null;
}

export function updateDocumentSeo(opts: {
  title: string;
  description: string;
  path?: string;
}): void {
  if (typeof document === 'undefined') return;
  document.title = opts.title;

  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  };
  setMeta('meta[name="description"]', opts.description);
  setMeta('meta[property="og:title"]', opts.title);
  setMeta('meta[property="og:description"]', opts.description);
  setMeta('meta[name="twitter:title"]', opts.title);
  setMeta('meta[name="twitter:description"]', opts.description);

  if (opts.path && typeof window !== 'undefined') {
    try {
      if (!window.location.search.includes('momoReturn=')) {
        if (window.location.pathname !== opts.path) {
          window.history.replaceState(null, '', opts.path);
        }
      }
      const fullCanonical = `${window.location.origin}${opts.path}`;
      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', fullCanonical);
      setMeta('meta[property="og:url"]', fullCanonical);
    } catch {
      // Ignore restricted history frames
    }
  }
}

// Web Audio API Sound Effects (Zero external audio dependencies)
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playBuzzSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160 + i * 25, now + i * 0.11);
    osc.frequency.linearRampToValueAtTime(110, now + i * 0.11 + 0.09);
    gain.gain.setValueAtTime(0.08, now + i * 0.11);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.11);
    osc.stop(now + i * 0.11 + 0.1);
  }
}

export function playCardSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

export function playStoneSound(isX: boolean): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(isX ? 540 : 440, now);
  osc.frequency.exponentialRampToValueAtTime(isX ? 660 : 380, now + 0.07);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.085);
}

export function playWinSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.09);
    gain.gain.setValueAtTime(0.08, now + idx * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.09);
    osc.stop(now + idx * 0.09 + 0.26);
  });
}
