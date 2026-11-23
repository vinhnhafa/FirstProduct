import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  FileText,
  Share2,
  Lock,
  Unlock,
  Music2,
} from 'lucide-react';
import { Song } from '../types/karaoke';
import { buildSongUrlPath, formatTime } from '../utils/vietnamese';
import {
  startBackgroundAudioKeepAlive,
  stopBackgroundAudioKeepAlive,
  syncMediaSession,
} from '../utils/backgroundAudio';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          host?: string;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe?: () => HTMLIFrameElement | null;
  destroy: () => void;
}

interface KaraokePlayerProps {
  currentSong: Song;
  hasNext: boolean;
  isTvMode: boolean;
  onSongEnded: () => void;
  onNext: () => void;
  onShareToChat: (song: Song) => void;
  onReportBrokenVideo: (youtubeId: string, title: string) => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    } else {
      // Fallback poll if script already loaded
      const timer = window.setInterval(() => {
        if (window.YT && window.YT.Player) {
          window.clearInterval(timer);
          resolve();
        }
      }, 100);
    }
  });
  return ytApiPromise;
}

export function KaraokePlayer({
  currentSong,
  hasNext,
  isTvMode,
  onSongEnded,
  onNext,
  onShareToChat,
  onReportBrokenVideo,
  onToast,
}: KaraokePlayerProps) {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lyricsBoxRef = useRef<HTMLDivElement>(null);
  const onEndedRef = useRef(onSongEnded);
  const onToastRef = useRef(onToast);
  const onReportBrokenRef = useRef(onReportBrokenVideo);
  const currentSongRef = useRef(currentSong);

  onEndedRef.current = onSongEnded;
  onToastRef.current = onToast;
  onReportBrokenRef.current = onReportBrokenVideo;
  currentSongRef.current = currentSong;

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentSong.durationSeconds || 240);
  const [showLyrics, setShowLyrics] = useState(true);
  const [lyricsSize, setLyricsSize] = useState<'md' | 'lg' | 'xl'>('lg');
  const [touchLock, setTouchLock] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const loadedVideoIdRef = useRef<string>(currentSong.youtubeId);
  const wantPlayingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Initialize YouTube IFrame Player once (privacy-enhanced inline embed, no external app jump)
  useEffect(() => {
    let active = true;

    loadYouTubeIframeApi().then(() => {
      if (!active || !playerHostRef.current || !window.YT?.Player) return;

      // Create dedicated inner div so React doesn't conflict with iframe replacement
      const targetEl = document.createElement('div');
      targetEl.className = 'w-full h-full';
      playerHostRef.current.innerHTML = '';
      playerHostRef.current.appendChild(targetEl);

      playerRef.current = new window.YT.Player(targetEl, {
        host: 'https://www.youtube-nocookie.com',
        videoId: loadedVideoIdRef.current,
        playerVars: {
          autoplay: 1,
          controls: 0,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          disablekb: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (!active) return;
            const iframe = event.target.getIframe?.();
            if (iframe) {
              iframe.setAttribute('playsinline', '1');
              iframe.setAttribute('webkit-playsinline', '1');
              iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
            }
            setIsReady(true);
            setPlayerError(null);
            event.target.setVolume(volume);
            const d = event.target.getDuration();
            if (d > 0) setDuration(d);
          },
          onStateChange: (event) => {
            if (!active || !window.YT) return;
            const state = event.data;
            if (state === window.YT.PlayerState.PLAYING) {
              wantPlayingRef.current = true;
              startBackgroundAudioKeepAlive();
              setIsPlaying(true);
              setPlayerError(null);
              const d = event.target.getDuration();
              if (d > 0) setDuration(d);
            } else if (state === window.YT.PlayerState.PAUSED) {
              if (document.visibilityState === 'hidden' && wantPlayingRef.current) {
                window.setTimeout(() => {
                  if (active && wantPlayingRef.current) {
                    try {
                      event.target.playVideo();
                    } catch {
                      // Ignore
                    }
                  }
                }, 120);
              } else {
                wantPlayingRef.current = false;
                stopBackgroundAudioKeepAlive();
                setIsPlaying(false);
              }
            } else if (state === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              onEndedRef.current();
            }
          },
          onError: () => {
            if (!active) return;
            const broken = currentSongRef.current;
            setPlayerError('Video này không cho phép nhúng hoặc đã bị xóa. Hệ thống đã tự động ẩn và chuyển bài khác.');
            onReportBrokenRef.current(broken.youtubeId, broken.title);
          },
        },
      });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && wantPlayingRef.current && playerRef.current) {
        startBackgroundAudioKeepAlive();
        window.setTimeout(() => {
          if (wantPlayingRef.current) {
            try {
              playerRef.current?.playVideo();
            } catch {
              // Ignore
            }
          }
        }, 160);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopBackgroundAudioKeepAlive();
      try {
        playerRef.current?.destroy();
      } catch {
        // Ignore cleanup errors
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load new song when currentSong changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(currentSong.durationSeconds || 240);
    setPlayerError(null);
    loadedVideoIdRef.current = currentSong.youtubeId;

    if (isReady && playerRef.current) {
      try {
        playerRef.current.loadVideoById(currentSong.youtubeId);
        playerRef.current.playVideo();
      } catch {
        // Ignore transient load error
      }
    }
  }, [currentSong.id, currentSong.youtubeId, currentSong.durationSeconds, isReady]);

  // Poll current playback time for progress bar and synchronized lyrics
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (playerRef.current && isReady) {
        try {
          const t = playerRef.current.getCurrentTime();
          const d = playerRef.current.getDuration();
          if (Number.isFinite(t)) setCurrentTime(t);
          if (Number.isFinite(d) && d > 0) setDuration(d);
        } catch {
          // Ignore polling error
        }
      }
    }, 400);
    return () => window.clearInterval(interval);
  }, [isReady]);

  const handleTogglePlay = useCallback(() => {
    if (!playerRef.current || !isReady) return;
    if (isPlaying) {
      wantPlayingRef.current = false;
      stopBackgroundAudioKeepAlive();
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      wantPlayingRef.current = true;
      startBackgroundAudioKeepAlive();
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  }, [isPlaying, isReady]);

  const handleReplay = useCallback(() => {
    if (!playerRef.current || !isReady) return;
    wantPlayingRef.current = true;
    startBackgroundAudioKeepAlive();
    playerRef.current.seekTo(0, true);
    playerRef.current.playVideo();
    setCurrentTime(0);
    setIsPlaying(true);
    onToast('Đã tua lại từ đầu bài hát.', 'info');
  }, [isReady, onToast]);

  const handleVolumeChange = (nextVol: number) => {
    setVolume(nextVol);
    if (!playerRef.current || !isReady) return;
    playerRef.current.setVolume(nextVol);
    if (nextVol === 0) {
      playerRef.current.mute();
      setIsMuted(true);
    } else if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    }
  };

  const handleToggleMute = () => {
    if (!playerRef.current || !isReady) return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume > 0 ? volume : 65);
      if (volume === 0) setVolume(65);
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleSeek = useCallback(
    (seconds: number) => {
      setCurrentTime(seconds);
      if (playerRef.current && isReady) {
        playerRef.current.seekTo(seconds, true);
      }
    },
    [isReady]
  );

  // Sync mobile lock-screen media controls for Karaoke playback
  useEffect(() => {
    syncMediaSession({
      title: currentSong.title,
      artist: currentSong.artist,
      album: `${currentSong.genre} · Karaoke Online`,
      youtubeId: currentSong.youtubeId,
      isPlaying,
      durationSeconds: duration,
      positionSeconds: currentTimeRef.current,
      onPlay: () => {
        wantPlayingRef.current = true;
        startBackgroundAudioKeepAlive();
        playerRef.current?.playVideo();
        setIsPlaying(true);
      },
      onPause: () => {
        wantPlayingRef.current = false;
        stopBackgroundAudioKeepAlive();
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
      },
      onNext: hasNext ? () => onNextRef.current() : undefined,
      onSeekTo: handleSeek,
    });
  }, [
    currentSong.title,
    currentSong.artist,
    currentSong.genre,
    currentSong.youtubeId,
    isPlaying,
    duration,
    hasNext,
    handleSeek,
  ]);

  // Calculate active synced lyric index smoothly across playback duration
  const totalLines = currentSong.lyrics.length;
  const effectiveDuration = Math.max(duration, 30);
  // Skip first ~12s intro gently, distribute across song body
  const introOffset = Math.min(12, effectiveDuration * 0.08);
  const bodyDuration = Math.max(effectiveDuration - introOffset * 1.5, 20);
  const progressRatio = Math.max(0, Math.min(1, (currentTime - introOffset) / bodyDuration));
  const activeLyricIndex =
    totalLines > 0 ? Math.min(totalLines - 1, Math.floor(progressRatio * totalLines)) : 0;

  // Keep active lyric centered inside the lyrics scroll container (without scrolling whole window)
  useEffect(() => {
    if (!showLyrics || !lyricsBoxRef.current) return;
    const container = lyricsBoxRef.current;
    const activeEl = container.querySelector<HTMLElement>(`[data-lyric-idx="${activeLyricIndex}"]`);
    if (activeEl) {
      const targetScroll =
        activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  }, [activeLyricIndex, showLyrics]);

  const lyricTextClass =
    lyricsSize === 'xl'
      ? 'text-xl sm:text-2xl leading-relaxed'
      : lyricsSize === 'lg'
        ? 'text-lg sm:text-xl leading-relaxed'
        : 'text-base sm:text-lg leading-relaxed';

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <section id="karaoke-stage" className="flex flex-col gap-4">
      {/* Now Playing Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <Music2 className="w-3.5 h-3.5 shrink-0" />
            <span>Đang phát</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400">{currentSong.genre}</span>
            {currentSong.tone && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">{currentSong.tone}</span>
              </>
            )}
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-50 truncate mt-0.5">
            {currentSong.title}
          </h1>
          <p className="text-sm text-slate-400 truncate">{currentSong.artist}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setTouchLock((v) => !v);
              onToast(
                touchLock
                  ? 'Đã mở khóa chạm trực tiếp vào video YouTube.'
                  : 'Đã bật khóa chống nhảy sang app YouTube trên điện thoại.',
                'info'
              );
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              touchLock
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
            title="Giữ phát ngay trong trình duyệt điện thoại, không nhảy sang app YouTube"
          >
            {touchLock ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{touchLock ? 'Giữ trong web' : 'Chạm YT gốc'}</span>
          </button>

          <button
            type="button"
            onClick={() => onShareToChat(currentSong)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Mời phòng chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}${buildSongUrlPath(
                currentSong.title,
                currentSong.youtubeId,
                'karaoke'
              )}`;
              navigator.clipboard?.writeText(url).catch(() => {});
              onToast('Đã sao chép link hát Karaoke chuẩn SEO!', 'success');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Chép link</span>
          </button>
        </div>
      </div>

      {/* 16:9 Inline YouTube IFrame Video Stage (with mobile anti-app-jump touch shield) */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#050609] border border-slate-800/90 shadow-2xl">
        <div ref={playerHostRef} className="w-full h-full" />

        {touchLock && !playerError && (
          <div
            onClick={handleTogglePlay}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTogglePlay();
              }
            }}
            aria-label={isPlaying ? 'Tạm dừng video Karaoke' : 'Phát video Karaoke ngay trong trang'}
            className="absolute inset-0 z-10 touch-pan-y cursor-pointer flex items-center justify-center group"
          >
            {!isPlaying && (
              <div className="px-4 py-2.5 rounded-xl bg-black/75 border border-amber-500/50 text-amber-300 backdrop-blur-md flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xl group-hover:bg-black/90 transition-colors">
                <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>Chạm để Hát Karaoke ngay trong trình duyệt</span>
              </div>
            )}
          </div>
        )}

        {playerError && (
          <div className="absolute inset-0 z-20 bg-slate-950/92 flex flex-col items-center justify-center p-6 text-center gap-4">
            <p className="text-sm sm:text-base text-slate-200 max-w-md">{playerError}</p>
            <div className="flex items-center gap-3">
              {hasNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Qua bài kế tiếp
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Playback Controls Bar */}
      <div className="rounded-xl bg-[#111520] border border-slate-800/90 p-3.5 sm:p-4 space-y-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-400 tabular-nums w-11">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            value={Math.floor(currentTime)}
            onChange={(e) => handleSeek(Number(e.target.value))}
            aria-label="Thanh thời gian bài hát"
            className="karaoke-range flex-1"
            style={{
              background: `linear-gradient(to right, #F59E0B ${progressPct}%, #1E293B ${progressPct}%)`,
              height: '5px',
              borderRadius: '9999px',
            }}
          />
          <span className="font-mono text-xs text-slate-400 tabular-nums w-11 text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Action Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
            </button>

            <button
              type="button"
              onClick={handleReplay}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-300" />
              <span>Hát lại</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed text-slate-100 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              <SkipForward className="w-4 h-4 text-amber-400" />
              <span>Qua bài</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLyrics((v) => !v)}
              aria-pressed={showLyrics}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer border ${
                showLyrics
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{showLyrics ? 'Ẩn lời bài hát' : 'Hiện lời bài hát'}</span>
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg">
            <button
              type="button"
              onClick={handleToggleMute}
              className="text-slate-300 hover:text-amber-400 transition-colors p-1 cursor-pointer"
              aria-label={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              aria-label="Âm lượng"
              className="karaoke-range w-24 sm:w-28"
              style={{
                background: `linear-gradient(to right, #F59E0B ${isMuted ? 0 : volume}%, #334155 ${isMuted ? 0 : volume}%)`,
                height: '5px',
                borderRadius: '9999px',
              }}
            />
            <span className="font-mono text-xs text-slate-400 tabular-nums w-8 text-right">
              {isMuted ? 0 : volume}%
            </span>
          </div>
        </div>
      </div>

      {/* Synchronized Large Karaoke Lyrics Panel */}
      {showLyrics && (
        <div
          className={`rounded-xl bg-[#111520] border border-slate-800/90 overflow-hidden ${
            isTvMode ? 'ring-1 ring-amber-500/30' : ''
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/50">
            <span className="text-xs font-semibold text-slate-300">
              Lời bài hát chạy theo nhịp
            </span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {(
                [
                  { id: 'md', label: 'Vừa' },
                  { id: 'lg', label: 'Lớn' },
                  { id: 'xl', label: 'TV' },
                ] as const
              ).map((sizeOpt) => (
                <button
                  key={sizeOpt.id}
                  type="button"
                  onClick={() => setLyricsSize(sizeOpt.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    lyricsSize === sizeOpt.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {sizeOpt.label}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={lyricsBoxRef}
            className="relative max-h-60 sm:max-h-72 overflow-y-auto custom-scrollbar px-5 py-6 text-center space-y-3"
          >
            {currentSong.lyrics.map((line, index) => {
              const isActive = index === activeLyricIndex;
              const isPast = index < activeLyricIndex;
              return (
                <p
                  key={`${currentSong.id}-line-${index}`}
                  data-lyric-idx={index}
                  onClick={() => {
                    const targetTime =
                      introOffset + (index / Math.max(1, totalLines)) * bodyDuration;
                    handleSeek(targetTime);
                  }}
                  className={`cursor-pointer transition-all duration-200 px-2 py-1 rounded-lg ${lyricTextClass} ${
                    isActive
                      ? 'text-amber-400 font-bold scale-[1.02] bg-amber-500/10'
                      : isPast
                        ? 'text-slate-500'
                        : 'text-slate-200 hover:text-slate-50'
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
