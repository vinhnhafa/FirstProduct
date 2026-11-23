import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Mic,
  MicOff,
  Lock,
  Unlock,
  Users,
  Heart,
  Gift,
  Plus,
  Copy,
  LogOut,
  Volume2,
  VolumeX,
  Send,
  Play,
  Pause,
  Music2,
  ShoppingBag,
  Sparkles,
  Crown,
  Headphones,
  FileEdit,
  Hand,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { LiveRoomDetail, LiveRoomSummary, Song, WeeklyGifterEntry } from '../types/karaoke';
import { extractYouTubeId, formatTime } from '../utils/vietnamese';
import { WsListener } from '../hooks/useRealtimeSocket';
import { HeartLeaderboardCard } from './HeartLeaderboardCard';

interface LiveRoomViewProps {
  userId: string;
  userName: string;
  songs: Song[];
  blockedYoutubeIds: Set<string>;
  initialSongForCreate: Song | null;
  heartsBalance: number;
  rooms: LiveRoomSummary[];
  heartLeaderboard: WeeklyGifterEntry[];
  connected: boolean;
  sendEvent: (type: string, payload?: Record<string, unknown>) => void;
  subscribe: (listener: WsListener) => () => void;
  onOpenHeartStore: () => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
  onReportBrokenVideo: (youtubeId: string, title: string) => void;
  onClearInitialCreateSong: () => void;
}

interface FloatingHeart {
  id: string;
  x: number;
  label?: string;
}

const GIFT_TIERS = [
  { id: 'heart_1', label: '1 Tim', cost: 1, icon: Heart },
  { id: 'rose_5', label: 'Hoa Hồng', cost: 5, icon: Sparkles },
  { id: 'crown_20', label: 'Vương Miện', cost: 20, icon: Crown },
  { id: 'fireworks_50', label: 'Pháo Hoa', cost: 50, icon: Gift },
];

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function LiveRoomView({
  userId,
  userName,
  songs,
  blockedYoutubeIds,
  initialSongForCreate,
  heartsBalance,
  rooms,
  heartLeaderboard,
  connected,
  sendEvent,
  subscribe,
  onOpenHeartStore,
  onToast,
  onReportBrokenVideo,
  onClearInitialCreateSong,
}: LiveRoomViewProps) {
  const [activeRoom, setActiveRoom] = useState<LiveRoomDetail | null>(null);
  const activeRoomRef = useRef<LiveRoomDetail | null>(null);
  const [createName, setCreateName] = useState('');
  const [createPasscode, setCreatePasscode] = useState('');
  const [createSongId, setCreateSongId] = useState(songs[0]?.id || 'song-1');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinPasscodeInput, setJoinPasscodeInput] = useState('');
  const [pendingLockedRoomId, setPendingLockedRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [roomSideTab, setRoomSideTab] = useState<'room' | 'leaderboard'>('room');

  // Room Chat & In-room YouTube Karaoke Search
  const [roomChatInput, setRoomChatInput] = useState('');
  const [songPickerInput, setSongPickerInput] = useState('');
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [ytRoomSearchResults, setYtRoomSearchResults] = useState<Song[]>([]);
  const [isSearchingRoomYt, setIsSearchingRoomYt] = useState(false);

  // Custom / Different Lyrics Stage ("lời khác" sync for group)
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState('');

  // Floating Hearts & Gift Banner
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [giftBanner, setGiftBanner] = useState<{
    fromName: string;
    giftLabel: string;
    hearts: number;
  } | null>(null);

  // WebRTC Mic Broadcaster with Karaoke Echo + Listener Audio
  const [isMicOn, setIsMicOn] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [echoAmount, setEchoAmount] = useState(35); // 0..70%
  const [micGainLevel, setMicGainLevel] = useState(110); // 50..160%
  const [loopbackOn, setLoopbackOn] = useState(false);
  const [listenerMicVolume, setListenerMicVolume] = useState(90);
  const [listenerMicMuted, setListenerMicMuted] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);

  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const echoFeedbackNodeRef = useRef<GainNode | null>(null);
  const echoWetNodeRef = useRef<GainNode | null>(null);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const loopbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Room YouTube Player
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<{
    loadVideoById: (id: string) => void;
    playVideo: () => void;
    pauseVideo: () => void;
    seekTo: (s: number, allow?: boolean) => void;
    getCurrentTime: () => number;
    destroy: () => void;
  } | null>(null);
  const ytReadyRef = useRef(false);
  const currentYtIdRef = useRef<string>('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    if (initialSongForCreate) {
      setCreateSongId(initialSongForCreate.id);
      setCreateName(`Phòng hát ${initialSongForCreate.title}`);
    }
  }, [initialSongForCreate]);

  const spawnFloatingHeart = useCallback((label?: string) => {
    const id = `fh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 15 + Math.random() * 70;
    setFloatingHearts((prev) => [...prev.slice(-18), { id, x, label }]);
    window.setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 2200);
  }, []);

  const stopAllRtc = useCallback(() => {
    for (const pc of peersRef.current.values()) {
      try {
        pc.close();
      } catch {
        // Ignore
      }
    }
    peersRef.current.clear();
    setHasRemoteAudio(false);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const stopLocalMic = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (rawMicStreamRef.current) {
      for (const track of rawMicStreamRef.current.getTracks()) {
        track.stop();
      }
      rawMicStreamRef.current = null;
    }
    processedStreamRef.current = null;
    micGainNodeRef.current = null;
    echoFeedbackNodeRef.current = null;
    echoWetNodeRef.current = null;
    if (loopbackAudioRef.current) {
      loopbackAudioRef.current.srcObject = null;
    }
    setIsMicOn(false);
    setMicLevel(0);
    setLoopbackOn(false);
  }, []);

  // Update live Echo & Gain nodes dynamically while singing
  useEffect(() => {
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = micGainLevel / 100;
    }
  }, [micGainLevel]);

  useEffect(() => {
    const ratio = echoAmount / 100;
    if (echoWetNodeRef.current) {
      echoWetNodeRef.current.gain.value = ratio * 0.75;
    }
    if (echoFeedbackNodeRef.current) {
      echoFeedbackNodeRef.current.gain.value = Math.min(0.48, ratio * 0.55);
    }
  }, [echoAmount]);

  const createOfferToPeer = useCallback(
    async (targetId: string) => {
      const stream = processedStreamRef.current || rawMicStreamRef.current;
      if (!stream) return;

      const existing = peersRef.current.get(targetId);
      if (existing) existing.close();

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current.set(targetId, pc);

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendEvent('rtc:ice', { targetId, candidate: event.candidate.toJSON() });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendEvent('rtc:offer', { targetId, sdp: offer });
    },
    [sendEvent]
  );

  // Subscribe to WebSocket room & WebRTC events
  useEffect(() => {
    const unsub = subscribe((type, payload) => {
      if (type === 'ws:reconnected') {
        if (activeRoomRef.current) {
          sendEvent('room:join', { roomId: activeRoomRef.current.id });
        }
        return;
      }
      if (type === 'room:joined' || type === 'room:state') {
        const room = payload.room as LiveRoomDetail | undefined;
        if (!room) return;
        setActiveRoom(room);
        setPendingLockedRoomId(null);

        // If I was replaced as singer while mic was on, cleanly stop mic
        if (room.singerId !== userId && rawMicStreamRef.current) {
          stopLocalMic();
          stopAllRtc();
        }

        // If I'm the active singer with live mic, connect WebRTC to any new listeners
        if (room.singerId === userId && (processedStreamRef.current || rawMicStreamRef.current)) {
          for (const member of room.members) {
            if (member.userId !== userId && !peersRef.current.has(member.userId)) {
              createOfferToPeer(member.userId).catch(() => {});
            }
          }
        }
      } else if (type === 'room:singer_selected') {
        const selectedId = String(payload.singerId || '');
        const selectedName = String(payload.singerName || '');
        if (selectedId === userId) {
          onToast('Chủ phòng đã chọn bạn lên hát! Hãy bấm "Bật Mic Phát Trực Tiếp" để hát.', 'success');
        } else {
          onToast(`Chủ phòng vừa chọn ${selectedName} làm ca sĩ tiếp theo.`, 'info');
        }
      } else if (type === 'room:song_synced') {
        const song = payload.currentSong as Song | undefined;
        const customLyrics = Array.isArray(payload.customLyrics)
          ? (payload.customLyrics as string[])
          : undefined;
        const activeLyricLine =
          typeof payload.activeLyricLine === 'number' ? payload.activeLyricLine : 0;
        const isPlaying = Boolean(payload.isPlaying);
        const positionSeconds = Number(payload.positionSeconds || 0);

        setActiveRoom((prev) =>
          prev && song
            ? {
                ...prev,
                currentSong: song,
                customLyrics: customLyrics ?? prev.customLyrics,
                activeLyricLine,
                isPlaying,
                positionSeconds,
              }
            : prev
        );
        if (ytReadyRef.current && ytPlayerRef.current && song) {
          if (currentYtIdRef.current !== song.youtubeId) {
            currentYtIdRef.current = song.youtubeId;
            ytPlayerRef.current.loadVideoById(song.youtubeId);
          }
          if (Math.abs((ytPlayerRef.current.getCurrentTime?.() || 0) - positionSeconds) > 3) {
            ytPlayerRef.current.seekTo(positionSeconds, true);
          }
          if (isPlaying) ytPlayerRef.current.playVideo();
          else ytPlayerRef.current.pauseVideo();
        }
      } else if (type === 'room:lyrics_synced') {
        const customLyrics = Array.isArray(payload.customLyrics)
          ? (payload.customLyrics as string[])
          : [];
        const activeLyricLine = Number(payload.activeLyricLine || 0);
        setActiveRoom((prev) =>
          prev ? { ...prev, customLyrics, activeLyricLine } : prev
        );
      } else if (type === 'room:heart_burst') {
        const heartsTotal = Number(payload.heartsTotal || 0);
        setActiveRoom((prev) => (prev ? { ...prev, heartsTotal } : prev));
        spawnFloatingHeart();
      } else if (type === 'room:gift_received') {
        const fromName = String(payload.fromName || 'Khán giả');
        const giftLabel = String(payload.giftLabel || 'Tim');
        const hearts = Number(payload.hearts || 1);
        const heartsTotal = Number(payload.heartsTotal || 0);
        setActiveRoom((prev) => (prev ? { ...prev, heartsTotal } : prev));
        setGiftBanner({ fromName, giftLabel, hearts });
        for (let i = 0; i < Math.min(6, hearts); i++) {
          window.setTimeout(() => spawnFloatingHeart(`+${hearts}`), i * 110);
        }
        window.setTimeout(() => setGiftBanner(null), 4000);
      } else if (type === 'room:error') {
        onToast(String(payload.error || 'Có lỗi xảy ra trong phòng hát.'), 'warning');
      } else if (type === 'rtc:offer') {
        const fromId = String(payload.fromId || '');
        const sdp = payload.sdp as RTCSessionDescriptionInit | undefined;
        if (!fromId || !sdp) return;

        (async () => {
          const existing = peersRef.current.get(fromId);
          if (existing) existing.close();

          const pc = new RTCPeerConnection(ICE_SERVERS);
          peersRef.current.set(fromId, pc);

          pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            if (remoteStream && remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
              remoteAudioRef.current.play().catch(() => {});
              setHasRemoteAudio(true);
            }
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              sendEvent('rtc:ice', { targetId: fromId, candidate: event.candidate.toJSON() });
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendEvent('rtc:answer', { targetId: fromId, sdp: answer });
        })().catch(() => {});
      } else if (type === 'rtc:answer') {
        const fromId = String(payload.fromId || '');
        const sdp = payload.sdp as RTCSessionDescriptionInit | undefined;
        const pc = peersRef.current.get(fromId);
        if (pc && sdp) {
          pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {});
        }
      } else if (type === 'rtc:ice') {
        const fromId = String(payload.fromId || '');
        const candidate = payload.candidate as RTCIceCandidateInit | undefined;
        const pc = peersRef.current.get(fromId);
        if (pc && candidate) {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
      }
    });

    return unsub;
  }, [
    subscribe,
    userId,
    sendEvent,
    createOfferToPeer,
    spawnFloatingHeart,
    onToast,
    stopLocalMic,
    stopAllRtc,
  ]);

  // Initialize room YouTube player when entering a room
  useEffect(() => {
    if (!activeRoom || !ytHostRef.current) return;
    let mounted = true;
    const initialYtId = activeRoom.currentSong.youtubeId;
    currentYtIdRef.current = initialYtId;

    const setupPlayer = () => {
      if (!mounted || !ytHostRef.current || !window.YT?.Player) return;
      const target = document.createElement('div');
      target.className = 'w-full h-full';
      ytHostRef.current.innerHTML = '';
      ytHostRef.current.appendChild(target);

      ytPlayerRef.current = new window.YT.Player(target, {
        videoId: initialYtId,
        playerVars: {
          autoplay: activeRoom.isPlaying ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            if (!mounted) return;
            ytReadyRef.current = true;
            if (activeRoom.isPlaying) e.target.playVideo();
          },
          onError: () => {
            if (!mounted) return;
            const brokenId = currentYtIdRef.current;
            const brokenTitle = activeRoomRef.current?.currentSong.title || '';
            if (brokenId) {
              onReportBrokenVideo(brokenId, brokenTitle);
            }
          },
        },
      }) as unknown as typeof ytPlayerRef.current;
    };

    if (window.YT?.Player) {
      setupPlayer();
    } else {
      const prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCb?.();
        setupPlayer();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        document.head.appendChild(s);
      }
    }

    return () => {
      mounted = false;
      ytReadyRef.current = false;
      try {
        ytPlayerRef.current?.destroy();
      } catch {
        // Ignore
      }
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.id]);

  // Keyless YouTube Karaoke search inside the Room Song Picker
  useEffect(() => {
    const trimmed = songPickerInput.trim();
    const ytId = extractYouTubeId(trimmed);
    if (!showSongPicker || ytId || trimmed.length < 2) {
      setYtRoomSearchResults([]);
      setIsSearchingRoomYt(false);
      return;
    }

    let active = true;
    setIsSearchingRoomYt(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}&karaokeOnly=true`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: Song[] }) => {
          if (active) setYtRoomSearchResults(Array.isArray(d.items) ? d.items : []);
        })
        .catch(() => {
          if (active) setYtRoomSearchResults([]);
        })
        .finally(() => {
          if (active) setIsSearchingRoomYt(false);
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [songPickerInput, showSongPicker]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = listenerMicMuted ? 0 : listenerMicVolume / 100;
    }
  }, [listenerMicVolume, listenerMicMuted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeRoom?.chat.length]);

  useEffect(() => {
    return () => {
      stopLocalMic();
      stopAllRtc();
    };
  }, [stopLocalMic, stopAllRtc]);

  // HTTP fallback sync if inside a room while WebSocket is temporarily reconnecting
  useEffect(() => {
    if (!activeRoom?.id || connected) return;
    const roomId = activeRoom.id;
    const interval = window.setInterval(() => {
      fetch(`/api/rooms/${encodeURIComponent(roomId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { room?: LiveRoomDetail } | null) => {
          if (d?.room) setActiveRoom(d.room);
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(interval);
  }, [activeRoom?.id, connected]);

  const handleJoinRoom = async (roomIdOrCode: string, passcode = '') => {
    const target = roomIdOrCode.trim();
    if (!target || isJoiningRoom) return;
    setIsJoiningRoom(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(target)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName,
          passcode,
        }),
      });
      const data = (await res.json()) as { room?: LiveRoomDetail; error?: string };
      if (!res.ok || !data.room) {
        onToast(data.error || 'Không vào được phòng hát.', 'warning');
        return;
      }
      setActiveRoom(data.room);
      setPendingLockedRoomId(null);
      setJoinCodeInput('');
      setJoinPasscodeInput('');
      sendEvent('room:join', { roomId: data.room.id, passcode });
      onToast(`Đã vào phòng "${data.room.name}"!`, 'success');
    } catch {
      sendEvent('room:join', { roomId: target, passcode });
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCreateRoom = async () => {
    const cleanName = createName.trim() || `Phòng của ${userName}`;
    const passcodeUsed = createPasscode.trim();
    setIsCreating(true);
    try {
      const pickedSong =
        initialSongForCreate && initialSongForCreate.id === createSongId
          ? initialSongForCreate
          : songs.find((s) => s.id === createSongId) || songs[0];

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          hostId: userId,
          hostName: userName,
          passcode: passcodeUsed,
          song: pickedSong,
        }),
      });
      const data = (await res.json()) as { room?: LiveRoomSummary; error?: string };
      if (!res.ok || !data.room) {
        onToast(data.error || 'Không tạo được phòng hát.', 'warning');
        return;
      }

      onClearInitialCreateSong();
      setCreateName('');
      setCreatePasscode('');
      await handleJoinRoom(data.room.id, passcodeUsed);
      onToast(`Đã mở phòng "${data.room.name}" (Mã: ${data.room.code})`, 'success');
    } catch {
      onToast('Lỗi kết nối khi tạo phòng.', 'warning');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLeaveRoom = () => {
    stopLocalMic();
    stopAllRtc();
    sendEvent('room:leave');
    setActiveRoom(null);
  };

  const handleClaimMic = () => {
    sendEvent('room:claim_mic', { isMicLive: isMicOn });
    onToast('Bạn đã lên sân khấu cầm Mic!', 'success');
  };

  const handleReleaseMic = () => {
    stopLocalMic();
    stopAllRtc();
    sendEvent('room:release_mic');
    onToast('Bạn đã trả Mic về phòng.', 'info');
  };

  const handleToggleBroadcastMic = async () => {
    if (!activeRoom) return;
    if (isMicOn) {
      stopLocalMic();
      stopAllRtc();
      sendEvent('room:mic_status', { isMicLive: false });
      onToast('Đã tắt phát âm thanh Mic.', 'info');
      return;
    }

    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      rawMicStreamRef.current = rawStream;

      // Build Karaoke Vocal Processing Chain (Mic Gain + Warm Echo Delay) -> WebRTC Stream
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(rawStream);
      const micGain = ctx.createGain();
      micGain.gain.value = micGainLevel / 100;
      micGainNodeRef.current = micGain;

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.18;

      const feedback = ctx.createGain();
      feedback.gain.value = Math.min(0.48, (echoAmount / 100) * 0.55);
      echoFeedbackNodeRef.current = feedback;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 2400;

      const wetGain = ctx.createGain();
      wetGain.gain.value = (echoAmount / 100) * 0.75;
      echoWetNodeRef.current = wetGain;

      const destination = ctx.createMediaStreamDestination();

      source.connect(micGain);
      // Dry path
      micGain.connect(destination);
      // Echo wet path
      micGain.connect(delay);
      delay.connect(lowpass);
      lowpass.connect(feedback);
      feedback.connect(delay);
      lowpass.connect(wetGain);
      wetGain.connect(destination);

      processedStreamRef.current = destination.stream;

      // Live VU meter
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      micGain.connect(analyser);

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
        const avg = sum / dataArr.length;
        setMicLevel(Math.min(100, Math.round((avg / 110) * 100)));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      setIsMicOn(true);

      if (activeRoom.singerId !== userId) {
        sendEvent('room:claim_mic', { isMicLive: true });
      } else {
        sendEvent('room:mic_status', { isMicLive: true });
      }

      for (const member of activeRoom.members) {
        if (member.userId !== userId) {
          createOfferToPeer(member.userId).catch(() => {});
        }
      }

      onToast(
        'Mic Karaoke (kèm Echo) đang phát trực tiếp! Mọi người trong nhóm đều nghe được giọng hát của bạn.',
        'success'
      );
    } catch {
      onToast('Trình duyệt chưa cấp quyền Microphone hoặc không tìm thấy thiết bị Mic.', 'warning');
    }
  };

  const handleToggleLoopback = () => {
    const stream = processedStreamRef.current || rawMicStreamRef.current;
    if (!stream || !loopbackAudioRef.current) return;
    if (loopbackOn) {
      loopbackAudioRef.current.srcObject = null;
      setLoopbackOn(false);
    } else {
      loopbackAudioRef.current.srcObject = stream;
      loopbackAudioRef.current.play().catch(() => {});
      setLoopbackOn(true);
      onToast('Đang nghe thử giọng Echo (khuyên dùng tai nghe để tránh hú mic).', 'info');
    }
  };

  const handleSyncSong = (song: Song, isPlaying: boolean, positionSeconds = 0) => {
    if (!activeRoom) return;
    currentYtIdRef.current = song.youtubeId;
    if (ytReadyRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(song.youtubeId);
      if (isPlaying) ytPlayerRef.current.playVideo();
      else ytPlayerRef.current.pauseVideo();
    }
    setActiveRoom((prev) =>
      prev
        ? {
            ...prev,
            currentSong: song,
            customLyrics: song.lyrics || [],
            activeLyricLine: 0,
            isPlaying,
            positionSeconds,
          }
        : prev
    );
    sendEvent('room:sync_song', { song, isPlaying, positionSeconds });
    setShowSongPicker(false);
    setSongPickerInput('');
  };

  const handleToggleRoomPlayback = (play: boolean) => {
    if (!activeRoom) return;
    const pos = ytPlayerRef.current?.getCurrentTime?.() || 0;
    if (ytReadyRef.current && ytPlayerRef.current) {
      if (play) ytPlayerRef.current.playVideo();
      else ytPlayerRef.current.pauseVideo();
    }
    setActiveRoom((prev) => (prev ? { ...prev, isPlaying: play, positionSeconds: pos } : prev));
    sendEvent('room:sync_song', {
      song: activeRoom.currentSong,
      isPlaying: play,
      positionSeconds: pos,
    });
  };

  const handleApplyCustomLyrics = () => {
    if (!activeRoom) return;
    const lines = lyricsDraft
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    setActiveRoom((prev) =>
      prev ? { ...prev, customLyrics: lines, activeLyricLine: 0 } : prev
    );
    sendEvent('room:sync_lyrics', { lyrics: lines, activeLyricLine: 0 });
    setIsEditingLyrics(false);
    onToast('Đã đồng bộ lời bài hát mới cho cả phòng!', 'success');
  };

  const handleSelectLyricLine = (idx: number) => {
    if (!activeRoom) return;
    const clamped = Math.max(0, Math.min(activeRoom.customLyrics.length - 1, idx));
    setActiveRoom((prev) => (prev ? { ...prev, activeLyricLine: clamped } : prev));
    sendEvent('room:sync_lyrics', {
      lyrics: activeRoom.customLyrics,
      activeLyricLine: clamped,
    });
  };

  const handleSendRoomChat = () => {
    const clean = roomChatInput.trim();
    if (!clean) return;
    sendEvent('room:chat', { text: clean });
    setRoomChatInput('');
  };

  const handleSendGift = (giftId: string, cost: number) => {
    if (heartsBalance < cost) {
      onToast(`Bạn chỉ còn ${heartsBalance} Tim, cần ${cost} Tim. Hãy Mua thêm Tim nhé!`, 'warning');
      onOpenHeartStore();
      return;
    }
    sendEvent('room:gift', { giftId });
  };

  // --- VIEW 1: ROOM LOBBY ---
  if (!activeRoom) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl bg-[#111520] border border-slate-800/90 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-50">
                  Mở Phòng Hát Riêng (Nhạc YouTube + Mic Echo Live)
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Chủ phòng chọn thành viên lên hát, truyền giọng kèm hiệu ứng vang Karaoke & lời hát đồng bộ tới cả nhóm.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 shrink-0">
                {connected ? 'Live Server Ready' : 'Đang kết nối...'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Tên phòng hát</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={`VD: Phòng hát của ${userName}`}
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Mật khẩu phòng riêng (tùy chọn)
                </label>
                <input
                  type="password"
                  value={createPasscode}
                  onChange={(e) => setCreatePasscode(e.target.value)}
                  placeholder="Để trống nếu mở công khai..."
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Chọn bài hát mở màn</label>
              <select
                value={createSongId}
                onChange={(e) => setCreateSongId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {initialSongForCreate && (
                  <option value={initialSongForCreate.id}>
                    {initialSongForCreate.title} — {initialSongForCreate.artist}
                  </option>
                )}
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {s.artist} ({s.genre})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? 'Đang tạo phòng...' : 'Tạo Phòng & Vào Hát Ngay'}</span>
            </button>
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-[#111520] border border-slate-800/90 p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <h2 className="font-display text-lg font-bold text-slate-100">
                Vào Nhanh Bằng Mã Phòng
              </h2>
              <p className="text-xs text-slate-400">
                Nhập mã phòng 6 ký tự (VD: BOLERO, VPOP99) để vào nghe nhóm hát và tặng tim.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="Nhập mã phòng..."
                  className="flex-1 h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 font-mono text-sm text-slate-100 uppercase placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => joinCodeInput.trim() && handleJoinRoom(joinCodeInput.trim())}
                  className="px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  Vào phòng
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Ví Tim của bạn</p>
                <p className="font-mono text-xl font-bold text-rose-400 tabular-nums flex items-center gap-1.5 mt-0.5">
                  <Heart className="w-5 h-5 fill-rose-500" />
                  <span>{heartsBalance} Tim</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenHeartStore}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Mua thêm Tim</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-slate-50">
            Danh Sách Phòng Hát Đang Mở ({rooms.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="rounded-2xl bg-[#111520] border border-slate-800/90 p-4 flex flex-col justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400 font-semibold">
                      <Radio className="w-3.5 h-3.5" />
                      Mã: {room.code}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      {room.hasPasscode ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Riêng tư</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Công khai</span>
                        </>
                      )}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-slate-100 truncate">
                    {room.name}
                  </h3>

                  <p className="text-xs text-slate-400 truncate">
                    Bài đang phát: <span className="text-slate-200">{room.currentSong.title}</span>
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {room.singerName ? (
                      <span className="text-emerald-400 font-medium">
                        Đang hát: {room.singerName} {room.isMicLive ? '(Mic đang bật)' : ''}
                      </span>
                    ) : (
                      <span>Chưa có ca sĩ cầm Mic — Vào hát ngay!</span>
                    )}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {room.memberCount}
                    </span>
                    <span className="inline-flex items-center gap-1 text-rose-400">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      {room.heartsTotal}
                    </span>
                  </div>

                  {pendingLockedRoomId === room.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="password"
                        value={joinPasscodeInput}
                        onChange={(e) => setJoinPasscodeInput(e.target.value)}
                        placeholder="Mật khẩu..."
                        className="w-24 h-8 px-2 rounded bg-slate-900 border border-amber-500 text-xs text-slate-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleJoinRoom(room.id, joinPasscodeInput)}
                        className="px-3 h-8 rounded bg-amber-500 text-slate-950 font-semibold text-xs cursor-pointer"
                      >
                        Vào
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (room.hasPasscode) {
                          setPendingLockedRoomId(room.id);
                          setJoinPasscodeInput('');
                        } else {
                          handleJoinRoom(room.id);
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Vào phòng hát
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <HeartLeaderboardCard
          entries={heartLeaderboard}
          currentUserId={userId}
          currentUserName={userName}
          onOpenHeartStore={onOpenHeartStore}
        />
      </div>
    );
  }

  // --- VIEW 2: INSIDE LIVE SINGING ROOM ---
  const isSinger = activeRoom.singerId === userId;
  const isHost = activeRoom.hostId === userId;
  const canControlPlayback = isSinger || isHost || !activeRoom.singerId;
  const hasRequestedMic = activeRoom.singerRequests?.includes(userId);

  const sortedMembers = [...activeRoom.members].sort((a, b) => {
    const aReq = activeRoom.singerRequests?.includes(a.userId) ? 1 : 0;
    const bReq = activeRoom.singerRequests?.includes(b.userId) ? 1 : 0;
    if (aReq !== bReq) return bReq - aReq;
    return b.heartsReceived + b.heartsGiven - (a.heartsReceived + a.heartsGiven);
  });

  const detectedPickYtId = extractYouTubeId(songPickerInput);
  const localFilteredPick = songs.filter(
    (s) =>
      !blockedYoutubeIds.has(s.youtubeId) &&
      s.isKaraoke !== false &&
      (s.title.toLowerCase().includes(songPickerInput.toLowerCase()) ||
        s.artist.toLowerCase().includes(songPickerInput.toLowerCase()))
  );
  const combinedRoomPick = [...localFilteredPick];
  const seenRoomPick = new Set(localFilteredPick.map((s) => s.youtubeId));
  for (const yt of ytRoomSearchResults) {
    if (blockedYoutubeIds.has(yt.youtubeId) || yt.isKaraoke === false) continue;
    if (!seenRoomPick.has(yt.youtubeId)) {
      seenRoomPick.add(yt.youtubeId);
      combinedRoomPick.push(yt);
    }
  }

  const displayLyrics =
    activeRoom.customLyrics && activeRoom.customLyrics.length > 0
      ? activeRoom.customLyrics
      : activeRoom.currentSong.lyrics || [];

  return (
    <div className="space-y-4">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <audio ref={loopbackAudioRef} muted={false} className="hidden" />

      {/* Top Room Header */}
      <div className="rounded-2xl bg-[#111520] border border-slate-800/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <Radio className="w-3.5 h-3.5" />
            <span>Phòng hát Live</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-bold">Mã: {activeRoom.code}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(activeRoom.code).catch(() => {});
                onToast(`Đã sao chép mã phòng: ${activeRoom.code}`, 'success');
              }}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
              title="Sao chép mã phòng"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-50 truncate">
            {activeRoom.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono tabular-nums flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-slate-200">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              {activeRoom.members.length} trong phòng
            </span>
            <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
              <Heart className="w-3.5 h-3.5 fill-rose-500" />
              {activeRoom.heartsTotal} Tim
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenHeartStore}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-semibold cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5 fill-rose-500" />
            <span className="font-mono tabular-nums">{heartsBalance}</span>
            <span>· Mua Tim</span>
          </button>

          <button
            type="button"
            onClick={handleLeaveRoom}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/25 hover:text-rose-300 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời phòng</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Room Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Synced YouTube Stage + Live Mic + Custom Lyrics + Gift Bar */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
            <div ref={ytHostRef} className="w-full h-full" />

            {giftBanner && (
              <div className="absolute top-4 left-4 right-4 sm:right-auto z-20 pointer-events-none">
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600/95 to-amber-500/95 text-white shadow-xl text-xs sm:text-sm font-bold">
                  <Gift className="w-4 h-4 shrink-0" />
                  <span>
                    {giftBanner.fromName} vừa tặng {giftBanner.giftLabel} (+{giftBanner.hearts} Tim)!
                  </span>
                </div>
              </div>
            )}

            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
              {floatingHearts.map((fh) => (
                <div
                  key={fh.id}
                  style={{ left: `${fh.x}%` }}
                  className="absolute bottom-4 animate-bounce flex flex-col items-center text-rose-500 drop-shadow-lg"
                >
                  <Heart className="w-7 h-7 fill-rose-500" />
                  {fh.label && (
                    <span className="text-[11px] font-bold text-amber-300">{fh.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Singer Mic Broadcast (with Karaoke Echo) & Playback Sync */}
          <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">
                  Nhạc YouTube đang mở:{' '}
                  <span className="text-slate-100 font-semibold">
                    {activeRoom.currentSong.title}
                  </span>{' '}
                  — {activeRoom.currentSong.artist}
                </p>
                <p className="text-xs mt-1">
                  {activeRoom.singerName ? (
                    <span className="text-emerald-400 font-semibold">
                      Ca sĩ được chọn: {activeRoom.singerName}{' '}
                      {activeRoom.isMicLive ? '· Mic Echo đang phát trực tiếp' : '· Mic chưa bật'}
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Chủ phòng có thể chọn thành viên lên hát hoặc bạn tự bấm &ldquo;Nhận Mic để Hát&rdquo;!
                    </span>
                  )}
                </p>
              </div>

              {canControlPlayback && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleRoomPlayback(!activeRoom.isPlaying)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer"
                  >
                    {activeRoom.isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Tạm dừng phòng</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Phát đồng bộ</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSongPicker((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs cursor-pointer"
                  >
                    <Music2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Đổi nhạc YouTube</span>
                  </button>
                </div>
              )}
            </div>

            {showSongPicker && (
              <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Tìm nhạc Karaoke trực tiếp trên YouTube (không cần API) hoặc dán link:</span>
                  {isSearchingRoomYt && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                </div>
                <input
                  type="text"
                  value={songPickerInput}
                  onChange={(e) => setSongPickerInput(e.target.value)}
                  placeholder="Nhập tên bài hát Karaoke hoặc dán link YouTube..."
                  className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
                {detectedPickYtId ? (
                  <button
                    type="button"
                    onClick={async () => {
                      let title = `Video YouTube (${detectedPickYtId})`;
                      let artist = 'Nguồn YouTube';
                      try {
                        const r = await fetch(`/api/youtube/oembed?id=${detectedPickYtId}`);
                        if (r.ok) {
                          const d = (await r.json()) as { title?: string; artist?: string };
                          if (d.title) title = d.title;
                          if (d.artist) artist = d.artist;
                        }
                      } catch {
                        // Fallback
                      }
                      handleSyncSong(
                        {
                          id: `yt-${detectedPickYtId}`,
                          youtubeId: detectedPickYtId,
                          title,
                          artist,
                          genre: 'Nhạc Trẻ',
                          durationSeconds: 240,
                          isKaraoke: true,
                          lyrics: [],
                        },
                        true,
                        0
                      );
                    }}
                    className="w-full py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs cursor-pointer"
                  >
                    Phát ngay Video YouTube ID: {detectedPickYtId}
                  </button>
                ) : (
                  <div className="max-h-44 overflow-y-auto custom-scrollbar divide-y divide-slate-800">
                    {combinedRoomPick.slice(0, 12).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSyncSong(s, true, 0)}
                        className="w-full py-2 px-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2 text-xs cursor-pointer"
                      >
                        <span className="font-medium text-slate-100 truncate">{s.title}</span>
                        <span className="text-slate-400 shrink-0">
                          {s.artist} · {formatTime(s.durationSeconds)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mic & Echo Controls + Listener Audio Controls */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isSinger && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        sendEvent('room:request_mic');
                        onToast('Đã gửi yêu cầu xin hát tới Chủ phòng!', 'info');
                      }}
                      disabled={hasRequestedMic}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 border border-amber-500/35 text-amber-300 font-semibold text-xs cursor-pointer"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      <span>{hasRequestedMic ? 'Đã đăng ký hát' : 'Đăng ký xin hát'}</span>
                    </button>

                    {(!activeRoom.singerId || isHost) && (
                      <button
                        type="button"
                        onClick={handleClaimMic}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Nhận Mic để Hát</span>
                      </button>
                    )}
                  </>
                )}

                {isSinger && (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleBroadcastMic}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                        isMicOn
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isMicOn ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>{isMicOn ? 'Tắt Mic Phát Live' : 'Bật Mic Phát Trực Tiếp'}</span>
                    </button>

                    {isMicOn && (
                      <>
                        <button
                          type="button"
                          onClick={handleToggleLoopback}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer ${
                            loopbackOn
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          <Headphones className="w-3.5 h-3.5" />
                          <span>{loopbackOn ? 'Đang nghe thử' : 'Nghe thử giọng'}</span>
                        </button>

                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[11px] text-emerald-400 font-medium">Mic</span>
                          <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 transition-all duration-75"
                              style={{ width: `${micLevel}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={handleReleaseMic}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Trả Mic
                    </button>
                  </>
                )}
              </div>

              {!isSinger && (
                <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setListenerMicMuted((v) => !v)}
                    className="text-slate-300 hover:text-amber-400 cursor-pointer"
                    aria-label="Tắt/Bật tiếng ca sĩ"
                  >
                    {listenerMicMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                  <span className="text-xs text-slate-300 whitespace-nowrap">
                    {hasRemoteAudio ? 'Đang nghe Ca sĩ (Live)' : 'Âm lượng Ca sĩ'}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={listenerMicMuted ? 0 : listenerMicVolume}
                    onChange={(e) => {
                      setListenerMicVolume(Number(e.target.value));
                      if (listenerMicMuted) setListenerMicMuted(false);
                    }}
                    className="karaoke-range w-20"
                  />
                </div>
              )}
            </div>

            {/* Karaoke Vocal Echo & Gain Sliders for Chosen Singer */}
            {isSinger && isMicOn && (
              <div className="pt-2 border-t border-slate-800/70 flex flex-wrap items-center gap-5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Độ vang Echo:</span>
                  <input
                    type="range"
                    min={0}
                    max={70}
                    value={echoAmount}
                    onChange={(e) => setEchoAmount(Number(e.target.value))}
                    className="karaoke-range w-24"
                  />
                  <span className="font-mono text-amber-300 tabular-nums">{echoAmount}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Độ lớn giọng hát:</span>
                  <input
                    type="range"
                    min={60}
                    max={160}
                    value={micGainLevel}
                    onChange={(e) => setMicGainLevel(Number(e.target.value))}
                    className="karaoke-range w-24"
                  />
                  <span className="font-mono text-emerald-300 tabular-nums">{micGainLevel}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Live Synced Custom / Different Lyrics Stage ("Lời bài hát / Lời khác của Ca sĩ") */}
          <div className="rounded-2xl bg-[#111520] border border-slate-800/90 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Lời bài hát hiển thị cho cả nhóm
                </span>
                <span className="text-[11px] text-slate-400">
                  (Hát lời gốc hoặc lời chế kèm nhạc YouTube)
                </span>
              </div>

              {canControlPlayback && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectLyricLine((activeRoom.activeLyricLine || 0) - 1)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title="Dòng trước"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLyricLine((activeRoom.activeLyricLine || 0) + 1)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title="Dòng tiếp theo"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLyricsDraft(displayLyrics.join('\n'));
                      setIsEditingLyrics((v) => !v);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-semibold cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>{isEditingLyrics ? 'Đóng' : 'Nhập / Đổi lời khác'}</span>
                  </button>
                </div>
              )}
            </div>

            {isEditingLyrics ? (
              <div className="p-4 space-y-3 bg-slate-950/60">
                <p className="text-xs text-slate-400">
                  Dán hoặc gõ lời bài hát mới (mỗi dòng 1 câu) — cả nhóm sẽ nhìn thấy lời này chạy cùng nhạc YouTube:
                </p>
                <textarea
                  value={lyricsDraft}
                  onChange={(e) => setLyricsDraft(e.target.value)}
                  rows={6}
                  placeholder="Nhập từng câu hát mỗi dòng..."
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingLyrics(false)}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomLyrics}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Đồng bộ lời cho cả phòng
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto custom-scrollbar p-4 text-center space-y-2">
                {displayLyrics.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">
                    Chưa có lời riêng — Ca sĩ có thể bấm &ldquo;Nhập / Đổi lời khác&rdquo; hoặc hát theo chữ trên màn hình YouTube.
                  </p>
                ) : (
                  displayLyrics.map((line, idx) => {
                    const isActive = idx === (activeRoom.activeLyricLine || 0);
                    return (
                      <p
                        key={`room-lyric-${idx}`}
                        onClick={() => canControlPlayback && handleSelectLyricLine(idx)}
                        className={`text-base sm:text-lg px-3 py-1 rounded-lg transition-all ${
                          canControlPlayback ? 'cursor-pointer' : ''
                        } ${
                          isActive
                            ? 'text-amber-400 font-bold bg-amber-500/10 scale-[1.01]'
                            : 'text-slate-300'
                        }`}
                      >
                        {line}
                      </p>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Hearts & Gift Interaction Bar */}
          <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                sendEvent('room:heart');
                spawnFloatingHeart();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span>Cho Tim (Miễn phí)</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">Tặng Tim:</span>
              {GIFT_TIERS.map((tier) => {
                const Icon = tier.icon;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => handleSendGift(tier.id, tier.cost)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/50 text-xs font-semibold text-slate-100 transition-colors cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 text-rose-400" />
                    <span>{tier.label}</span>
                    <span className="font-mono text-amber-300 tabular-nums">({tier.cost})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Group Members + Live Room Chat OR Weekly Heart Leaderboard */}
        <div className="lg:col-span-4 rounded-2xl bg-[#111520] border border-slate-800/90 flex flex-col h-[700px] overflow-hidden">
          <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-900/70 shrink-0">
            <button
              type="button"
              onClick={() => setRoomSideTab('room')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                roomSideTab === 'room'
                  ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Thành viên & Chat ({activeRoom.members.length})
            </button>
            <button
              type="button"
              onClick={() => setRoomSideTab('leaderboard')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                roomSideTab === 'leaderboard'
                  ? 'border-rose-500 text-rose-300 bg-rose-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              BXH Tặng Tim Tuần
            </button>
          </div>

          {roomSideTab === 'leaderboard' ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              <HeartLeaderboardCard
                entries={heartLeaderboard}
                currentUserId={userId}
                currentUserName={userName}
                compact
                onOpenHeartStore={onOpenHeartStore}
              />
            </div>
          ) : (
            <>
              <div className="p-3.5 border-b border-slate-800 bg-slate-900/50 space-y-2 max-h-60 overflow-y-auto custom-scrollbar shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">
                Thành viên nhóm ({activeRoom.members.length})
              </p>
              {isHost && (
                <span className="text-[11px] text-amber-300">Bạn là Chủ phòng</span>
              )}
            </div>

            <div className="space-y-1.5">
              {sortedMembers.map((m) => {
                const isActiveSinger = activeRoom.singerId === m.userId;
                const requested = activeRoom.singerRequests?.includes(m.userId);
                return (
                  <div
                    key={m.userId}
                    className={`flex items-center justify-between gap-2 text-xs px-2.5 py-2 rounded-lg border ${
                      isActiveSinger
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-slate-900/80 border-slate-800/80'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isActiveSinger && (
                          <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-100 truncate">
                          {m.name} {m.userId === userId ? '(Bạn)' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        {m.isHost && <span className="text-amber-300">Chủ phòng</span>}
                        {requested && <span className="text-sky-400 font-semibold">Xin lên hát</span>}
                        {m.heartsReceived > 0 && (
                          <span className="font-mono text-rose-400 tabular-nums">
                            Nhận {m.heartsReceived} Tim
                          </span>
                        )}
                      </div>
                    </div>

                    {isHost && !isActiveSinger && (
                      <button
                        type="button"
                        onClick={() => sendEvent('room:select_singer', { targetUserId: m.userId })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] shrink-0 cursor-pointer"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Chọn hát</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-2 text-xs">
            {activeRoom.chat.map((c) => (
              <div
                key={c.id}
                className={`leading-relaxed break-words ${
                  c.giftInfo
                    ? 'p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200'
                    : ''
                }`}
              >
                <span className="font-mono text-[10px] text-slate-500 mr-1.5 tabular-nums">
                  [{c.timestamp}]
                </span>
                <span
                  className={`font-semibold mr-1 ${
                    c.senderId === 'system' ? 'text-amber-400' : 'text-sky-300'
                  }`}
                >
                  {c.senderName}:
                </span>
                <span className="text-slate-200">{c.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-2.5 border-t border-slate-800 bg-slate-900/60 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={roomChatInput}
              onChange={(e) => setRoomChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendRoomChat()}
              placeholder="Nhắn cổ vũ ca sĩ trong phòng..."
              className="flex-1 h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={handleSendRoomChat}
              className="px-3 h-9 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi</span>
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
