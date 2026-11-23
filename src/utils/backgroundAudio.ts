// Mobile Background Audio Session + Media Session Lock-Screen Controls + Wake Lock

interface MediaSessionCallbacks {
  title: string;
  artist: string;
  album: string;
  youtubeId: string;
  isPlaying: boolean;
  durationSeconds?: number;
  positionSeconds?: number;
  onPlay: () => void;
  onPause: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeekTo?: (seconds: number) => void;
}

let keepAliveAudioEl: HTMLAudioElement | null = null;
let keepAliveBlobUrl: string | null = null;
let wakeLockSentinel: { release: () => Promise<void> } | null = null;

// Build a valid 1-second silent PCM WAV buffer so mobile browsers keep the audio focus alive when locked
function createSilentWavBlobUrl(): string {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export function startBackgroundAudioKeepAlive(): void {
  if (typeof window === 'undefined') return;

  // Claim iOS Safari 17+ background playback audioSession category
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) {
      nav.audioSession.type = 'playback';
    }
  } catch {
    // Ignore unsupported browsers
  }

  try {
    if (!keepAliveBlobUrl) {
      keepAliveBlobUrl = createSilentWavBlobUrl();
    }
    if (!keepAliveAudioEl) {
      keepAliveAudioEl = document.createElement('audio');
      keepAliveAudioEl.src = keepAliveBlobUrl;
      keepAliveAudioEl.loop = true;
      keepAliveAudioEl.setAttribute('playsinline', 'true');
      keepAliveAudioEl.volume = 0.01;
    }
    if (keepAliveAudioEl.paused) {
      keepAliveAudioEl.play().catch(() => {});
    }
  } catch {
    // Ignore
  }
}

export function stopBackgroundAudioKeepAlive(): void {
  try {
    if (keepAliveAudioEl && !keepAliveAudioEl.paused) {
      keepAliveAudioEl.pause();
    }
  } catch {
    // Ignore
  }
}

export function syncMediaSession(opts: MediaSessionCallbacks): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: opts.title,
      artist: opts.artist,
      album: opts.album,
      artwork: [
        {
          src: `https://i.ytimg.com/vi/${opts.youtubeId}/hqdefault.jpg`,
          sizes: '480x360',
          type: 'image/jpeg',
        },
        {
          src: `https://i.ytimg.com/vi/${opts.youtubeId}/mqdefault.jpg`,
          sizes: '320x180',
          type: 'image/jpeg',
        },
      ],
    });

    navigator.mediaSession.playbackState = opts.isPlaying ? 'playing' : 'paused';

    if (
      typeof opts.durationSeconds === 'number' &&
      opts.durationSeconds > 0 &&
      typeof opts.positionSeconds === 'number' &&
      typeof navigator.mediaSession.setPositionState === 'function'
    ) {
      navigator.mediaSession.setPositionState({
        duration: opts.durationSeconds,
        playbackRate: 1,
        position: Math.min(opts.positionSeconds, opts.durationSeconds),
      });
    }

    navigator.mediaSession.setActionHandler('play', () => {
      startBackgroundAudioKeepAlive();
      opts.onPlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      stopBackgroundAudioKeepAlive();
      opts.onPause();
    });
    navigator.mediaSession.setActionHandler(
      'previoustrack',
      opts.onPrev ? () => opts.onPrev?.() : null
    );
    navigator.mediaSession.setActionHandler(
      'nexttrack',
      opts.onNext ? () => opts.onNext?.() : null
    );
    navigator.mediaSession.setActionHandler(
      'seekto',
      opts.onSeekTo
        ? (details) => {
            if (typeof details.seekTime === 'number') {
              opts.onSeekTo?.(details.seekTime);
            }
          }
        : null
    );
  } catch {
    // Ignore partial browser MediaSession implementations
  }
}

export async function toggleScreenWakeLock(enable: boolean): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as unknown as {
    wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
  };

  if (!enable) {
    try {
      await wakeLockSentinel?.release();
    } catch {
      // Ignore
    }
    wakeLockSentinel = null;
    return false;
  }

  if (!nav.wakeLock) return false;
  try {
    wakeLockSentinel = await nav.wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}
