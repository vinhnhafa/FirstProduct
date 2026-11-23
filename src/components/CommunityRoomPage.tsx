import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  Bold,
  Check,
  Crown,
  Edit3,
  Globe,
  Headphones,
  Italic,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  SkipForward,
  Smile,
  Sparkles,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Youtube,
} from 'lucide-react';
import { VietnamChatRoomDef } from '../../shared/vietnamChatRooms';
import {
  ChatMessage,
  OnlineChatMember,
  PrivateChatMessage,
  Song,
  YmRoomMusicState,
} from '../types/karaoke';
import { extractYouTubeId, formatTime, playBuzzSound } from '../utils/vietnamese';

interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe?: () => HTMLIFrameElement | null;
  destroy: () => void;
}

interface CommunityRoomPageProps {
  room: VietnamChatRoomDef;
  userId: string;
  nickname: string;
  onNicknameChange: (nextNick: string) => void;
  musicState: YmRoomMusicState | null;
  roomUsers: Array<{ id: string; nickname: string }>;
  onlineDirectory: OnlineChatMember[];
  messages: ChatMessage[];
  chatMode: 'public' | 'private';
  onChangeChatMode: (mode: 'public' | 'private') => void;
  activeDmPeer: { id: string; nickname: string } | null;
  dmPeerList: Array<{
    id: string;
    nickname: string;
    isOnline: boolean;
    roomName?: string;
    lastMessage?: string;
    unread: number;
  }>;
  activeDmMessages: PrivateChatMessage[];
  totalUnreadPrivate: number;
  onOpenPrivateChat: (peer: { id: string; nickname: string }) => void;
  onLeaveRoom: () => void;
  sendEvent: (type: string, payload?: Record<string, unknown>) => void;
  onParallelKaraoke: (youtubeId: string, title: string, artist: string) => void;
  isParallelKaraokeActive: boolean;
  localRoomMuted: boolean;
  onSetLocalRoomMuted: (muted: boolean) => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

const YAHOO_EMOTICONS: { code: string; label: string; emoji: string }[] = [
  { code: ':))', label: 'Cười tươi', emoji: '😄' },
  { code: '=))', label: 'Cười lăn lộn', emoji: '🤣' },
  { code: ';))', label: 'Nháy mắt', emoji: '😉' },
  { code: ':D', label: 'Khoái chí', emoji: '😁' },
  { code: ':-*', label: 'Hôn gió', emoji: '😘' },
  { code: ':((', label: 'Khóc nhè', emoji: '😭' },
  { code: ':-/', label: 'Phân vân', emoji: '😕' },
  { code: 'B-)', label: 'Ngầu lòi', emoji: '😎' },
  { code: ':P', label: 'Lè lưỡi', emoji: '😛' },
  { code: '<3', label: 'Trái tim', emoji: '❤️' },
];

const TEXT_COLORS = ['#F8FAFC', '#FBBF24', '#38BDF8', '#F472B6', '#34D399', '#C084FC'];

function renderTextWithEmoticons(text: string): string {
  let out = text;
  for (const emo of YAHOO_EMOTICONS) {
    out = out.split(emo.code).join(` ${emo.emoji} `);
  }
  return out;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CommunityRoomPage({
  room,
  userId,
  nickname,
  onNicknameChange,
  musicState,
  roomUsers,
  messages,
  chatMode,
  onChangeChatMode,
  activeDmPeer,
  dmPeerList,
  activeDmMessages,
  totalUnreadPrivate,
  onOpenPrivateChat,
  onLeaveRoom,
  sendEvent,
  onParallelKaraoke,
  isParallelKaraokeActive,
  localRoomMuted,
  onSetLocalRoomMuted,
  onToast,
}: CommunityRoomPageProps) {
  const isHost = Boolean(musicState?.hostUserId && musicState.hostUserId === userId);
  const currentTrack = musicState?.currentTrack ?? null;
  const playlist = musicState?.playlist ?? [];

  // Inline Synced YouTube Player State
  const playerHostRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const [volume, setVolume] = useState(80);
  const isMuted = localRoomMuted;
  const localRoomMutedRef = useRef(localRoomMuted);
  localRoomMutedRef.current = localRoomMuted;
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentTrack?.durationSeconds || 240);

  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const musicStateRef = useRef(musicState);
  musicStateRef.current = musicState;
  const loadedYtIdRef = useRef<string>('');

  // Member Song Search & Suggestion State
  const [songSearchInput, setSongSearchInput] = useState('');
  const [suggestedSongs, setSuggestedSongs] = useState<Song[]>([]);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearchingSongs, setIsSearchingSongs] = useState(false);
  const [isLoadingSuggested, setIsLoadingSuggested] = useState(false);
  const [pastedTitle, setPastedTitle] = useState('');
  const [showAddSongDrawer, setShowAddSongDrawer] = useState(true);

  // Chat Composer & UI State
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(nickname);
  const [inputText, setInputText] = useState('');
  const [textColor, setTextColor] = useState('#F8FAFC');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [showEmoticons, setShowEmoticons] = useState(false);
  const [isBuzzing, setIsBuzzing] = useState(false);
  const [rightTab, setRightTab] = useState<'chat' | 'members'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const detectedYoutubeId = useMemo(() => extractYouTubeId(songSearchInput), [songSearchInput]);

  // Initialize Inline YouTube Player inside this Dedicated Room Page
  useEffect(() => {
    let active = true;

    const initPlayer = () => {
      if (!active || !playerHostRef.current || !window.YT?.Player) return;
      const target = document.createElement('div');
      target.className = 'w-full h-full';
      playerHostRef.current.innerHTML = '';
      playerHostRef.current.appendChild(target);

      const initialYtId = musicStateRef.current?.currentTrack?.youtubeId || 'WaXpzNZw4jI';
      loadedYtIdRef.current = initialYtId;

      ytPlayerRef.current = new window.YT.Player(target, {
        host: 'https://www.youtube-nocookie.com',
        videoId: initialYtId,
        playerVars: {
          autoplay: 0,
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
          onReady: (e) => {
            if (!active) return;
            const iframe = e.target.getIframe?.();
            if (iframe) {
              iframe.setAttribute('playsinline', '1');
              iframe.setAttribute('webkit-playsinline', '1');
              iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
            }
            setYtReady(true);
            e.target.setVolume(volume);
            if (localRoomMutedRef.current) {
              e.target.mute();
            } else {
              e.target.unMute();
            }
            const st = musicStateRef.current;
            if (st?.isPlaying && st.currentTrack) {
              try {
                const elapsed = Math.max(0, (Date.now() - st.syncedAt) / 1000);
                e.target.seekTo(st.positionSeconds + elapsed, true);
                e.target.playVideo();
              } catch {
                setAutoplayBlocked(true);
              }
            }
          },
          onStateChange: (e) => {
            if (!active || !window.YT) return;
            if (e.data === window.YT.PlayerState.PLAYING) {
              setAutoplayBlocked(false);
              const d = e.target.getDuration();
              if (d > 0) setDuration(d);
            } else if (e.data === window.YT.PlayerState.ENDED && isHostRef.current) {
              sendEvent('ym:music_control', { roomId: room.id, action: 'next' });
            }
          },
          onError: () => {
            if (!active) return;
            if (isHostRef.current) {
              sendEvent('ym:music_control', { roomId: room.id, action: 'next' });
            }
          },
        },
      }) as unknown as YTPlayerInstance;
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCb?.();
        initPlayer();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      active = false;
      setYtReady(false);
      try {
        ytPlayerRef.current?.destroy();
      } catch {
        // Ignore
      }
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  // Synchronize player with authoritative Server Music State
  useEffect(() => {
    if (!ytReady || !ytPlayerRef.current || !musicState?.currentTrack) return;
    const player = ytPlayerRef.current;
    const targetId = musicState.currentTrack.youtubeId;
    setDuration(musicState.currentTrack.durationSeconds || 240);

    try {
      if (loadedYtIdRef.current !== targetId) {
        loadedYtIdRef.current = targetId;
        player.loadVideoById(targetId);
        if (!musicState.isPlaying) {
          window.setTimeout(() => {
            try {
              player.pauseVideo();
            } catch {
              // Ignore
            }
          }, 250);
        }
      }

      if (musicState.isPlaying) {
        const expectedPos =
          musicState.positionSeconds + Math.max(0, (Date.now() - musicState.syncedAt) / 1000);
        const cur = player.getCurrentTime();
        if (Math.abs(cur - expectedPos) > 3.2) {
          player.seekTo(expectedPos, true);
        }
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } catch {
      if (musicState.isPlaying) setAutoplayBlocked(true);
    }
  }, [
    ytReady,
    musicState?.currentTrack?.trackId,
    musicState?.currentTrack?.youtubeId,
    musicState?.currentTrack?.durationSeconds,
    musicState?.isPlaying,
    musicState?.positionSeconds,
    musicState?.syncedAt,
  ]);

  // Apply local speaker mute state independently without pausing room
  useEffect(() => {
    if (!ytReady || !ytPlayerRef.current) return;
    try {
      if (localRoomMuted) {
        ytPlayerRef.current.mute();
      } else {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(volume > 0 ? volume : 75);
      }
    } catch {
      // Ignore
    }
  }, [ytReady, localRoomMuted, volume]);

  // Poll playback progress locally
  useEffect(() => {
    if (!ytReady) return;
    const timer = window.setInterval(() => {
      if (!ytPlayerRef.current) return;
      try {
        const t = ytPlayerRef.current.getCurrentTime();
        const d = ytPlayerRef.current.getDuration();
        if (Number.isFinite(t)) setCurrentTime(t);
        if (Number.isFinite(d) && d > 0) setDuration(d);
      } catch {
        // Ignore
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [ytReady]);

  // Load room-relevant YouTube suggestions automatically on room entry
  useEffect(() => {
    let active = true;
    setIsLoadingSuggested(true);
    setSuggestedSongs([]);
    fetch(
      `/api/youtube/search?q=${encodeURIComponent(room.defaultQuery)}&genre=${encodeURIComponent(
        room.suggestedGenre
      )}&karaokeOnly=false&musicOnly=true`
    )
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Song[] }) => {
        if (active && Array.isArray(d.items)) {
          setSuggestedSongs(d.items.slice(0, 8));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingSuggested(false);
      });
    return () => {
      active = false;
    };
  }, [room.id, room.defaultQuery, room.suggestedGenre]);

  // Resolve pasted YouTube link title
  useEffect(() => {
    if (!detectedYoutubeId) {
      setPastedTitle('');
      return;
    }
    let active = true;
    fetch(`/api/youtube/oembed?id=${encodeURIComponent(detectedYoutubeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { title?: string } | null) => {
        if (active && d?.title) setPastedTitle(d.title);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [detectedYoutubeId]);

  // Search YouTube for member song contributions
  useEffect(() => {
    const trimmed = songSearchInput.trim();
    if (detectedYoutubeId || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearchingSongs(false);
      return;
    }

    let active = true;
    setIsSearchingSongs(true);
    const timer = window.setTimeout(() => {
      fetch(
        `/api/youtube/search?q=${encodeURIComponent(trimmed)}&genre=${encodeURIComponent(
          room.suggestedGenre
        )}&karaokeOnly=false&musicOnly=true`
      )
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: Song[] }) => {
          if (active && Array.isArray(d.items)) {
            setSearchResults(d.items.slice(0, 10));
          }
        })
        .catch(() => {
          if (active) setSearchResults([]);
        })
        .finally(() => {
          if (active) setIsSearchingSongs(false);
        });
    }, 360);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [songSearchInput, detectedYoutubeId, room.suggestedGenre]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, activeDmMessages.length, chatMode, activeDmPeer?.id]);

  const handleHostTogglePlay = () => {
    if (!isHost) return;
    const pos = ytPlayerRef.current ? ytPlayerRef.current.getCurrentTime() : currentTime;
    sendEvent('ym:music_control', {
      roomId: room.id,
      action: musicState?.isPlaying ? 'pause' : 'play',
      positionSeconds: Number.isFinite(pos) ? pos : 0,
    });
  };

  const handleHostNext = () => {
    if (!isHost) return;
    sendEvent('ym:music_control', { roomId: room.id, action: 'next' });
  };

  const handleHostSelectTrack = (trackId: string) => {
    if (!isHost) return;
    sendEvent('ym:music_control', { roomId: room.id, action: 'select_track', trackId });
  };

  const handleHostSeek = (seconds: number) => {
    if (!isHost) return;
    setCurrentTime(seconds);
    ytPlayerRef.current?.seekTo(seconds, true);
    sendEvent('ym:music_control', {
      roomId: room.id,
      action: 'seek',
      positionSeconds: seconds,
    });
  };

  const handleAddSongToRoom = (song: {
    youtubeId: string;
    title: string;
    artist: string;
    durationSeconds?: number;
  }) => {
    sendEvent('ym:playlist_add', {
      roomId: room.id,
      song: {
        youtubeId: song.youtubeId,
        title: song.title,
        artist: song.artist,
        durationSeconds: song.durationSeconds || 240,
      },
    });
    onToast(`Đã thêm "${song.title}" vào danh sách phòng ${room.shortName}!`, 'success');
  };

  const handleVolumeChange = (next: number) => {
    setVolume(next);
    if (!ytPlayerRef.current) return;
    ytPlayerRef.current.setVolume(next);
    if (next === 0) {
      ytPlayerRef.current.mute();
      onSetLocalRoomMuted(true);
    } else if (isMuted) {
      ytPlayerRef.current.unMute();
      onSetLocalRoomMuted(false);
    }
  };

  const handleToggleMute = () => {
    if (!ytPlayerRef.current) return;
    if (isMuted) {
      ytPlayerRef.current.unMute();
      ytPlayerRef.current.setVolume(volume > 0 ? volume : 75);
      if (volume === 0) setVolume(75);
      onSetLocalRoomMuted(false);
    } else {
      ytPlayerRef.current.mute();
      onSetLocalRoomMuted(true);
    }
  };

  const handleSendChat = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    if (chatMode === 'private') {
      if (!activeDmPeer) {
        onToast('Hãy chọn một thành viên để chat riêng.', 'info');
        return;
      }
      sendEvent('ym:dm_send', {
        toUserId: activeDmPeer.id,
        toName: activeDmPeer.nickname,
        message: {
          id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: trimmed,
          color: textColor,
          isBold,
          isItalic,
        },
      });
      setInputText('');
      setShowEmoticons(false);
      return;
    }

    sendEvent('ym:send', {
      roomId: room.id,
      message: {
        id: `ym-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        roomId: room.id,
        sender: nickname,
        text: trimmed,
        timestamp: nowTimeStr(),
        color: textColor,
        isBold,
        isItalic,
      },
    });
    setInputText('');
    setShowEmoticons(false);
  };

  const handleBuzz = () => {
    setIsBuzzing(true);
    playBuzzSound();
    window.setTimeout(() => setIsBuzzing(false), 500);
    if (chatMode === 'private') {
      if (!activeDmPeer) {
        onToast('Hãy chọn người nhận để gửi BUZZ! riêng.', 'info');
        return;
      }
      sendEvent('ym:dm_buzz', { toUserId: activeDmPeer.id, toName: activeDmPeer.nickname });
      return;
    }
    sendEvent('ym:buzz', { roomId: room.id, nickname });
  };

  const handleShareRoomTrackToChat = () => {
    if (!currentTrack) return;
    if (chatMode === 'private' && activeDmPeer) {
      sendEvent('ym:dm_send', {
        toUserId: activeDmPeer.id,
        toName: activeDmPeer.nickname,
        message: {
          id: `dm-share-${Date.now()}`,
          text: `Cùng nghe bài "${currentTrack.title}" trong ${room.name} nhé!`,
          color: '#FBBF24',
          isBold: true,
          sharedSong: {
            title: currentTrack.title,
            artist: currentTrack.artist,
            youtubeId: currentTrack.youtubeId,
          },
        },
      });
      return;
    }
    sendEvent('ym:send', {
      roomId: room.id,
      message: {
        id: `share-${Date.now()}`,
        roomId: room.id,
        sender: nickname,
        text: `Đang nghe bài "${currentTrack.title}" cùng cả phòng ${room.shortName}!`,
        timestamp: nowTimeStr(),
        color: '#FBBF24',
        sharedSong: {
          title: currentTrack.title,
          artist: currentTrack.artist,
          youtubeId: currentTrack.youtubeId,
        },
      },
    });
  };

  const handleSaveNickname = () => {
    const clean = nickDraft.trim().replace(/\s+/g, '_') || 'ca_si_online';
    onNicknameChange(clean);
    setNickDraft(clean);
    setIsEditingNick(false);
    onToast(`Đã đổi nickname thành "${clean}"`, 'success');
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const displayedCandidateSongs =
    songSearchInput.trim().length >= 2 && !detectedYoutubeId ? searchResults : suggestedSongs;
  const existingYoutubeIds = useMemo(
    () => new Set(playlist.map((t) => t.youtubeId)),
    [playlist]
  );

  return (
    <section
      id="community-room-page"
      className={`rounded-2xl overflow-hidden border border-purple-500/40 bg-[#0F121C] shadow-2xl ${
        isBuzzing ? 'animate-buzz' : ''
      }`}
    >
      {/* Dedicated Room Top Bar */}
      <div className="bg-gradient-to-r from-[#4C1D95] via-[#6B21A8] to-[#3B0764] px-4 py-3 border-b border-purple-400/25 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-950 text-amber-300 border border-amber-400/35 text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Danh sách phòng</span>
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wide shrink-0">
                {room.group}
              </span>
              <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                {room.name}
              </h2>
            </div>
            <p className="text-xs text-purple-100/80 truncate mt-0.5">{room.topic}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/55 border border-emerald-400/35 text-xs font-semibold text-emerald-300 tabular-nums">
            <Users className="w-3.5 h-3.5" />
            <span>{Math.max(1, roomUsers.length)} đang tham gia</span>
          </span>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
              isHost
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-slate-950/55 border-amber-400/35 text-amber-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>
              {isHost
                ? 'Bạn là Chủ phòng'
                : musicState?.hostName
                  ? `Chủ phòng: ${musicState.hostName}`
                  : 'Chưa có chủ phòng'}
            </span>
          </span>

          {!musicState?.hostUserId && (
            <button
              type="button"
              onClick={() => sendEvent('ym:claim_host', { roomId: room.id })}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Nhận Chủ phòng
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/phong/${room.id}`;
              navigator.clipboard?.writeText(url).catch(() => {});
              onToast(`Đã chép link ${room.name}!`, 'success');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-purple-300/30 text-xs text-purple-100 cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chép link</span>
          </button>
        </div>
      </div>

      {/* Main Dedicated Room Workspace: Left (Host-Controlled Music Player + Member Playlist), Right (Room Chat & Members) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* LEFT COLUMN: Shared Music Stage & Member Song Additions */}
        <div className="lg:col-span-7 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-slate-800 space-y-4 bg-[#0B0E17]">
          {/* Synced Inline YouTube Player */}
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#050609]">
            <div className="relative aspect-video w-full">
              <div ref={playerHostRef} className="w-full h-full" />

              {/* Mobile anti-app-jump touch shield */}
              <div
                onClick={() => {
                  if (isHost) handleHostTogglePlay();
                  else {
                    try {
                      ytPlayerRef.current?.unMute();
                      ytPlayerRef.current?.setVolume(volume);
                      if (musicState?.isPlaying) ytPlayerRef.current?.playVideo();
                      setAutoplayBlocked(false);
                    } catch {
                      // Ignore
                    }
                  }
                }}
                className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center"
                title={
                  isHost
                    ? 'Chủ phòng chạm để Bật / Tạm dừng nhạc phòng'
                    : 'Chạm để đồng bộ âm thanh nhạc phòng ngay trong trình duyệt'
                }
              >
                {autoplayBlocked && musicState?.isPlaying && (
                  <div className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    <span>Chạm để bật tiếng nhạc Chủ phòng đang phát</span>
                  </div>
                )}

                {!musicState?.isPlaying && (
                  <div className="px-4 py-2 rounded-xl bg-black/75 border border-slate-700 text-slate-200 backdrop-blur-md text-xs font-medium flex items-center gap-2">
                    {isHost ? (
                      <>
                        <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span>Bấm Bật Nhạc để phát cho cả phòng cùng nghe</span>
                      </>
                    ) : (
                      <>
                        <Headphones className="w-4 h-4 text-purple-300" />
                        <span>Đang chờ Chủ phòng ({musicState?.hostName || '...'}) bật nhạc</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Now Playing & Host-Only Playback Bar */}
            <div className="p-3.5 bg-[#121624] border-t border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        musicState?.isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    <span className={musicState?.isPlaying ? 'text-emerald-300' : 'text-slate-400'}>
                      {musicState?.isPlaying ? 'Đang phát nhạc phòng' : 'Nhạc phòng đang tạm dừng'}
                    </span>
                    {currentTrack && (
                      <span className="text-slate-500 truncate">
                        · Thêm bởi: <strong className="text-slate-300">{currentTrack.addedByName}</strong>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-50 truncate mt-0.5">
                    {currentTrack?.title || 'Chưa có bài hát trong danh sách phòng'}
                  </h3>
                  {currentTrack && (
                    <p className="text-xs text-slate-400 truncate">{currentTrack.artist}</p>
                  )}
                </div>

                {/* Local Speaker Volume (Available for everyone) */}
                <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="text-slate-300 hover:text-amber-400 cursor-pointer"
                    aria-label={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
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
                    aria-label="Âm lượng nghe nhạc phòng"
                    className="karaoke-range w-20"
                  />
                  <span className="font-mono text-[11px] text-slate-400 w-7 text-right tabular-nums">
                    {isMuted ? 0 : volume}%
                  </span>
                </div>
              </div>

              {/* Progress Slider (Host interactive, Members read-only) */}
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] text-slate-400 w-10 tabular-nums">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, Math.floor(duration))}
                  value={Math.floor(currentTime)}
                  disabled={!isHost}
                  onChange={(e) => handleHostSeek(Number(e.target.value))}
                  aria-label="Tiến độ bài hát phòng"
                  className="karaoke-range flex-1 disabled:opacity-70"
                  style={{
                    background: `linear-gradient(to right, #F59E0B ${progressPct}%, #1E293B ${progressPct}%)`,
                    height: '5px',
                    borderRadius: '9999px',
                  }}
                />
                <span className="font-mono text-[11px] text-slate-400 w-10 text-right tabular-nums">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Host Controls vs Member Notice */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                {isHost ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleHostTogglePlay}
                      disabled={!currentTrack}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      {musicState?.isPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>{musicState?.isPlaying ? 'Tạm dừng nhạc' : 'Bật nhạc phòng'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleHostNext}
                      disabled={playlist.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-semibold text-xs border border-slate-700 cursor-pointer"
                    >
                      <SkipForward className="w-3.5 h-3.5 text-amber-400" />
                      <span>Qua bài</span>
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Chỉ Chủ phòng ({musicState?.hostName || 'đang chờ'}) có quyền bật/chuyển nhạc. Bạn có thể thêm bài bên dưới!
                    </span>
                  </div>
                )}

                {currentTrack && (
                  <button
                    type="button"
                    onClick={() =>
                      onParallelKaraoke(
                        currentTrack.youtubeId,
                        currentTrack.title,
                        currentTrack.artist
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      isParallelKaraokeActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    }`}
                    title="Mở Sân Khấu Karaoke song song cho riêng bạn — nhạc phòng vẫn tiếp tục phát"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>
                      {isParallelKaraokeActive
                        ? 'Đang mở Karaoke song song'
                        : 'Hát Karaoke song song'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Room Playlist (Host + Member Contributed Tracks) */}
          <div className="rounded-xl bg-[#121624] border border-slate-800 overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                  Danh Sách Bài Hát Của Phòng ({playlist.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSongDrawer((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddSongDrawer ? 'Thu gọn tìm bài' : 'Thêm bài cho phòng'}</span>
              </button>
            </div>

            {/* Member Song Contribution Box */}
            {showAddSongDrawer && (
              <div className="p-3 border-b border-slate-800 bg-slate-950/50 space-y-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={songSearchInput}
                    onChange={(e) => setSongSearchInput(e.target.value)}
                    placeholder={`Tìm nhạc hợp ${room.name} (${room.suggestedGenre}) hoặc dán link YouTube...`}
                    className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {detectedYoutubeId ? (
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-amber-500/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Youtube className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="text-xs text-slate-100 truncate">
                        {pastedTitle || `Video YouTube (${detectedYoutubeId})`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddSongToRoom({
                          youtubeId: detectedYoutubeId,
                          title: pastedTitle || `Bài hát YouTube (${detectedYoutubeId})`,
                          artist: room.shortName,
                        });
                        setSongSearchInput('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shrink-0 cursor-pointer"
                    >
                      + Thêm vào phòng
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                        <Sparkles className="w-3 h-3" />
                        {songSearchInput.trim().length >= 2
                          ? `Kết quả tìm kiếm cho "${songSearchInput.trim()}"`
                          : `Gợi ý nhạc hợp ${room.shortName} (${room.suggestedGenre})`}
                      </span>
                      {(isSearchingSongs || isLoadingSuggested) && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      )}
                    </div>

                    <div className="max-h-44 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {displayedCandidateSongs.map((s) => {
                        const alreadyAdded = existingYoutubeIds.has(s.youtubeId);
                        return (
                          <div
                            key={s.youtubeId}
                            className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-slate-100 truncate">{s.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{s.artist}</p>
                            </div>
                            <button
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => handleAddSongToRoom(s)}
                              className={`px-2 py-1 rounded text-[11px] font-semibold shrink-0 cursor-pointer ${
                                alreadyAdded
                                  ? 'bg-slate-800 text-slate-500 cursor-default'
                                  : 'bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40'
                              }`}
                            >
                              {alreadyAdded ? 'Đã có' : '+ Thêm'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Current Room Queue List */}
            <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-slate-800/70">
              {playlist.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400">
                  Chưa có bài hát nào. Thành viên có thể bấm &ldquo;Thêm bài cho phòng&rdquo; ở trên!
                </p>
              ) : (
                playlist.map((track, idx) => {
                  const isCurrent = currentTrack?.trackId === track.trackId;
                  const canRemove = isHost || track.addedByUserId === userId;
                  return (
                    <div
                      key={track.trackId}
                      className={`px-3.5 py-2.5 flex items-center justify-between gap-2.5 ${
                        isCurrent ? 'bg-amber-500/10' : 'hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="font-mono text-[11px] text-slate-500 w-5 shrink-0 tabular-nums">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isCurrent ? 'text-amber-300' : 'text-slate-100'
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {track.artist} · Thêm bởi{' '}
                            <span className="text-slate-200">{track.addedByName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                            Đang chọn
                          </span>
                        )}
                        {isHost && !isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleHostSelectTrack(track.trackId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>Phát</span>
                          </button>
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() =>
                              sendEvent('ym:playlist_remove', {
                                roomId: room.id,
                                trackId: track.trackId,
                              })
                            }
                            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                            title="Xóa bài này khỏi phòng"
                            aria-label="Xóa bài khỏi phòng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Room Public Chat, Private 1-1 Chat & Room Members */}
        <div className="lg:col-span-5 flex flex-col h-[640px] lg:h-[760px] bg-[#12131C]">
          {/* Chat Mode / Roster Header */}
          <div className="px-3 py-2 bg-[#191B28] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRightTab('chat');
                  onChangeChatMode('public');
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  rightTab === 'chat' && chatMode === 'public'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Chat phòng</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRightTab('chat');
                  onChangeChatMode('private');
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  rightTab === 'chat' && chatMode === 'private'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Chat riêng</span>
                {totalUnreadPrivate > 0 && (
                  <span className="px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-mono tabular-nums">
                    {totalUnreadPrivate}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRightTab('members')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  rightTab === 'members'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Thành viên ({Math.max(1, roomUsers.length)})</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Nick:</span>
              {isEditingNick ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={nickDraft}
                    onChange={(e) => setNickDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
                    maxLength={22}
                    className="w-24 h-6 px-2 rounded bg-slate-900 border border-purple-500 text-xs text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveNickname}
                    className="p-1 rounded bg-emerald-600 text-white cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNickDraft(nickname);
                    setIsEditingNick(true);
                  }}
                  className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
                >
                  <span>{nickname}</span>
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Right Panel Body */}
          {rightTab === 'members' ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-[#0D0F17]">
              <p className="text-xs text-slate-400">
                Danh sách thành viên đang tham gia <strong>{room.name}</strong>:
              </p>
              {roomUsers.map((member) => {
                const isMe = member.id === userId;
                const memberIsHost = musicState?.hostUserId === member.id;
                return (
                  <div
                    key={member.id}
                    className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span
                        className={`text-xs font-semibold truncate ${
                          isMe ? 'text-amber-300' : 'text-slate-100'
                        }`}
                      >
                        {member.nickname} {isMe ? '(Bạn)' : ''}
                      </span>
                      {memberIsHost && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                          <Crown className="w-2.5 h-2.5" />
                          Chủ phòng
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isHost && !isMe && (
                        <button
                          type="button"
                          onClick={() => {
                            sendEvent('ym:transfer_host', {
                              roomId: room.id,
                              targetUserId: member.id,
                            });
                            onToast(`Đã chuyển quyền Chủ phòng cho ${member.nickname}`, 'info');
                          }}
                          className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/35 text-[11px] font-semibold cursor-pointer"
                        >
                          Nhường chủ phòng
                        </button>
                      )}
                      {!isMe && (
                        <button
                          type="button"
                          onClick={() => {
                            setRightTab('chat');
                            onOpenPrivateChat(member);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Chat riêng</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {/* Private Peer Selector Strip when in Chat Riêng */}
              {chatMode === 'private' && (
                <div className="px-3 py-2 bg-[#141724] border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
                  {dmPeerList.length === 0 ? (
                    <span className="text-[11px] text-slate-400">
                      Chưa có thành viên khác online để nhắn riêng.
                    </span>
                  ) : (
                    dmPeerList.map((peer) => (
                      <button
                        key={peer.id}
                        type="button"
                        onClick={() => onOpenPrivateChat({ id: peer.id, nickname: peer.nickname })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer border ${
                          activeDmPeer?.id === peer.id
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            peer.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                        <span>{peer.nickname}</span>
                        {peer.unread > 0 && (
                          <span className="px-1 rounded-full bg-rose-500 text-white text-[10px]">
                            {peer.unread}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-2.5 text-sm bg-[#0D0F17]">
                {chatMode === 'public' ? (
                  messages.map((msg) => {
                    const isMe = msg.sender === nickname || msg.senderId === userId;
                    const canDm = Boolean(msg.senderId && msg.senderId !== userId);
                    return (
                      <div key={msg.id} className="leading-relaxed break-words">
                        <span className="font-mono text-[11px] text-slate-500 mr-1.5 tabular-nums">
                          [{msg.timestamp}]
                        </span>
                        {canDm ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenPrivateChat({ id: msg.senderId!, nickname: msg.sender })
                            }
                            title={`Nhắn riêng cho ${msg.sender}`}
                            className="font-semibold mr-1.5 text-purple-300 hover:text-amber-300 hover:underline cursor-pointer"
                          >
                            {msg.sender}:
                          </button>
                        ) : (
                          <span
                            className={`font-semibold mr-1.5 ${
                              isMe ? 'text-amber-400' : 'text-purple-300'
                            }`}
                          >
                            {msg.sender}:
                          </span>
                        )}
                        {msg.isBuzz ? (
                          <span className="font-extrabold text-rose-500">
                            BUZZ!!! (Rung phòng)
                          </span>
                        ) : (
                          <span
                            style={{ color: msg.color }}
                            className={`${msg.isBold ? 'font-bold' : ''} ${
                              msg.isItalic ? 'italic' : ''
                            }`}
                          >
                            {renderTextWithEmoticons(msg.text)}
                          </span>
                        )}
                        {msg.sharedSong && (
                          <div className="mt-1 ml-6 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-amber-500/30">
                            <Music className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="text-xs text-slate-200">{msg.sharedSong.title}</span>
                            <button
                              type="button"
                              onClick={() =>
                                onParallelKaraoke(
                                  msg.sharedSong!.youtubeId,
                                  msg.sharedSong!.title,
                                  msg.sharedSong!.artist
                                )
                              }
                              className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold cursor-pointer"
                            >
                              Hát song song
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : !activeDmPeer ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-slate-400">
                    <Lock className="w-7 h-7 text-purple-400 mb-2" />
                    <p>Chọn thành viên ở trên hoặc bấm vào tên trong chat phòng để nhắn riêng 1-1.</p>
                  </div>
                ) : (
                  activeDmMessages.map((msg) => {
                    const isMe = msg.fromUserId === userId;
                    return (
                      <div key={msg.id} className="leading-relaxed break-words">
                        <span className="font-mono text-[11px] text-slate-500 mr-1.5 tabular-nums">
                          [{msg.timestamp}]
                        </span>
                        <span
                          className={`font-semibold mr-1.5 ${
                            isMe ? 'text-amber-400' : 'text-emerald-300'
                          }`}
                        >
                          {isMe ? nickname : msg.fromName}:
                        </span>
                        {msg.isBuzz ? (
                          <span className="font-extrabold text-rose-500">BUZZ!!!</span>
                        ) : (
                          <span
                            style={{ color: msg.color }}
                            className={`${msg.isBold ? 'font-bold' : ''} ${
                              msg.isItalic ? 'italic' : ''
                            }`}
                          >
                            {renderTextWithEmoticons(msg.text)}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Formatting Toolbar */}
              <div className="relative px-3 py-1.5 bg-[#151824] border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleBuzz}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600/35 text-rose-400 border border-rose-500/40 font-extrabold text-xs cursor-pointer"
                  >
                    <BellRing className="w-3 h-3" />
                    <span>BUZZ!</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmoticons((v) => !v)}
                    className="p-1.5 rounded text-slate-300 hover:bg-slate-800 cursor-pointer"
                    aria-label="Mặt cười Yahoo"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBold((v) => !v)}
                    className={`p-1.5 rounded cursor-pointer ${
                      isBold ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                    aria-label="In đậm"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsItalic((v) => !v)}
                    className={`p-1.5 rounded cursor-pointer ${
                      isItalic ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                    aria-label="In nghiêng"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <div className="hidden sm:flex items-center gap-1 ml-1 pl-2 border-l border-slate-700">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTextColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-3 h-3 rounded-sm cursor-pointer ${
                          textColor === c ? 'ring-2 ring-white scale-110' : 'opacity-75'
                        }`}
                        aria-label={`Chọn màu chữ ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {currentTrack && (
                  <button
                    type="button"
                    onClick={handleShareRoomTrackToChat}
                    className="text-[11px] text-amber-300 hover:text-amber-200 font-medium cursor-pointer whitespace-nowrap"
                  >
                    Chia sẻ bài phòng
                  </button>
                )}

                {showEmoticons && (
                  <div className="absolute bottom-10 left-3 z-20 p-2 rounded-xl bg-[#1A1D2D] border border-slate-700 shadow-2xl grid grid-cols-5 gap-1.5">
                    {YAHOO_EMOTICONS.map((emo) => (
                      <button
                        key={emo.code}
                        type="button"
                        onClick={() => {
                          setInputText((prev) => `${prev}${prev ? ' ' : ''}${emo.code} `);
                          setShowEmoticons(false);
                        }}
                        className="flex flex-col items-center justify-center p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                      >
                        <span className="text-base leading-none">{emo.emoji}</span>
                        <span className="font-mono text-[9px] text-slate-400 mt-1">{emo.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Input Bar */}
              <div className="p-2.5 bg-[#11131D] border-t border-slate-800 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder={
                    chatMode === 'private'
                      ? activeDmPeer
                        ? `Nhắn riêng cho ${activeDmPeer.nickname}...`
                        : 'Chọn thành viên để nhắn riêng...'
                      : `Nhắn vào ${room.name}...`
                  }
                  disabled={chatMode === 'private' && !activeDmPeer}
                  className="flex-1 h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSendChat}
                  disabled={chatMode === 'private' && !activeDmPeer}
                  className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
