import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send,
  Smile,
  BellRing,
  Users,
  Bold,
  Italic,
  Music,
  Edit3,
  Check,
  MessageSquare,
  MapPin,
  Lock,
  MessageCircle,
  Search,
  ChevronDown,
  X,
  Globe,
} from 'lucide-react';
import {
  ChatMessage,
  ChatRoomId,
  OnlineChatMember,
  PrivateChatMessage,
  Song,
} from '../types/karaoke';
import {
  ChatRoomGroup,
  getVietnamChatRoom,
  VIETNAM_CHAT_ROOMS,
} from '../../shared/vietnamChatRooms';
import { playBuzzSound, removeVietnameseTones } from '../utils/vietnamese';
import { WsListener } from '../hooks/useRealtimeSocket';

interface YahooChatProps {
  userId: string;
  nickname: string;
  onNicknameChange: (nextNick: string) => void;
  currentSong: Song;
  incomingSharedSong: { song: Song; seq: number } | null;
  connected: boolean;
  sendEvent: (type: string, payload?: Record<string, unknown>) => void;
  subscribe: (listener: WsListener) => () => void;
  onPlaySharedSong: (youtubeId: string, title: string, artist: string) => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

const STORAGE_YM_ROOM_KEY = 'karaoke_ym_room_v1';

const PINNED_ROOM_IDS = [
  'nhac-tre',
  'bolero',
  'game-thu',
  'tinh-ha-noi',
  'tinh-tp-hcm',
  'tinh-da-nang',
  'tinh-can-tho',
];

const ROOM_GROUPS: ChatRoomGroup[] = [
  'Chủ đề chung',
  'Miền Bắc',
  'Miền Trung & Tây Nguyên',
  'Miền Nam',
];

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

function getInitialRoomId(): ChatRoomId {
  try {
    const saved = localStorage.getItem(STORAGE_YM_ROOM_KEY);
    if (saved && VIETNAM_CHAT_ROOMS.some((r) => r.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage error
  }
  return 'nhac-tre';
}

export function YahooChat({
  userId,
  nickname,
  onNicknameChange,
  currentSong,
  incomingSharedSong,
  connected,
  sendEvent,
  subscribe,
  onPlaySharedSong,
  onToast,
}: YahooChatProps) {
  const [chatMode, setChatMode] = useState<'public' | 'private'>('public');
  const [activeRoom, setActiveRoom] = useState<ChatRoomId>(getInitialRoomId);
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [selectedRegionTab, setSelectedRegionTab] = useState<ChatRoomGroup | 'Tất cả'>('Tất cả');

  const [isEditingNick, setIsEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(nickname);

  // Public Room State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomUsers, setRoomUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [onlineDirectory, setOnlineDirectory] = useState<OnlineChatMember[]>([]);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [rosterTab, setRosterTab] = useState<'room' | 'all'>('room');

  // Private 1-1 Chat State
  const [activeDmPeer, setActiveDmPeer] = useState<{ id: string; nickname: string } | null>(null);
  const [dmThreads, setDmThreads] = useState<Record<string, PrivateChatMessage[]>>({});
  const [dmPeerNames, setDmPeerNames] = useState<Record<string, string>>({});
  const [unreadByPeer, setUnreadByPeer] = useState<Record<string, number>>({});

  // Composer State
  const [inputText, setInputText] = useState('');
  const [textColor, setTextColor] = useState('#F8FAFC');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [showEmoticons, setShowEmoticons] = useState(false);
  const [showMembersMobile, setShowMembersMobile] = useState(false);
  const [isBuzzing, setIsBuzzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSharedSeqRef = useRef<number>(0);
  const chatModeRef = useRef(chatMode);
  const activeDmPeerIdRef = useRef<string | null>(activeDmPeer?.id ?? null);

  chatModeRef.current = chatMode;
  activeDmPeerIdRef.current = activeDmPeer?.id ?? null;

  const triggerBuzzVisual = useCallback(() => {
    setIsBuzzing(true);
    playBuzzSound();
    window.setTimeout(() => setIsBuzzing(false), 500);
  }, []);

  // Persist chosen province / topic room
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_YM_ROOM_KEY, activeRoom);
    } catch {
      // Ignore
    }
  }, [activeRoom]);

  // Join public room on mount or room switch
  useEffect(() => {
    if (connected) {
      sendEvent('ym:join', { roomId: activeRoom, nickname });
    }
  }, [activeRoom, connected, nickname, sendEvent]);

  // Subscribe to real-time WebSocket public & private Yahoo events
  useEffect(() => {
    const unsub = subscribe((type, payload) => {
      if (type === 'ym:history') {
        const roomId = String(payload.roomId || '');
        if (roomId === activeRoom) {
          setMessages((payload.messages as ChatMessage[]) || []);
        }
      } else if (type === 'ym:presence') {
        const roomId = String(payload.roomId || '');
        if (roomId === activeRoom) {
          setRoomUsers((payload.users as Array<{ id: string; nickname: string }>) || []);
        }
      } else if (type === 'ym:directory') {
        if (Array.isArray(payload.onlineUsers)) {
          setOnlineDirectory(payload.onlineUsers as OnlineChatMember[]);
        }
        if (payload.roomCounts && typeof payload.roomCounts === 'object') {
          setRoomCounts(payload.roomCounts as Record<string, number>);
        }
      } else if (type === 'ym:message') {
        const msg = payload.message as ChatMessage | undefined;
        if (msg && msg.roomId === activeRoom) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      } else if (type === 'ym:buzz') {
        const msg = payload.message as ChatMessage | undefined;
        if (msg && msg.roomId === activeRoom) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          triggerBuzzVisual();
        }
      } else if (type === 'ym:dm_sync') {
        const threads = payload.threads as
          | Array<{ peerId: string; peerName: string; messages: PrivateChatMessage[] }>
          | undefined;
        if (Array.isArray(threads)) {
          const nextThreads: Record<string, PrivateChatMessage[]> = {};
          const nextNames: Record<string, string> = {};
          for (const th of threads) {
            nextThreads[th.peerId] = th.messages;
            nextNames[th.peerId] = th.peerName;
          }
          setDmThreads((prev) => ({ ...prev, ...nextThreads }));
          setDmPeerNames((prev) => ({ ...prev, ...nextNames }));
        }
      } else if (type === 'ym:dm_thread') {
        const peerId = String(payload.peerId || '');
        const list = (payload.messages as PrivateChatMessage[]) || [];
        if (peerId) {
          setDmThreads((prev) => ({ ...prev, [peerId]: list }));
        }
      } else if (type === 'ym:dm_message' || type === 'ym:dm_buzz') {
        const dmMsg = payload.message as PrivateChatMessage | undefined;
        if (!dmMsg) return;
        const isIncoming = dmMsg.fromUserId !== userId;
        const peerId = isIncoming ? dmMsg.fromUserId : dmMsg.toUserId;
        const peerName = isIncoming ? dmMsg.fromName : dmMsg.toName;

        setDmPeerNames((prev) => ({ ...prev, [peerId]: peerName }));
        setDmThreads((prev) => {
          const existing = prev[peerId] || [];
          if (existing.some((m) => m.id === dmMsg.id)) return prev;
          return { ...prev, [peerId]: [...existing, dmMsg] };
        });

        if (isIncoming) {
          const isViewingThisThread =
            chatModeRef.current === 'private' && activeDmPeerIdRef.current === peerId;
          if (!isViewingThisThread) {
            setUnreadByPeer((prev) => ({ ...prev, [peerId]: (prev[peerId] || 0) + 1 }));
            onToast(
              type === 'ym:dm_buzz'
                ? `${peerName} vừa gửi BUZZ! riêng cho bạn!`
                : `Tin nhắn riêng mới từ ${peerName}`,
              type === 'ym:dm_buzz' ? 'warning' : 'info'
            );
          }
          if (type === 'ym:dm_buzz') {
            triggerBuzzVisual();
          }
        }
      }
    });
    return unsub;
  }, [activeRoom, userId, subscribe, triggerBuzzVisual, onToast]);

  const activeDmMessages = useMemo(
    () => (activeDmPeer ? dmThreads[activeDmPeer.id] || [] : []),
    [activeDmPeer, dmThreads]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, activeDmMessages.length, activeRoom, chatMode, activeDmPeer?.id]);

  // Handle incoming song shared from KaraokePlayer
  useEffect(() => {
    if (!incomingSharedSong || incomingSharedSong.seq === lastSharedSeqRef.current) return;
    lastSharedSeqRef.current = incomingSharedSong.seq;
    const { song } = incomingSharedSong;
    sendEvent('ym:send', {
      roomId: activeRoom,
      message: {
        id: `share-${Date.now()}`,
        roomId: activeRoom,
        sender: nickname,
        text: `Mời cả phòng cùng hát bài "${song.title}" nhé! :D`,
        timestamp: nowTimeStr(),
        color: '#FBBF24',
        isBold: true,
        sharedSong: {
          title: song.title,
          artist: song.artist,
          youtubeId: song.youtubeId,
        },
      },
    });
  }, [incomingSharedSong, activeRoom, nickname, sendEvent]);

  const openPrivateChat = useCallback(
    (peer: { id: string; nickname: string }) => {
      if (!peer.id || peer.id === userId) return;
      setActiveDmPeer(peer);
      setChatMode('private');
      setShowMembersMobile(false);
      setUnreadByPeer((prev) => {
        if (!prev[peer.id]) return prev;
        const copy = { ...prev };
        delete copy[peer.id];
        return copy;
      });
      setDmPeerNames((prev) => ({ ...prev, [peer.id]: peer.nickname }));
      if (connected) {
        sendEvent('ym:dm_history', { peerId: peer.id });
      }
    },
    [userId, connected, sendEvent]
  );

  const handleSendMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (chatMode === 'private') {
      if (!activeDmPeer) {
        onToast('Hãy chọn một thành viên online để chat riêng.', 'info');
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

    const msg: ChatMessage = {
      id: `ym-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomId: activeRoom,
      sender: nickname,
      text: trimmed,
      timestamp: nowTimeStr(),
      color: textColor,
      isBold,
      isItalic,
    };

    sendEvent('ym:send', { roomId: activeRoom, message: msg });
    setInputText('');
    setShowEmoticons(false);
  };

  const handleBuzz = () => {
    triggerBuzzVisual();
    if (chatMode === 'private') {
      if (!activeDmPeer) {
        onToast('Hãy chọn người nhận để gửi BUZZ! riêng.', 'info');
        return;
      }
      sendEvent('ym:dm_buzz', {
        toUserId: activeDmPeer.id,
        toName: activeDmPeer.nickname,
      });
      onToast(`Đã gửi BUZZ! riêng cho ${activeDmPeer.nickname}!`, 'warning');
      return;
    }
    sendEvent('ym:buzz', { roomId: activeRoom, nickname });
    onToast('Bạn vừa gửi BUZZ! rung phòng chat!', 'warning');
  };

  const handleShareCurrentSong = () => {
    if (chatMode === 'private') {
      if (!activeDmPeer) {
        onToast('Hãy chọn một người bạn để gửi bài hát riêng.', 'info');
        return;
      }
      sendEvent('ym:dm_send', {
        toUserId: activeDmPeer.id,
        toName: activeDmPeer.nickname,
        message: {
          id: `dm-share-${Date.now()}`,
          text: `Mời bạn nghe & hát cùng mình bài "${currentSong.title}" nhé!`,
          color: '#FBBF24',
          isBold: true,
          sharedSong: {
            title: currentSong.title,
            artist: currentSong.artist,
            youtubeId: currentSong.youtubeId,
          },
        },
      });
      return;
    }

    sendEvent('ym:send', {
      roomId: activeRoom,
      message: {
        id: `share-${Date.now()}`,
        roomId: activeRoom,
        sender: nickname,
        text: `Đang nghe bài "${currentSong.title}" cùng mọi người nè!`,
        timestamp: nowTimeStr(),
        color: '#FBBF24',
        sharedSong: {
          title: currentSong.title,
          artist: currentSong.artist,
          youtubeId: currentSong.youtubeId,
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

  const activeRoomObj = getVietnamChatRoom(activeRoom);

  const totalUnreadPrivate = useMemo(
    () => Object.values(unreadByPeer).reduce((acc, n) => acc + n, 0),
    [unreadByPeer]
  );

  // Quick room pills (include active room if it's a non-pinned province)
  const quickRooms = useMemo(() => {
    const list = PINNED_ROOM_IDS.map((id) => getVietnamChatRoom(id));
    if (!PINNED_ROOM_IDS.includes(activeRoom)) {
      list.unshift(activeRoomObj);
    }
    return list;
  }, [activeRoom, activeRoomObj]);

  // Searchable 63 provinces + topic rooms for picker
  const filteredDirectoryRooms = useMemo(() => {
    const q = removeVietnameseTones(provinceSearch);
    return VIETNAM_CHAT_ROOMS.filter((room) => {
      if (selectedRegionTab !== 'Tất cả' && room.group !== selectedRegionTab) return false;
      if (!q) return true;
      return removeVietnameseTones(`${room.name} ${room.shortName} ${room.group}`).includes(q);
    });
  }, [provinceSearch, selectedRegionTab]);

  // Combined peer list for Chat Riêng (existing threads + all online members)
  const dmPeerList = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        nickname: string;
        isOnline: boolean;
        roomName?: string;
        lastMessage?: string;
        unread: number;
      }
    >();

    for (const u of onlineDirectory) {
      if (u.id === userId) continue;
      map.set(u.id, {
        id: u.id,
        nickname: u.nickname,
        isOnline: true,
        roomName: u.roomName,
        unread: unreadByPeer[u.id] || 0,
      });
    }

    for (const [peerId, msgs] of Object.entries(dmThreads)) {
      if (peerId === userId) continue;
      const existing = map.get(peerId);
      const last = msgs[msgs.length - 1];
      const fallbackName = dmPeerNames[peerId] || existing?.nickname || 'Thành viên';
      map.set(peerId, {
        id: peerId,
        nickname: existing?.nickname || fallbackName,
        isOnline: Boolean(existing?.isOnline),
        roomName: existing?.roomName,
        lastMessage: last ? (last.isBuzz ? 'BUZZ!!!' : last.text) : undefined,
        unread: unreadByPeer[peerId] || 0,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.unread !== a.unread) return b.unread - a.unread;
      if (Boolean(b.lastMessage) !== Boolean(a.lastMessage)) {
        return b.lastMessage ? 1 : -1;
      }
      if (b.isOnline !== a.isOnline) return b.isOnline ? 1 : -1;
      return a.nickname.localeCompare(b.nickname, 'vi');
    });
  }, [onlineDirectory, dmThreads, dmPeerNames, unreadByPeer, userId]);

  const otherOnlineInRoom = roomUsers;
  const totalOnlineAllRooms = Math.max(1, onlineDirectory.length);

  return (
    <div
      id="lounge-section"
      className={`rounded-2xl overflow-hidden border border-purple-500/35 bg-[#12131C] shadow-2xl flex flex-col h-[640px] relative ${
        isBuzzing ? 'animate-buzz' : ''
      }`}
    >
      {/* Classic Yahoo! Messenger Purple Title Bar */}
      <div className="bg-gradient-to-r from-[#581C87] via-[#6B21A8] to-[#4C1D95] px-3.5 py-2.5 flex items-center justify-between gap-2.5 border-b border-purple-400/25 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
            Y!
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-bold text-white truncate">
              {chatMode === 'public'
                ? `Yahoo! Chat Chung — ${activeRoomObj.name}`
                : activeDmPeer
                  ? `Chat Riêng — ${activeDmPeer.nickname}`
                  : 'Yahoo! Chat Riêng 1-1'}
            </h2>
            <p className="text-[11px] text-purple-200/80 truncate">
              {chatMode === 'public'
                ? activeRoomObj.topic
                : activeDmPeer
                  ? 'Cuộc trò chuyện riêng tư chỉ hai người nhìn thấy'
                  : 'Chọn thành viên đang online để nhắn tin riêng tư 1-1'}
            </p>
          </div>
        </div>

        {/* Mode Switcher: Chat Chung vs Chat Riêng */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center p-0.5 rounded-lg bg-purple-950/70 border border-purple-400/30">
            <button
              type="button"
              onClick={() => {
                setChatMode('public');
                setShowMembersMobile(false);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                chatMode === 'public'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-purple-100 hover:bg-purple-800/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Chat chung</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setChatMode('private');
                setShowProvincePicker(false);
                if (activeDmPeer && unreadByPeer[activeDmPeer.id]) {
                  setUnreadByPeer((prev) => {
                    const next = { ...prev };
                    delete next[activeDmPeer.id];
                    return next;
                  });
                }
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                chatMode === 'private'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-purple-100 hover:bg-purple-800/60'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Chat riêng</span>
              {totalUnreadPrivate > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px] leading-tight tabular-nums">
                  {totalUnreadPrivate}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowMembersMobile((v) => !v)}
            className="sm:hidden inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-950/60 text-purple-100 text-xs font-medium border border-purple-400/30 shrink-0"
            aria-label="Hiện danh sách thành viên"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="tabular-nums">{totalOnlineAllRooms}</span>
          </button>
        </div>
      </div>

      {/* Room Switcher (63 Vietnam Provinces + Topic Rooms) & Nickname Bar */}
      <div className="bg-[#191B28] border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {chatMode === 'public' ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto custom-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setShowProvincePicker((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showProvincePicker
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
              }`}
              title="Chọn phòng theo 63 tỉnh thành Việt Nam"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>63 Tỉnh/Thành</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showProvincePicker ? 'rotate-180' : ''
                }`}
              />
            </button>

            {quickRooms.map((room) => {
              const count = roomCounts[room.id] || 0;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setActiveRoom(room.id);
                    setShowProvincePicker(false);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeRoom === room.id
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{room.shortName}</span>
                  {count > 0 && (
                    <span className="font-mono text-[10px] px-1 rounded bg-black/25 text-amber-300 tabular-nums">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {activeDmPeer
                ? `Đang chat riêng với ${activeDmPeer.nickname}`
                : 'Chọn người online bên phải (hoặc bấm danh sách bên trái) để nhắn riêng'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <span className="text-slate-400">Nick:</span>
          {isEditingNick ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
                maxLength={22}
                className="w-28 h-7 px-2 rounded bg-slate-900 border border-purple-500 text-xs text-slate-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveNickname}
                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                aria-label="Lưu nickname"
              >
                <Check className="w-3.5 h-3.5" />
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
              title="Bấm để đổi nickname"
            >
              <span>{nickname}</span>
              <Edit3 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Searchable 63 Vietnam Provinces Drawer Overlay */}
      {showProvincePicker && chatMode === 'public' && (
        <div className="absolute inset-x-3 top-28 bottom-3 z-30 rounded-xl bg-[#161927] border border-amber-500/40 shadow-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-900/80 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <MapPin className="w-4 h-4" />
                <span>Chọn Phòng Chat 63 Tỉnh/Thành Việt Nam &amp; Chủ Đề</span>
              </div>
              <button
                type="button"
                onClick={() => setShowProvincePicker(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Đóng danh sách tỉnh thành"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={provinceSearch}
                onChange={(e) => setProvinceSearch(e.target.value)}
                placeholder="Tìm nhanh tỉnh/thành (vd: Hà Nội, Đà Nẵng, Nghệ An, Cần Thơ)..."
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {(['Tất cả', ...ROOM_GROUPS] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setSelectedRegionTab(group)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    selectedRegionTab === group
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            {filteredDirectoryRooms.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                Không tìm thấy phòng tỉnh/thành phù hợp.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {filteredDirectoryRooms.map((room) => {
                  const isActive = room.id === activeRoom;
                  const count = roomCounts[room.id] || 0;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        setActiveRoom(room.id);
                        setShowProvincePicker(false);
                        setProvinceSearch('');
                      }}
                      className={`px-2.5 py-2 rounded-lg text-left border transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-purple-600/30 border-purple-400 text-white'
                          : 'bg-slate-900/70 border-slate-800 hover:border-amber-500/40 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{room.shortName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{room.group}</p>
                      </div>
                      {count > 0 && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 tabular-nums">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Peer List in Private Chat Mode */}
        {chatMode === 'private' && (
          <div className="w-44 sm:w-52 bg-[#141724] border-r border-slate-800 flex flex-col shrink-0">
            <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Hội thoại riêng</span>
              <span className="font-mono text-amber-400 tabular-nums">{dmPeerList.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
              {dmPeerList.length === 0 ? (
                <div className="p-3 text-center text-[11px] text-slate-400 leading-relaxed">
                  Chưa có người dùng khác online hoặc hội thoại nào. Khi có thành viên vào phòng, bạn có thể bấm để chat riêng 1-1!
                </div>
              ) : (
                dmPeerList.map((peer) => {
                  const selected = activeDmPeer?.id === peer.id;
                  return (
                    <button
                      key={peer.id}
                      type="button"
                      onClick={() => openPrivateChat({ id: peer.id, nickname: peer.nickname })}
                      className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-purple-600/30 border border-purple-400/50'
                          : 'hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              peer.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {peer.nickname}
                          </span>
                        </div>
                        {peer.unread > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[10px] leading-none tabular-nums">
                            {peer.unread}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 pl-3.5">
                        {peer.lastMessage || (peer.roomName ? `Phòng ${peer.roomName}` : 'Nhấn để nhắn riêng')}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Center Message Stream + Toolbar + Composer */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0D0F17]">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-2.5 text-sm">
            {chatMode === 'public' ? (
              messages.map((msg) => {
                const isMe = msg.sender === nickname || (msg.senderId && msg.senderId === userId);
                const canClickPrivate = Boolean(msg.senderId && msg.senderId !== userId);
                return (
                  <div key={msg.id} className="leading-relaxed break-words">
                    <span className="font-mono text-[11px] text-slate-500 mr-2 tabular-nums">
                      [{msg.timestamp}]
                    </span>
                    {canClickPrivate ? (
                      <button
                        type="button"
                        onClick={() =>
                          openPrivateChat({ id: msg.senderId!, nickname: msg.sender })
                        }
                        title={`Bấm để chat riêng với ${msg.sender}`}
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
                      <span className="inline-block font-extrabold text-rose-500 tracking-wide">
                        BUZZ!!! (Rung màn hình)
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
                      <div className="mt-1.5 ml-12 inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-amber-500/30">
                        <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-xs text-slate-200">
                          {msg.sharedSong.title} — {msg.sharedSong.artist}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onPlaySharedSong(
                              msg.sharedSong!.youtubeId,
                              msg.sharedSong!.title,
                              msg.sharedSong!.artist
                            )
                          }
                          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] cursor-pointer"
                        >
                          Hát ngay
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : !activeDmPeer ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                <div className="w-11 h-11 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <Lock className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-100">
                  Chọn một thành viên để Chat Riêng 1-1
                </p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Tin nhắn riêng và BUZZ! chỉ hiển thị giữa bạn và người được chọn, hoàn toàn tách biệt với phòng Chat chung.
                </p>
              </div>
            ) : activeDmMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                <MessageCircle className="w-8 h-8 text-purple-400/70" />
                <p className="text-xs text-slate-300">
                  Bắt đầu cuộc trò chuyện riêng với{' '}
                  <strong className="text-amber-300">{activeDmPeer.nickname}</strong>!
                </p>
              </div>
            ) : (
              activeDmMessages.map((msg) => {
                const isMe = msg.fromUserId === userId;
                return (
                  <div key={msg.id} className="leading-relaxed break-words">
                    <span className="font-mono text-[11px] text-slate-500 mr-2 tabular-nums">
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
                      <span className="inline-block font-extrabold text-rose-500 tracking-wide">
                        BUZZ!!! (Rung cửa sổ riêng)
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
                      <div className="mt-1.5 ml-12 inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-amber-500/30">
                        <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-xs text-slate-200">
                          {msg.sharedSong.title} — {msg.sharedSong.artist}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onPlaySharedSong(
                              msg.sharedSong!.youtubeId,
                              msg.sharedSong!.title,
                              msg.sharedSong!.artist
                            )
                          }
                          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] cursor-pointer"
                        >
                          Hát ngay
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formatting & BUZZ! Toolbar */}
          <div className="relative px-3 py-1.5 bg-[#151824] border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleBuzz}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/35 text-rose-400 border border-rose-500/40 font-extrabold text-xs tracking-wide transition-colors cursor-pointer"
                title="Gửi BUZZ! làm rung khung chat"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>BUZZ!</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEmoticons((v) => !v)}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  showEmoticons
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Chèn biểu tượng Yahoo!"
                aria-label="Chọn mặt cười Yahoo"
              >
                <Smile className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsBold((v) => !v)}
                className={`p-1.5 rounded text-xs cursor-pointer ${
                  isBold ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Chữ đậm"
                aria-label="Chữ đậm"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsItalic((v) => !v)}
                className={`p-1.5 rounded text-xs cursor-pointer ${
                  isItalic ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Chữ nghiêng"
                aria-label="Chữ nghiêng"
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
                    className={`w-3.5 h-3.5 rounded-sm transition-transform cursor-pointer ${
                      textColor === c ? 'ring-2 ring-white scale-110' : 'opacity-75 hover:opacity-100'
                    }`}
                    aria-label={`Chọn màu chữ ${c}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleShareCurrentSong}
              className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 font-medium cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Gửi bài đang hát</span>
            </button>

            {showEmoticons && (
              <div className="absolute bottom-11 left-3 z-20 p-2 rounded-xl bg-[#1A1D2D] border border-slate-700 shadow-2xl grid grid-cols-5 gap-1.5">
                {YAHOO_EMOTICONS.map((emo) => (
                  <button
                    key={emo.code}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => `${prev}${prev ? ' ' : ''}${emo.code} `);
                      setShowEmoticons(false);
                    }}
                    className="flex flex-col items-center justify-center p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title={`${emo.label} (${emo.code})`}
                  >
                    <span className="text-lg leading-none">{emo.emoji}</span>
                    <span className="font-mono text-[10px] text-slate-400 mt-1">{emo.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2.5 bg-[#11131D] border-t border-slate-800 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                chatMode === 'private'
                  ? activeDmPeer
                    ? `Nhắn riêng cho ${activeDmPeer.nickname} (thử :)), =)), <3)...`
                    : 'Chọn thành viên để bắt đầu chat riêng...'
                  : `Nhắn vào ${activeRoomObj.name} (thử :)), =)), <3)...`
              }
              disabled={chatMode === 'private' && !activeDmPeer}
              className="flex-1 h-9 px-3 rounded-lg bg-slate-900 border border-slate-700/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={chatMode === 'private' && !activeDmPeer}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi</span>
            </button>
          </div>
        </div>

        {/* Right Roster Sidebar (In Public Mode or Mobile Toggle): Trong phòng & Toàn quốc + Chat riêng */}
        {chatMode === 'public' && (
          <div
            className={`${
              showMembersMobile ? 'absolute inset-y-0 right-0 z-20 flex' : 'hidden sm:flex'
            } w-52 flex-col bg-[#141724] border-l border-slate-800 shrink-0`}
          >
            <div className="p-1.5 border-b border-slate-800 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setRosterTab('room')}
                className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  rosterTab === 'room'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Phòng ({Math.max(1, otherOnlineInRoom.length)})
              </button>
              <button
                type="button"
                onClick={() => setRosterTab('all')}
                className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  rosterTab === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Tất cả ({totalOnlineAllRooms})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
              {rosterTab === 'room' ? (
                otherOnlineInRoom.length === 0 ? (
                  <div className="px-2 py-1.5 rounded-md bg-purple-600/15 border border-purple-500/25">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" aria-hidden="true">
                        😊
                      </span>
                      <span className="text-xs font-bold text-amber-300 truncate">{nickname}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 pl-5">Bạn (Online)</p>
                  </div>
                ) : (
                  otherOnlineInRoom.map((member) => {
                    const isMe = member.id === userId;
                    const unread = unreadByPeer[member.id] || 0;
                    return (
                      <div
                        key={member.id}
                        className={`px-2 py-1.5 rounded-md flex items-center justify-between gap-1.5 ${
                          isMe
                            ? 'bg-purple-600/15 border border-purple-500/25'
                            : 'hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" aria-hidden="true">
                              {isMe ? '😊' : '🙂'}
                            </span>
                            <span
                              className={`text-xs truncate ${
                                isMe ? 'font-bold text-amber-300' : 'font-medium text-slate-200'
                              }`}
                            >
                              {member.nickname}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5 pl-5">
                            {isMe ? 'Bạn (Online)' : activeRoomObj.shortName}
                          </p>
                        </div>

                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => openPrivateChat(member)}
                            title={`Chat riêng với ${member.nickname}`}
                            className="p-1.5 rounded bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white transition-colors shrink-0 cursor-pointer relative"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {unread > 0 && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold">
                                {unread}
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })
                )
              ) : onlineDirectory.length === 0 ? (
                <div className="px-2 py-1.5 rounded-md bg-purple-600/15 border border-purple-500/25">
                  <span className="text-xs font-bold text-amber-300 truncate block">
                    {nickname}
                  </span>
                  <p className="text-[10px] text-slate-400">Bạn (Online)</p>
                </div>
              ) : (
                onlineDirectory.map((member) => {
                  const isMe = member.id === userId;
                  const unread = unreadByPeer[member.id] || 0;
                  return (
                    <div
                      key={member.id}
                      className={`px-2 py-1.5 rounded-md flex items-center justify-between gap-1.5 ${
                        isMe
                          ? 'bg-purple-600/15 border border-purple-500/25'
                          : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span
                            className={`text-xs truncate ${
                              isMe ? 'font-bold text-amber-300' : 'font-medium text-slate-200'
                            }`}
                          >
                            {member.nickname}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5 pl-3.5">
                          {member.roomName}
                        </p>
                      </div>

                      {!isMe && (
                        <button
                          type="button"
                          onClick={() => openPrivateChat({ id: member.id, nickname: member.nickname })}
                          title={`Chat riêng với ${member.nickname}`}
                          className="p-1.5 rounded bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white transition-colors shrink-0 cursor-pointer relative"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold">
                              {unread}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
