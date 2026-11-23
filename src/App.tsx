import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Spade, Grid3X3 } from 'lucide-react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, syncUserProfileToFirestore } from './lib/firebase';
import { KARAOKE_SONGS } from './data/songs';
import {
  AppView,
  GameRoomSummary,
  LiveRoomSummary,
  QueueItem,
  Song,
  ToastMessage,
  WeeklyGifterEntry,
} from './types/karaoke';
import {
  buildSongUrlPath,
  parseMediaUrlPath,
  parseStaticSeoView,
  updateDocumentSeo,
} from './utils/vietnamese';
import { useRealtimeSocket } from './hooks/useRealtimeSocket';
import { Header } from './components/Header';
import { KaraokePlayer } from './components/KaraokePlayer';
import { QueuePanel } from './components/QueuePanel';
import { BrowseCatalogPage } from './components/BrowseCatalogPage';
import { MusicListenPage } from './components/MusicListenPage';
import { LiveRoomView } from './components/LiveRoomView';
import { HeartStoreModal } from './components/HeartStoreModal';
import { AuthModal } from './components/AuthModal';
import { YahooChat } from './components/YahooChat';
import { TienLenGame } from './components/TienLenGame';
import { CaroGame } from './components/CaroGame';
import { SeoContentSection } from './components/SeoContentSection';
import { ToastContainer } from './components/ToastContainer';

const STORAGE_QUEUE_KEY = 'diepkhuc_queue_v1';
const STORAGE_CURRENT_KEY = 'diepkhuc_current_v1';
const STORAGE_UID_KEY = 'diepkhuc_user_id_v1';
const STORAGE_NICK_KEY = 'diepkhuc_ym_nick';
const STORAGE_BLOCKED_KEY = 'diepkhuc_blocked_yt_v1';

function getOrCreateUserId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_UID_KEY);
    if (existing) return existing;
    const next = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(STORAGE_UID_KEY, next);
    return next;
  } catch {
    return `u-${Math.random().toString(36).slice(2, 9)}`;
  }
}

function getInitialNickname(): string {
  try {
    return localStorage.getItem(STORAGE_NICK_KEY) || 'ca_si_online';
  } catch {
    return 'ca_si_online';
  }
}

function healSongFromCatalog(song: Song): Song {
  const fresh = KARAOKE_SONGS.find((s) => s.id === song.id);
  return fresh || song;
}

function loadInitialBlockedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_BLOCKED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // Ignore parse error
  }
  return [];
}

function loadInitialCurrentSong(): Song {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Song;
      if (parsed && parsed.youtubeId && parsed.title) {
        return healSongFromCatalog(parsed);
      }
    }
  } catch {
    // Ignore parse error
  }
  return KARAOKE_SONGS[0];
}

function loadInitialQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QueueItem[];
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          ...item,
          song: healSongFromCatalog(item.song),
        }));
      }
    }
  } catch {
    // Ignore parse error
  }
  return [
    { queueId: 'init-1', song: KARAOKE_SONGS[5], addedAt: Date.now() },
    { queueId: 'init-2', song: KARAOKE_SONGS[1], addedAt: Date.now() + 1 },
    { queueId: 'init-3', song: KARAOKE_SONGS[11], addedAt: Date.now() + 2 },
  ];
}

export default function App() {
  const initialRoute = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return parseMediaUrlPath(window.location.pathname);
  }, []);

  const initialStaticView = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return parseStaticSeoView(window.location.pathname);
  }, []);

  const initialMomoReturnParams = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('momoReturn') !== '1' || !sp.get('orderId') || !sp.get('signature')) {
      return null;
    }
    const obj: Record<string, string> = {};
    sp.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }, []);

  const [guestUserId] = useState<string>(getOrCreateUserId);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [nickname, setNickname] = useState<string>(getInitialNickname);
  const [activeView, setActiveView] = useState<AppView>(() => {
    if (initialRoute?.kind === 'mp3') return 'music';
    if (initialStaticView) return initialStaticView;
    return 'stage';
  });
  const [initialMp3YoutubeId] = useState<string | null>(() =>
    initialRoute?.kind === 'mp3' ? initialRoute.youtubeId : null
  );
  const [currentSong, setCurrentSong] = useState<Song>(() => {
    if (initialRoute?.kind === 'karaoke') {
      const found = KARAOKE_SONGS.find((s) => s.youtubeId === initialRoute.youtubeId);
      if (found) return found;
      return {
        id: `yt-${initialRoute.youtubeId}`,
        youtubeId: initialRoute.youtubeId,
        title: initialRoute.rawSlug.replace(/-/g, ' '),
        artist: 'Nguồn YouTube',
        genre: 'Nhạc Trẻ',
        durationSeconds: 240,
        isKaraoke: true,
        lyrics: ['Đang phát bài hát Karaoke trực tuyến.'],
      };
    }
    return loadInitialCurrentSong();
  });
  const [queue, setQueue] = useState<QueueItem[]>(loadInitialQueue);
  const [blockedIds, setBlockedIds] = useState<string[]>(loadInitialBlockedIds);
  const [isTvMode, setIsTvMode] = useState(false);
  const [activeGame, setActiveGame] = useState<'tien-len' | 'caro'>('tien-len');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sharedToChat, setSharedToChat] = useState<{ song: Song; seq: number } | null>(null);

  // Realtime Server State (Heart Wallet + Live Singing Rooms + Multiplayer Game Rooms + Leaderboard)
  const [heartsBalance, setHeartsBalance] = useState<number>(30);
  const [liveRooms, setLiveRooms] = useState<LiveRoomSummary[]>([]);
  const [gameRooms, setGameRooms] = useState<GameRoomSummary[]>([]);
  const [heartLeaderboard, setHeartLeaderboard] = useState<WeeklyGifterEntry[]>([]);
  const [isHeartStoreOpen, setIsHeartStoreOpen] = useState(false);
  const [roomCreateSong, setRoomCreateSong] = useState<Song | null>(null);

  const userId = firebaseUser?.uid || guestUserId;
  const effectiveNickname = useMemo(() => {
    if (firebaseUser) {
      if (nickname && nickname !== 'ca_si_online') return nickname;
      return (
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'Ca sĩ Online'
      ).slice(0, 28);
    }
    return nickname;
  }, [firebaseUser, nickname]);

  const queueRef = useRef<QueueItem[]>(queue);
  queueRef.current = queue;

  const { connected, sendEvent, subscribe } = useRealtimeSocket(userId, effectiveNickname);

  const blockedSet = useMemo(() => new Set(blockedIds), [blockedIds]);
  const visibleCatalog = useMemo(
    () => KARAOKE_SONGS.filter((s) => !blockedSet.has(s.youtubeId)),
    [blockedSet]
  );

  const addToast = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3400);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Observe Firebase Authentication state (Google / Email sign-in) & merge guest wallet
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        syncUserProfileToFirestore(user).catch(() => {});
        fetch('/api/wallet/merge-guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestUserId, authUserId: user.uid }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { heartsBalance?: number } | null) => {
            if (typeof d?.heartsBalance === 'number') {
              setHeartsBalance(d.heartsBalance);
            }
          })
          .catch(() => {});
      }
    });
    return () => unsubscribeAuth();
  }, [guestUserId]);

  // Verify signed MoMo return redirect query params once on mount
  const momoVerifiedRef = useRef(false);
  useEffect(() => {
    if (!initialMomoReturnParams || momoVerifiedRef.current) return;
    momoVerifiedRef.current = true;
    fetch('/api/momo/verify-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialMomoReturnParams),
    })
      .then(async (r) => ({ ok: r.ok, data: (await r.json()) as { heartsAdded?: number; heartsBalance?: number; error?: string } }))
      .then(({ ok, data }) => {
        if (ok && typeof data.heartsBalance === 'number') {
          setHeartsBalance(data.heartsBalance);
          addToast(
            `Thanh toán MoMo thành công! Đã cộng +${data.heartsAdded || 0} Tim vào ví.`,
            'success'
          );
        } else {
          addToast(data.error || 'Giao dịch MoMo chưa hoàn tất.', 'warning');
        }
      })
      .catch(() => {
        addToast('Không thể xác thực kết quả thanh toán MoMo.', 'warning');
      })
      .finally(() => {
        try {
          const cleanPath = buildSongUrlPath(currentSong.title, currentSong.youtubeId, 'karaoke');
          window.history.replaceState(null, '', cleanPath);
        } catch {
          // Ignore
        }
      });
  }, [initialMomoReturnParams, addToast, currentSong.title, currentSong.youtubeId]);

  // Load wallet, rooms & weekly leaderboard initially via REST and keep synced via WebSocket
  useEffect(() => {
    fetch(`/api/wallet/${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d: { heartsBalance?: number }) => {
        if (typeof d.heartsBalance === 'number') setHeartsBalance(d.heartsBalance);
      })
      .catch(() => {});

    fetch('/api/rooms')
      .then((r) => r.json())
      .then((d: { rooms?: LiveRoomSummary[] }) => {
        if (Array.isArray(d.rooms)) setLiveRooms(d.rooms);
      })
      .catch(() => {});

    fetch('/api/game-rooms')
      .then((r) => r.json())
      .then((d: { rooms?: GameRoomSummary[] }) => {
        if (Array.isArray(d.rooms)) setGameRooms(d.rooms);
      })
      .catch(() => {});

    fetch('/api/leaderboard/hearts')
      .then((r) => r.json())
      .then((d: { entries?: WeeklyGifterEntry[] }) => {
        if (Array.isArray(d.entries)) setHeartLeaderboard(d.entries);
      })
      .catch(() => {});

    fetch('/api/youtube/blocked')
      .then((r) => r.json())
      .then((d: { blockedIds?: string[] }) => {
        if (Array.isArray(d.blockedIds) && d.blockedIds.length > 0) {
          setBlockedIds((prev) => Array.from(new Set([...prev, ...d.blockedIds!])));
        }
      })
      .catch(() => {});

    if (
      initialRoute?.kind === 'karaoke' &&
      !KARAOKE_SONGS.some((s) => s.youtubeId === initialRoute.youtubeId)
    ) {
      fetch(`/api/youtube/oembed?id=${encodeURIComponent(initialRoute.youtubeId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { title?: string; artist?: string } | null) => {
          if (!d?.title) return;
          setCurrentSong((prev) =>
            prev.youtubeId === initialRoute.youtubeId
              ? {
                  ...prev,
                  title: d.title || prev.title,
                  artist: d.artist || prev.artist,
                }
              : prev
          );
        })
        .catch(() => {});
    }
  }, [userId, initialRoute]);

  useEffect(() => {
    return subscribe((type, payload) => {
      if (type === 'wallet:updated' && typeof payload.heartsBalance === 'number') {
        setHeartsBalance(payload.heartsBalance);
      } else if (type === 'rooms:list' && Array.isArray(payload.rooms)) {
        setLiveRooms(payload.rooms as LiveRoomSummary[]);
      } else if (type === 'game:list' && Array.isArray(payload.rooms)) {
        setGameRooms(payload.rooms as GameRoomSummary[]);
      } else if (type === 'leaderboard:hearts_updated' && Array.isArray(payload.entries)) {
        setHeartLeaderboard(payload.entries as WeeklyGifterEntry[]);
      }
    });
  }, [subscribe]);

  // Dynamic URL (song name before ID) and SEO metadata across views
  useEffect(() => {
    if (activeView === 'music' && !isTvMode) return;

    if (!isTvMode && activeView === 'browse') {
      updateDocumentSeo({
        title: 'Kho Nhạc Hát Karaoke Không Quảng Cáo | Karaoke Online',
        description:
          'Kho bài hát karaoke không quảng cáo pop-up: lọc sẵn Bolero, Nhạc Trẻ, Remix beat chuẩn YouTube, chạy trực tiếp trong trình duyệt điện thoại không nhảy app.',
        path: '/hat-karaoke-khong-quang-cao',
      });
      return;
    }

    if (!isTvMode && activeView === 'rooms') {
      updateDocumentSeo({
        title: 'Phòng Hát Karaoke Trực Tuyến Mic Live | Karaoke Online',
        description:
          'Vào phòng hát karaoke trực tuyến miễn phí, bật mic echo trộn cùng nhạc nền YouTube, tặng tim cổ vũ và hát karaoke không quảng cáo cùng bạn bè.',
        path: '/phong-hat-karaoke-truc-tuyen',
      });
      return;
    }

    if (!isTvMode && activeView === 'social') {
      updateDocumentSeo({
        title: 'Phòng Chat Yahoo & Sảnh Game Tiến Lên, Cờ Caro | Karaoke Online',
        description:
          'Vừa hát karaoke không quảng cáo vừa nghe nhạc YouTube MP3, chat phòng Yahoo hoài niệm và chơi Tiến Lên, Cờ Caro nhiều người chơi thực tế.',
        path: '/phong-chat-va-game',
      });
      return;
    }

    const cleanTitle = currentSong.title;
    const displayTitle = cleanTitle.toLowerCase().includes('karaoke')
      ? `${cleanTitle} — Hát Karaoke Không Quảng Cáo | Karaoke Online`
      : `${cleanTitle} Karaoke — Hát Karaoke Không Quảng Cáo | Karaoke Online`;
    const description = `Hát karaoke không quảng cáo bài ${cleanTitle} - ${currentSong.artist} (${currentSong.genre}). Beat chuẩn chữ chạy dễ hát ngay trong trình duyệt điện thoại, hỗ trợ phòng hát Live và nghe nhạc tắt màn hình.`;
    const path = buildSongUrlPath(cleanTitle, currentSong.youtubeId, 'karaoke');
    updateDocumentSeo({ title: displayTitle, description, path });
  }, [
    activeView,
    isTvMode,
    currentSong.title,
    currentSong.artist,
    currentSong.genre,
    currentSong.youtubeId,
  ]);

  // Persist queue, current song & nickname
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore
    }
  }, [queue]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CURRENT_KEY, JSON.stringify(currentSong));
    } catch {
      // Ignore
    }
  }, [currentSong]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BLOCKED_KEY, JSON.stringify(blockedIds));
    } catch {
      // Ignore
    }
  }, [blockedIds]);

  const handleNicknameChange = useCallback((nextNick: string) => {
    setNickname(nextNick);
    try {
      localStorage.setItem(STORAGE_NICK_KEY, nextNick);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isTvMode) {
        setIsTvMode(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isTvMode]);

  const handleToggleTvMode = useCallback(() => {
    setActiveView('stage');
    const next = !isTvMode;
    setIsTvMode(next);
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      addToast('Đã bật chế độ Toàn màn hình (TV Mode).', 'info');
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      addToast('Đã thoát chế độ TV Mode.', 'info');
    }
  }, [addToast, isTvMode]);

  const handlePlayNow = useCallback(
    (song: Song) => {
      setCurrentSong(song);
      setActiveView('stage');
      addToast(`Đang phát: ${song.title}`, 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [addToast]
  );

  const handleAddToQueue = useCallback(
    (song: Song) => {
      const newItem: QueueItem = {
        queueId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        song,
        addedAt: Date.now(),
      };
      setQueue((prev) => [...prev, newItem]);
      addToast(`Đã thêm "${song.title}" vào danh sách chờ.`, 'success');
    },
    [addToast]
  );

  const handlePrioritizeSong = useCallback(
    (song: Song) => {
      const newItem: QueueItem = {
        queueId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        song,
        addedAt: Date.now(),
      };
      setQueue((prev) => [newItem, ...prev]);
      addToast(`Đã ưu tiên "${song.title}" lên đầu hàng chờ!`, 'info');
    },
    [addToast]
  );

  const handlePrioritizeQueueItem = useCallback(
    (queueId: string) => {
      const current = queueRef.current;
      const idx = current.findIndex((item) => item.queueId === queueId);
      if (idx <= 0) return;
      const target = current[idx];
      setQueue((prev) => {
        const i = prev.findIndex((item) => item.queueId === queueId);
        if (i <= 0) return prev;
        return [prev[i], ...prev.slice(0, i), ...prev.slice(i + 1)];
      });
      addToast(`Đã đẩy "${target.song.title}" lên đầu hàng chờ.`, 'info');
    },
    [addToast]
  );

  const handleRemoveFromQueue = useCallback(
    (queueId: string) => {
      const target = queueRef.current.find((item) => item.queueId === queueId);
      setQueue((prev) => prev.filter((item) => item.queueId !== queueId));
      if (target) {
        addToast(`Đã xóa "${target.song.title}" khỏi danh sách.`, 'warning');
      }
    },
    [addToast]
  );

  const handleReorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleClearQueue = useCallback(() => {
    setQueue([]);
    addToast('Đã xóa toàn bộ danh sách chờ.', 'warning');
  }, [addToast]);

  const handleNextSong = useCallback(() => {
    const current = queueRef.current;
    if (current.length === 0) {
      addToast('Đã hết bài trong danh sách chờ.', 'info');
      return;
    }
    const [nextItem] = current;
    setQueue((prev) => prev.slice(1));
    setCurrentSong(nextItem.song);
    addToast(`Chuyển sang bài: ${nextItem.song.title}`, 'success');
  }, [addToast]);

  const handleShareToChat = useCallback(
    (song: Song) => {
      setSharedToChat((prev) => ({ song, seq: (prev?.seq ?? 0) + 1 }));
      setActiveView('social');
      addToast(`Đã gửi lời mời hát "${song.title}" vào phòng chat!`, 'success');
    },
    [addToast]
  );

  const handlePlaySharedFromChat = useCallback(
    (youtubeId: string, title: string, artist: string) => {
      const existing = KARAOKE_SONGS.find((s) => s.youtubeId === youtubeId);
      if (existing) {
        handlePlayNow(existing);
      } else {
        handlePlayNow({
          id: `shared-${youtubeId}-${Date.now()}`,
          youtubeId,
          title,
          artist,
          genre: 'Nhạc Trẻ',
          durationSeconds: 240,
          lyrics: ['Đang phát bài hát được chia sẻ từ phòng chat Yahoo!'],
        });
      }
    },
    [handlePlayNow]
  );

  const handleOpenRoomWithSong = useCallback((song: Song) => {
    setRoomCreateSong(song);
    setActiveView('rooms');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleReportBrokenVideo = useCallback(
    (youtubeId: string, title: string) => {
      if (!youtubeId) return;
      setBlockedIds((prev) => (prev.includes(youtubeId) ? prev : [...prev, youtubeId]));
      fetch('/api/youtube/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId }),
      }).catch(() => {});

      addToast(
        `Video "${title || youtubeId}" không cho phép nhúng hoặc bị lỗi, đã tự động ẩn.`,
        'warning'
      );

      const filtered = queueRef.current.filter((item) => item.song.youtubeId !== youtubeId);
      if (currentSong.youtubeId === youtubeId) {
        if (filtered.length > 0) {
          const [nextItem, ...rest] = filtered;
          setQueue(rest);
          setCurrentSong(nextItem.song);
          return;
        }
        setQueue(filtered);
        const fallback =
          KARAOKE_SONGS.find(
            (s) => s.youtubeId !== youtubeId && !blockedSet.has(s.youtubeId)
          ) || KARAOKE_SONGS[0];
        if (fallback && fallback.youtubeId !== youtubeId) {
          setCurrentSong(fallback);
        }
      } else {
        setQueue(filtered);
      }
    },
    [addToast, blockedSet, currentSong.youtubeId]
  );

  const handleSearchKaraokeFromMusic = useCallback(
    async (rawTitle: string) => {
      const cleanQuery = rawTitle.split(/[-|([♫]/)[0].trim() || rawTitle;
      addToast(`Đang tìm bản Karaoke cho "${cleanQuery}"...`, 'info');
      try {
        const res = await fetch(
          `/api/youtube/search?q=${encodeURIComponent(cleanQuery)}&karaokeOnly=true`
        );
        const data = (await res.json()) as { items?: Song[] };
        const found = Array.isArray(data.items)
          ? data.items.find((s) => !blockedSet.has(s.youtubeId))
          : undefined;
        if (found) {
          handlePlayNow(found);
          return;
        }
      } catch {
        // Fallback to browse view
      }
      setActiveView('browse');
      addToast('Hãy chọn bài hát Karaoke trong kho nhạc!', 'info');
    },
    [addToast, blockedSet, handlePlayNow]
  );

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 flex flex-col">
      <Header
        songs={visibleCatalog}
        blockedYoutubeIds={blockedSet}
        activeView={activeView}
        isTvMode={isTvMode}
        heartsBalance={heartsBalance}
        firebaseUser={firebaseUser}
        userDisplayName={effectiveNickname}
        onChangeView={setActiveView}
        onToggleTvMode={handleToggleTvMode}
        onOpenHeartStore={() => setIsHeartStoreOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onAddToQueue={handleAddToQueue}
        onPrioritizeSong={handlePrioritizeSong}
        onPlayNow={handlePlayNow}
      />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-8">
        {/* VIEW 1: Dedicated Browse & Filter All Karaoke Music Page */}
        {!isTvMode && activeView === 'browse' && (
          <BrowseCatalogPage
            songs={visibleCatalog}
            blockedYoutubeIds={blockedSet}
            currentSongId={currentSong.id}
            onListenAndSing={handlePlayNow}
            onAddToQueue={handleAddToQueue}
            onPrioritizeSong={handlePrioritizeSong}
            onOpenRoomWithSong={handleOpenRoomWithSong}
          />
        )}

        {/* VIEW 2: Main 70/30 Karaoke Stage (also shown in TV Mode) */}
        {(isTvMode || activeView === 'stage') && (
          <div
            className={`grid gap-6 items-start ${
              isTvMode
                ? 'grid-cols-1 max-w-6xl mx-auto'
                : 'grid-cols-1 lg:grid-cols-[65fr_35fr] xl:grid-cols-[68fr_32fr]'
            }`}
          >
            <KaraokePlayer
              currentSong={currentSong}
              hasNext={queue.length > 0}
              isTvMode={isTvMode}
              onSongEnded={handleNextSong}
              onNext={handleNextSong}
              onShareToChat={handleShareToChat}
              onReportBrokenVideo={handleReportBrokenVideo}
              onToast={addToast}
            />

            {!isTvMode && (
              <QueuePanel
                queue={queue}
                catalog={visibleCatalog}
                currentSongId={currentSong.id}
                onPlayNow={handlePlayNow}
                onAddToQueue={handleAddToQueue}
                onPrioritizeSong={handlePrioritizeSong}
                onPrioritizeQueueItem={handlePrioritizeQueueItem}
                onRemoveFromQueue={handleRemoveFromQueue}
                onReorderQueue={handleReorderQueue}
                onClearQueue={handleClearQueue}
              />
            )}
          </div>
        )}

        {/* VIEW 3: Dedicated YouTube Music Listening Page (All Genres, Hot & New, History) */}
        {!isTvMode && activeView === 'music' && (
          <MusicListenPage
            blockedYoutubeIds={blockedSet}
            initialYoutubeId={initialMp3YoutubeId}
            onReportBrokenVideo={handleReportBrokenVideo}
            onSearchKaraokeVersion={handleSearchKaraokeFromMusic}
            onToast={addToast}
          />
        )}

        {/* VIEW 4: Private Live Singing Rooms (YouTube + WebRTC Mic Audio + Hearts & Gifts) */}
        {!isTvMode && activeView === 'rooms' && (
          <LiveRoomView
            userId={userId}
            userName={effectiveNickname}
            songs={visibleCatalog}
            blockedYoutubeIds={blockedSet}
            initialSongForCreate={roomCreateSong}
            heartsBalance={heartsBalance}
            rooms={liveRooms}
            heartLeaderboard={heartLeaderboard}
            connected={connected}
            sendEvent={sendEvent}
            subscribe={subscribe}
            onOpenHeartStore={() => setIsHeartStoreOpen(true)}
            onToast={addToast}
            onReportBrokenVideo={handleReportBrokenVideo}
            onClearInitialCreateSong={() => setRoomCreateSong(null)}
          />
        )}

        {/* VIEW 4 (or shown below Stage): Yahoo! Messenger Chat Rooms & Games */}
        {!isTvMode && (activeView === 'social' || activeView === 'stage') && (
          <section className="pt-4 border-t border-slate-800/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-50">
                  Phòng Chat Yahoo & Sảnh Game Giải Trí
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Vừa nghêu ngao hát Karaoke vừa tám chuyện cùng bạn bè hoặc làm ván Tiến Lên, Cờ Caro
                </p>
              </div>

              <div
                id="games-section"
                className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800"
              >
                <button
                  type="button"
                  onClick={() => setActiveGame('tien-len')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeGame === 'tien-len'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Spade className="w-4 h-4" />
                  <span>Bài Tiến Lên</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGame('caro')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeGame === 'caro'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  <span>Cờ Caro</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-5">
                <YahooChat
                  userId={userId}
                  nickname={effectiveNickname}
                  onNicknameChange={handleNicknameChange}
                  currentSong={currentSong}
                  incomingSharedSong={sharedToChat}
                  connected={connected}
                  sendEvent={sendEvent}
                  subscribe={subscribe}
                  onPlaySharedSong={handlePlaySharedFromChat}
                  onToast={addToast}
                />
              </div>

              <div className="lg:col-span-7">
                {activeGame === 'tien-len' ? (
                  <TienLenGame
                    userId={userId}
                    userName={effectiveNickname}
                    rooms={gameRooms}
                    connected={connected}
                    sendEvent={sendEvent}
                    subscribe={subscribe}
                    onToast={addToast}
                  />
                ) : (
                  <CaroGame
                    userId={userId}
                    userName={effectiveNickname}
                    rooms={gameRooms}
                    connected={connected}
                    sendEvent={sendEvent}
                    subscribe={subscribe}
                    onToast={addToast}
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {!isTvMode && <SeoContentSection onNavigateView={setActiveView} />}
      </main>

      <footer className="border-t border-slate-800/70 py-5 px-4 sm:px-6 text-center text-xs text-slate-500">
        Karaoke Online · Hát Karaoke Không Quảng Cáo, Nghe Nhạc YouTube MP3 Không Quảng Cáo, Phòng Hát Mic Live &amp; Sảnh Game
      </footer>

      <HeartStoreModal
        isOpen={isHeartStoreOpen}
        userId={userId}
        heartsBalance={heartsBalance}
        subscribe={subscribe}
        onClose={() => setIsHeartStoreOpen(false)}
        onBalanceUpdated={setHeartsBalance}
        onToast={addToast}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        firebaseUser={firebaseUser}
        currentNickname={effectiveNickname}
        onClose={() => setIsAuthModalOpen(false)}
        onNicknameChange={handleNicknameChange}
        onToast={addToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
