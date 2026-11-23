import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Users,
  MapPin,
  Lock,
  MessageCircle,
  Search,
  Music2,
  Edit3,
  Check,
  ArrowRight,
  Crown,
  Play,
  Send,
  BellRing,
  X,
  Disc3,
} from 'lucide-react';
import {
  ChatMessage,
  OnlineChatMember,
  PrivateChatMessage,
  Song,
  YmRoomMusicState,
  YmRoomSummaryInfo,
} from '../types/karaoke';
import {
  ChatRoomGroup,
  getVietnamChatRoom,
  VIETNAM_CHAT_ROOMS,
} from '../../shared/vietnamChatRooms';
import { playBuzzSound, removeVietnameseTones } from '../utils/vietnamese';
import { WsListener } from '../hooks/useRealtimeSocket';
import { CommunityRoomPage } from './CommunityRoomPage';

interface YahooChatProps {
  userId: string;
  nickname: string;
  onNicknameChange: (nextNick: string) => void;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  currentSong: Song;
  incomingSharedSong: { song: Song; seq: number } | null;
  connected: boolean;
  sendEvent: (type: string, payload?: Record<string, unknown>) => void;
  subscribe: (listener: WsListener) => () => void;
  onParallelKaraoke: (youtubeId: string, title: string, artist: string) => void;
  isParallelKaraokeActive: boolean;
  localRoomMuted: boolean;
  onSetLocalRoomMuted: (muted: boolean) => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

const PROVINCE_REGIONS: Array<'Tất cả 34 tỉnh' | Exclude<ChatRoomGroup, 'Thể loại nhạc'>> = [
  'Tất cả 34 tỉnh',
  'Miền Bắc',
  'Miền Trung & Tây Nguyên',
  'Miền Nam',
];

export function YahooChat({
  userId,
  nickname,
  onNicknameChange,
  selectedRoomId,
  onSelectRoom,
  incomingSharedSong,
  connected,
  sendEvent,
  subscribe,
  onParallelKaraoke,
  isParallelKaraokeActive,
  localRoomMuted,
  onSetLocalRoomMuted,
  onToast,
}: YahooChatProps) {
  const [chatMode, setChatMode] = useState<'public' | 'private'>('public');
  const [showLobbyDmDrawer, setShowLobbyDmDrawer] = useState(false);

  const [provinceSearch, setProvinceSearch] = useState('');
  const [selectedRegionTab, setSelectedRegionTab] = useState<
    'Tất cả 34 tỉnh' | Exclude<ChatRoomGroup, 'Thể loại nhạc'>
  >('Tất cả 34 tỉnh');

  const [isEditingNick, setIsEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(nickname);

  // Room Realtime State (for currently entered dedicated room)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomUsers, setRoomUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [roomMusicState, setRoomMusicState] = useState<YmRoomMusicState | null>(null);

  // Global Directory & Member Counts across all rooms
  const [onlineDirectory, setOnlineDirectory] = useState<OnlineChatMember[]>([]);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [roomSummaries, setRoomSummaries] = useState<Record<string, YmRoomSummaryInfo>>({});

  // Private 1-1 Chat State
  const [activeDmPeer, setActiveDmPeer] = useState<{ id: string; nickname: string } | null>(null);
  const [dmThreads, setDmThreads] = useState<Record<string, PrivateChatMessage[]>>({});
  const [dmPeerNames, setDmPeerNames] = useState<Record<string, string>>({});
  const [unreadByPeer, setUnreadByPeer] = useState<Record<string, number>>({});
  const [lobbyDmInput, setLobbyDmInput] = useState('');

  const lastSharedSeqRef = useRef<number>(0);
  const chatModeRef = useRef(chatMode);
  const activeDmPeerIdRef = useRef<string | null>(activeDmPeer?.id ?? null);
  const selectedRoomIdRef = useRef<string | null>(selectedRoomId);
  const lobbyDmEndRef = useRef<HTMLDivElement>(null);

  chatModeRef.current = chatMode;
  activeDmPeerIdRef.current = activeDmPeer?.id ?? null;
  selectedRoomIdRef.current = selectedRoomId;

  // Join or leave room on server when selectedRoomId changes
  useEffect(() => {
    if (!connected) return;
    if (selectedRoomId) {
      setMessages([]);
      setRoomUsers([]);
      setRoomMusicState(null);
      sendEvent('ym:join', { roomId: selectedRoomId, nickname });
    } else {
      sendEvent('ym:leave_room');
    }
  }, [selectedRoomId, connected, nickname, sendEvent]);

  // Subscribe to real-time WebSocket public, music, directory & private events
  useEffect(() => {
    const unsub = subscribe((type, payload) => {
      if (type === 'ym:history') {
        const roomId = String(payload.roomId || '');
        if (roomId && roomId === selectedRoomIdRef.current) {
          setMessages((payload.messages as ChatMessage[]) || []);
        }
      } else if (type === 'ym:presence') {
        const roomId = String(payload.roomId || '');
        if (roomId && roomId === selectedRoomIdRef.current) {
          setRoomUsers((payload.users as Array<{ id: string; nickname: string }>) || []);
        }
      } else if (type === 'ym:music_state') {
        const state = payload.state as YmRoomMusicState | undefined;
        if (state && state.roomId === selectedRoomIdRef.current) {
          setRoomMusicState(state);
        }
      } else if (type === 'ym:directory') {
        if (Array.isArray(payload.onlineUsers)) {
          setOnlineDirectory(payload.onlineUsers as OnlineChatMember[]);
        }
        if (payload.roomCounts && typeof payload.roomCounts === 'object') {
          setRoomCounts(payload.roomCounts as Record<string, number>);
        }
        if (payload.roomSummaries && typeof payload.roomSummaries === 'object') {
          setRoomSummaries(payload.roomSummaries as Record<string, YmRoomSummaryInfo>);
        }
      } else if (type === 'ym:message') {
        const msg = payload.message as ChatMessage | undefined;
        if (msg && msg.roomId === selectedRoomIdRef.current) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      } else if (type === 'ym:buzz') {
        const msg = payload.message as ChatMessage | undefined;
        if (msg && msg.roomId === selectedRoomIdRef.current) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          playBuzzSound();
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
          const viewingInRoom =
            Boolean(selectedRoomIdRef.current) &&
            chatModeRef.current === 'private' &&
            activeDmPeerIdRef.current === peerId;
          const viewingInLobby =
            !selectedRoomIdRef.current &&
            showLobbyDmDrawer &&
            activeDmPeerIdRef.current === peerId;

          if (!viewingInRoom && !viewingInLobby) {
            setUnreadByPeer((prev) => ({ ...prev, [peerId]: (prev[peerId] || 0) + 1 }));
            onToast(
              type === 'ym:dm_buzz'
                ? `${peerName} vừa gửi BUZZ! riêng cho bạn!`
                : `Tin nhắn riêng mới từ ${peerName}`,
              type === 'ym:dm_buzz' ? 'warning' : 'info'
            );
          }
          if (type === 'ym:dm_buzz') {
            playBuzzSound();
          }
        }
      }
    });
    return unsub;
  }, [userId, subscribe, onToast, showLobbyDmDrawer]);

  // Handle song shared from KaraokePlayer -> enter default music room if in lobby
  useEffect(() => {
    if (!incomingSharedSong || incomingSharedSong.seq === lastSharedSeqRef.current) return;
    lastSharedSeqRef.current = incomingSharedSong.seq;
    const targetRoom = selectedRoomId || 'nhac-tre';
    if (!selectedRoomId) {
      onSelectRoom(targetRoom);
    }
    const { song } = incomingSharedSong;
    window.setTimeout(() => {
      sendEvent('ym:send', {
        roomId: targetRoom,
        message: {
          id: `share-${Date.now()}`,
          roomId: targetRoom,
          sender: nickname,
          text: `Mời cả phòng cùng hát bài "${song.title}" nhé! :D`,
          timestamp: new Date().toTimeString().slice(0, 5),
          color: '#FBBF24',
          isBold: true,
          sharedSong: {
            title: song.title,
            artist: song.artist,
            youtubeId: song.youtubeId,
          },
        },
      });
    }, 180);
  }, [incomingSharedSong, selectedRoomId, nickname, sendEvent, onSelectRoom]);

  const openPrivateChat = useCallback(
    (peer: { id: string; nickname: string }) => {
      if (!peer.id || peer.id === userId) return;
      setActiveDmPeer(peer);
      setChatMode('private');
      if (!selectedRoomIdRef.current) {
        setShowLobbyDmDrawer(true);
      }
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

  const activeDmMessages = useMemo(
    () => (activeDmPeer ? dmThreads[activeDmPeer.id] || [] : []),
    [activeDmPeer, dmThreads]
  );

  useEffect(() => {
    if (showLobbyDmDrawer) {
      lobbyDmEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeDmMessages.length, showLobbyDmDrawer, activeDmPeer?.id]);

  const totalUnreadPrivate = useMemo(
    () => Object.values(unreadByPeer).reduce((acc, n) => acc + n, 0),
    [unreadByPeer]
  );

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

  const musicGenreRooms = useMemo(
    () => VIETNAM_CHAT_ROOMS.filter((r) => r.group === 'Thể loại nhạc'),
    []
  );

  const filteredProvinceRooms = useMemo(() => {
    const q = removeVietnameseTones(provinceSearch);
    return VIETNAM_CHAT_ROOMS.filter((room) => {
      if (room.group === 'Thể loại nhạc') return false;
      if (selectedRegionTab !== 'Tất cả 34 tỉnh' && room.group !== selectedRegionTab) return false;
      if (!q) return true;
      return removeVietnameseTones(
        `${room.name} ${room.shortName} ${room.group} ${room.topic}`
      ).includes(q);
    });
  }, [provinceSearch, selectedRegionTab]);

  const totalOnlineUsers = Math.max(1, onlineDirectory.length);

  const handleSaveNickname = () => {
    const clean = nickDraft.trim().replace(/\s+/g, '_') || 'ca_si_online';
    onNicknameChange(clean);
    setNickDraft(clean);
    setIsEditingNick(false);
    onToast(`Đã đổi nickname thành "${clean}"`, 'success');
  };

  // Dedicated Room View ("Trang riêng" for selected Music Genre or Province Room)
  if (selectedRoomId) {
    const roomDef = getVietnamChatRoom(selectedRoomId);
    return (
      <CommunityRoomPage
        room={roomDef}
        userId={userId}
        nickname={nickname}
        onNicknameChange={onNicknameChange}
        musicState={roomMusicState}
        roomUsers={roomUsers}
        onlineDirectory={onlineDirectory}
        messages={messages}
        chatMode={chatMode}
        onChangeChatMode={setChatMode}
        activeDmPeer={activeDmPeer}
        dmPeerList={dmPeerList}
        activeDmMessages={activeDmMessages}
        totalUnreadPrivate={totalUnreadPrivate}
        onOpenPrivateChat={openPrivateChat}
        onLeaveRoom={() => {
          sendEvent('ym:leave_room');
          onSelectRoom(null);
        }}
        sendEvent={sendEvent}
        onParallelKaraoke={onParallelKaraoke}
        isParallelKaraokeActive={isParallelKaraokeActive}
        localRoomMuted={localRoomMuted}
        onSetLocalRoomMuted={onSetLocalRoomMuted}
        onToast={onToast}
      />
    );
  }

  // Room Directory Lobby (Organized Music Genre Rooms + 63 Province Rooms + Member Counts)
  return (
    <div id="lounge-section" className="space-y-6">
      {/* Top Lobby Header Bar */}
      <div className="rounded-2xl border border-purple-500/35 bg-[#12131C] p-4 sm:p-5 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
              Y!
            </span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-50">
                Phòng Nghe Nhạc &amp; Chat Cộng Đồng Toàn Quốc
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Chọn phòng Thể Loại Nhạc hoặc 34 Tỉnh Thành Mới để vào trang riêng · Chủ phòng bật bài hát, thành viên góp bài &amp; trò chuyện
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-xs font-semibold text-emerald-300 tabular-nums">
              <Users className="w-3.5 h-3.5" />
              <span>{totalOnlineUsers} đang online</span>
            </span>

            <button
              type="button"
              onClick={() => setShowLobbyDmDrawer((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                showLobbyDmDrawer
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-purple-600/20 hover:bg-purple-600/35 text-purple-200 border-purple-500/40'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Chat Riêng 1-1</span>
              {totalUnreadPrivate > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px] tabular-nums">
                  {totalUnreadPrivate}
                </span>
              )}
            </button>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-400">Nick:</span>
              {isEditingNick ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={nickDraft}
                    onChange={(e) => setNickDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
                    maxLength={22}
                    className="w-24 h-6 px-2 rounded bg-slate-950 border border-purple-500 text-xs text-slate-100 focus:outline-none"
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
        </div>

        {/* Optional Lobby Private 1-1 Chat Panel */}
        {showLobbyDmDrawer && (
          <div className="rounded-xl border border-purple-500/40 bg-[#0D0F17] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-purple-950/50 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-amber-400" />
                <span>Hộp Thư Chat Riêng 1-1</span>
              </span>
              <button
                type="button"
                onClick={() => setShowLobbyDmDrawer(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 h-72">
              <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-800 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {dmPeerList.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center">
                    Chưa có thành viên khác online để nhắn riêng.
                  </p>
                ) : (
                  dmPeerList.map((peer) => (
                    <button
                      key={peer.id}
                      type="button"
                      onClick={() => openPrivateChat({ id: peer.id, nickname: peer.nickname })}
                      className={`w-full px-2.5 py-2 rounded-lg text-left flex items-center justify-between gap-2 cursor-pointer ${
                        activeDmPeer?.id === peer.id
                          ? 'bg-purple-600/30 border border-purple-400/50'
                          : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              peer.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {peer.nickname}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate pl-3.5">
                          {peer.lastMessage || peer.roomName || 'Online'}
                        </p>
                      </div>
                      {peer.unread > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                          {peer.unread}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="md:col-span-8 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 text-xs">
                  {!activeDmPeer ? (
                    <p className="text-slate-400 text-center py-12">
                      Chọn một thành viên bên trái để bắt đầu nhắn riêng 1-1.
                    </p>
                  ) : (
                    activeDmMessages.map((msg) => {
                      const isMe = msg.fromUserId === userId;
                      return (
                        <div key={msg.id} className="break-words">
                          <span className="font-mono text-[10px] text-slate-500 mr-1.5">
                            [{msg.timestamp}]
                          </span>
                          <span
                            className={`font-semibold mr-1.5 ${
                              isMe ? 'text-amber-400' : 'text-emerald-300'
                            }`}
                          >
                            {isMe ? nickname : msg.fromName}:
                          </span>
                          <span className={msg.isBuzz ? 'font-bold text-rose-500' : 'text-slate-100'}>
                            {msg.isBuzz ? 'BUZZ!!!' : msg.text}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={lobbyDmEndRef} />
                </div>

                {activeDmPeer && (
                  <div className="p-2 border-t border-slate-800 flex items-center gap-2 bg-slate-900/70">
                    <button
                      type="button"
                      onClick={() => {
                        playBuzzSound();
                        sendEvent('ym:dm_buzz', {
                          toUserId: activeDmPeer.id,
                          toName: activeDmPeer.nickname,
                        });
                      }}
                      className="px-2 py-1.5 rounded bg-rose-600/20 text-rose-400 border border-rose-500/40 text-[11px] font-bold cursor-pointer"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      value={lobbyDmInput}
                      onChange={(e) => setLobbyDmInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && lobbyDmInput.trim()) {
                          sendEvent('ym:dm_send', {
                            toUserId: activeDmPeer.id,
                            toName: activeDmPeer.nickname,
                            message: { id: `dm-${Date.now()}`, text: lobbyDmInput.trim() },
                          });
                          setLobbyDmInput('');
                        }
                      }}
                      placeholder={`Nhắn riêng cho ${activeDmPeer.nickname}...`}
                      className="flex-1 h-8 px-2.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!lobbyDmInput.trim()) return;
                        sendEvent('ym:dm_send', {
                          toUserId: activeDmPeer.id,
                          toName: activeDmPeer.nickname,
                          message: { id: `dm-${Date.now()}`, text: lobbyDmInput.trim() },
                        });
                        setLobbyDmInput('');
                      }}
                      className="px-3 h-8 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 1: Music Genre Rooms (8 phòng thể loại nhạc) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base sm:text-lg font-bold text-amber-300 flex items-center gap-2">
              <Disc3 className="w-5 h-5" />
              <span>Phòng Theo Thể Loại Nhạc ({musicGenreRooms.length} phòng)</span>
            </h3>
            <span className="text-xs text-slate-400">
              Bấm vào phòng để mở trang riêng · Chủ phòng bật nhạc
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {musicGenreRooms.map((room) => {
              const count = roomCounts[room.id] || 0;
              const summary = roomSummaries[room.id];
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSelectRoom(room.id)}
                  className="group text-left rounded-xl bg-slate-900/75 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 p-3.5 flex flex-col justify-between gap-3 transition-all cursor-pointer"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/35 text-[10px] font-semibold text-purple-200 truncate">
                        {room.suggestedGenre}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums shrink-0 ${
                          count > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        <span>{count}</span>
                      </span>
                    </div>

                    <h4 className="font-display text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                      {room.name}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {room.topic}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                    <div className="min-w-0 flex items-center gap-1.5 text-slate-400 truncate">
                      {summary?.isPlaying && summary.currentTrackTitle ? (
                        <>
                          <Play className="w-3 h-3 text-emerald-400 fill-emerald-400 shrink-0" />
                          <span className="text-emerald-300 truncate">{summary.currentTrackTitle}</span>
                        </>
                      ) : summary?.hostName ? (
                        <>
                          <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">Chủ phòng: {summary.hostName}</span>
                        </>
                      ) : (
                        <>
                          <Music2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>Sẵn sàng mở nhạc</span>
                        </>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-amber-400 font-semibold shrink-0 group-hover:translate-x-0.5 transition-transform">
                      <span>Vào</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: 34 New Vietnam Provinces & Cities Rooms */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-sky-300 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <span>Phòng Giao Lưu 34 Tỉnh Thành Mới Việt Nam</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cập nhật 34 tỉnh, thành phố trực thuộc TW sau sáp nhập 2025 · Phân chia Bắc · Trung &amp; Tây Nguyên · Nam kèm số người đang tham gia
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={provinceSearch}
                onChange={(e) => setProvinceSearch(e.target.value)}
                placeholder="Tìm tỉnh mới hoặc tỉnh cũ (vd: TP.HCM, Bình Dương, Đà Nẵng)..."
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Region Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {PROVINCE_REGIONS.map((region) => {
              const countInRegion =
                region === 'Tất cả 34 tỉnh'
                  ? VIETNAM_CHAT_ROOMS.filter((r) => r.group !== 'Thể loại nhạc').length
                  : VIETNAM_CHAT_ROOMS.filter((r) => r.group === region).length;
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegionTab(region)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                    selectedRegionTab === region
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {region} ({countInRegion})
                </button>
              );
            })}
          </div>

          {/* Province Cards Grid */}
          {filteredProvinceRooms.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              Không tìm thấy phòng tỉnh/thành phù hợp với từ khóa &ldquo;{provinceSearch}&rdquo;.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {filteredProvinceRooms.map((room) => {
                const count = roomCounts[room.id] || 0;
                const summary = roomSummaries[room.id];
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onSelectRoom(room.id)}
                    className="group text-left rounded-xl bg-slate-900/65 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-400/50 p-3 flex flex-col justify-between gap-2 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-sky-300 truncate">
                          {room.shortName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{room.group}</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums shrink-0 ${
                          count > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                        title={`${count} người đang tham gia phòng ${room.shortName}`}
                      >
                        <Users className="w-2.5 h-2.5" />
                        <span>{count}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-800/70">
                      <span className="truncate">
                        {summary?.isPlaying && summary.currentTrackTitle
                          ? `♪ ${summary.currentTrackTitle}`
                          : room.suggestedGenre}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-sky-300 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
