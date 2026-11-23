import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { ChatMessage, ChatRoomId, Song } from '../types/karaoke';
import { playBuzzSound } from '../utils/vietnamese';
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

const ROOMS: { id: ChatRoomId; name: string; topic: string }[] = [
  { id: 'nhac-tre', name: 'Phòng Nhạc Trẻ 9x', topic: 'Giao lưu V-Pop, tìm bạn song ca & ôn kỷ niệm Y!M' },
  { id: 'bolero', name: 'Phòng Bolero Sầu Tím', topic: 'Trữ tình, nhạc vàng & tâm sự đêm khuya' },
  { id: 'remix', name: 'Phòng Quẩy Remix', topic: 'Nhạc sàn cực căng, bay hết mình cùng anh em' },
  { id: 'game-thu', name: 'Phòng Cao Thủ Game', topic: 'Rủ nhau đánh Tiến Lên Miền Nam & Cờ Caro' },
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
  const [activeRoom, setActiveRoom] = useState<ChatRoomId>('nhac-tre');
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(nickname);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomUsers, setRoomUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [textColor, setTextColor] = useState('#F8FAFC');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [showEmoticons, setShowEmoticons] = useState(false);
  const [showMembersMobile, setShowMembersMobile] = useState(false);
  const [isBuzzing, setIsBuzzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSharedSeqRef = useRef<number>(0);

  const triggerBuzzVisual = useCallback(() => {
    setIsBuzzing(true);
    playBuzzSound();
    window.setTimeout(() => setIsBuzzing(false), 500);
  }, []);

  // Join room on mount or room switch
  useEffect(() => {
    if (connected) {
      sendEvent('ym:join', { roomId: activeRoom, nickname });
    }
  }, [activeRoom, connected, nickname, sendEvent]);

  // Subscribe to real-time WebSocket Yahoo chat events
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
      }
    });
    return unsub;
  }, [activeRoom, subscribe, triggerBuzzVisual]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, activeRoom]);

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

  const handleSendMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

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
    sendEvent('ym:buzz', { roomId: activeRoom, nickname });
    onToast('Bạn vừa gửi BUZZ! rung phòng chat!', 'warning');
  };

  const handleSaveNickname = () => {
    const clean = nickDraft.trim().replace(/\s+/g, '_') || 'ca_si_online';
    onNicknameChange(clean);
    setNickDraft(clean);
    setIsEditingNick(false);
    onToast(`Đã đổi nickname thành "${clean}"`, 'success');
  };

  const activeRoomObj = ROOMS.find((r) => r.id === activeRoom) ?? ROOMS[0];

  return (
    <div
      id="lounge-section"
      className={`rounded-2xl overflow-hidden border border-purple-500/35 bg-[#12131C] shadow-2xl flex flex-col h-[600px] ${
        isBuzzing ? 'animate-buzz' : ''
      }`}
    >
      {/* Classic Yahoo! Messenger Purple Title Bar */}
      <div className="bg-gradient-to-r from-[#581C87] via-[#6B21A8] to-[#4C1D95] px-4 py-2.5 flex items-center justify-between gap-3 border-b border-purple-400/25 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
            Y!
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-bold text-white truncate">
              Yahoo! Messenger Karaoke — {activeRoomObj.name}
            </h2>
            <p className="text-[11px] text-purple-200/80 truncate">{activeRoomObj.topic}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowMembersMobile((v) => !v)}
          className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-950/60 text-purple-100 text-xs font-medium border border-purple-400/30 shrink-0"
        >
          <Users className="w-3.5 h-3.5" />
          <span className="tabular-nums">{Math.max(1, roomUsers.length)}</span>
        </button>
      </div>

      {/* Room Switcher Bar + User Nickname */}
      <div className="bg-[#191B28] border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-1">
          {ROOMS.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setActiveRoom(room.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeRoom === room.id
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {room.name.replace('Phòng ', '')}
            </button>
          ))}
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

      {/* Main Split: Messages Stream + Online Users Roster */}
      <div className="flex-1 flex min-h-0 relative">
        <div className="flex-1 flex flex-col min-w-0 bg-[#0D0F17]">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-2.5 text-sm">
            {messages.map((msg) => {
              const isMe = msg.sender === nickname;
              return (
                <div key={msg.id} className="leading-relaxed break-words">
                  <span className="font-mono text-[11px] text-slate-500 mr-2 tabular-nums">
                    [{msg.timestamp}]
                  </span>
                  <span
                    className={`font-semibold mr-1.5 ${
                      isMe ? 'text-amber-400' : 'text-purple-300'
                    }`}
                  >
                    {msg.sender}:
                  </span>
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
            })}
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
              onClick={() => {
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
              }}
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
              placeholder={`Nhắn vào ${activeRoomObj.name} (thử :)), =)), <3)...`}
              className="flex-1 h-9 px-3 rounded-lg bg-slate-900 border border-slate-700/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi</span>
            </button>
          </div>
        </div>

        {/* Classic Real-time Connected Member List */}
        <div
          className={`${
            showMembersMobile ? 'absolute inset-y-0 right-0 z-10 flex' : 'hidden sm:flex'
          } w-48 flex-col bg-[#141724] border-l border-slate-800 shrink-0`}
        >
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Đang online</span>
            <span className="font-mono text-amber-400 tabular-nums">
              {Math.max(1, roomUsers.length)}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {roomUsers.length === 0 ? (
              <div className="px-2 py-1.5 rounded-md bg-purple-600/15 border border-purple-500/25">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" aria-hidden="true">😊</span>
                  <span className="text-xs font-bold text-amber-300 truncate">{nickname}</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5 pl-5">Bạn (Online)</p>
              </div>
            ) : (
              roomUsers.map((member) => {
                const isMe = member.id === userId;
                return (
                  <div
                    key={member.id}
                    className={`px-2 py-1.5 rounded-md ${
                      isMe
                        ? 'bg-purple-600/15 border border-purple-500/25'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
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
                      {isMe ? 'Bạn (Online)' : 'Đang trong phòng'}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
