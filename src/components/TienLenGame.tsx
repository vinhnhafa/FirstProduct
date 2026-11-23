import { useState, useEffect, useRef } from 'react';
import {
  Spade,
  Users,
  Plus,
  LogOut,
  Play,
  Volume2,
  VolumeX,
  Trophy,
  Send,
  Eye,
  Clock,
} from 'lucide-react';
import { Card, Suit } from '../../shared/gameEngine';
import { GameRoomDetail, GameRoomSummary } from '../types/karaoke';
import { WsListener } from '../hooks/useRealtimeSocket';
import { playCardSound, playWinSound } from '../utils/vietnamese';

interface TienLenGameProps {
  userId: string;
  userName: string;
  rooms: GameRoomSummary[];
  connected: boolean;
  sendEvent: (type: string, payload?: Record<string, unknown>) => void;
  subscribe: (listener: WsListener) => () => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

const RANK_LABELS: Record<number, string> = {
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
};

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
};

function CardFace({
  card,
  selected,
  onClick,
  compact = false,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const label = RANK_LABELS[card.rank] || String(card.rank);
  const symbol = SUIT_SYMBOL[card.suit];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative select-none rounded-xl border font-bold transition-all flex flex-col justify-between bg-slate-50 shadow-md ${
        compact ? 'w-11 h-16 p-1.5 text-xs' : 'w-14 h-20 sm:w-16 sm:h-24 p-2 text-sm'
      } ${
        selected
          ? '-translate-y-3 border-amber-400 ring-2 ring-amber-400 shadow-amber-500/30'
          : 'border-slate-300 hover:-translate-y-1'
      } ${isRed ? 'text-rose-600' : 'text-slate-900'} ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="leading-none text-left">
        <div>{label}</div>
        <div className="text-[11px]">{symbol}</div>
      </div>
      <div className={`text-center leading-none ${compact ? 'text-lg' : 'text-2xl'}`}>{symbol}</div>
      <div className="leading-none text-right rotate-180">
        <div className="text-[11px]">{label}</div>
      </div>
    </button>
  );
}

export function TienLenGame({
  userId,
  userName,
  rooms,
  connected,
  sendEvent,
  subscribe,
  onToast,
}: TienLenGameProps) {
  const [activeRoom, setActiveRoom] = useState<GameRoomDetail | null>(null);
  const activeRoomRef = useRef<GameRoomDetail | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [newRoomName, setNewRoomName] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState(4);
  const [isCreating, setIsCreating] = useState(false);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    return subscribe((type, payload) => {
      if (type === 'ws:reconnected') {
        if (activeRoomRef.current) {
          sendEvent('game:join', { roomId: activeRoomRef.current.id });
        }
        return;
      }
      if (type === 'game:room_state') {
        const room = payload.room as GameRoomDetail | undefined;
        if (!room || room.gameType !== 'tien-len') return;
        const prevWinner = activeRoomRef.current?.winnerUserId;
        setActiveRoom(room);
        if (room.status === 'finished' && room.winnerUserId && room.winnerUserId !== prevWinner) {
          if (soundEnabled) playWinSound();
          onToast(`${room.winnerName} đã về nhất ván Tiến Lên!`, 'success');
        }
      } else if (type === 'game:private_hand') {
        const rid = String(payload.roomId || '');
        if (activeRoomRef.current && rid !== activeRoomRef.current.id) return;
        const hand = Array.isArray(payload.hand) ? (payload.hand as Card[]) : [];
        setMyHand(hand);
        setSelectedIds((prev) => prev.filter((id) => hand.some((c) => c.id === id)));
      } else if (type === 'game:error') {
        onToast(String(payload.error || 'Không thể thực hiện nước đi.'), 'warning');
      }
    });
  }, [subscribe, sendEvent, soundEnabled, onToast]);

  const handleJoinRoom = async (roomId: string) => {
    try {
      const res = await fetch(`/api/game-rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });
      const data = (await res.json()) as {
        room?: GameRoomDetail;
        hand?: Card[];
        error?: string;
      };
      if (!res.ok || !data.room) {
        onToast(data.error || 'Không vào được bàn chơi.', 'warning');
        return;
      }
      setActiveRoom(data.room);
      setMyHand(Array.isArray(data.hand) ? data.hand : []);
      setSelectedIds([]);
      sendEvent('game:join', { roomId: data.room.id });
    } catch {
      sendEvent('game:join', { roomId });
    }
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/game-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim() || `Bàn Tiến Lên của ${userName}`,
          gameType: 'tien-len',
          maxPlayers: newMaxPlayers,
          hostId: userId,
          hostName: userName,
        }),
      });
      const data = (await res.json()) as { room?: GameRoomSummary; error?: string };
      if (!res.ok || !data.room) {
        onToast(data.error || 'Không tạo được bàn mới.', 'warning');
        return;
      }
      setNewRoomName('');
      await handleJoinRoom(data.room.id);
      onToast(`Đã mở bàn "${data.room.name}"!`, 'success');
    } catch {
      onToast('Lỗi kết nối khi tạo bàn chơi.', 'warning');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLeaveRoom = () => {
    sendEvent('game:leave');
    setActiveRoom(null);
    setMyHand([]);
    setSelectedIds([]);
  };

  const tienLenRooms = rooms.filter((r) => r.gameType === 'tien-len');

  // --- LOBBY VIEW ---
  if (!activeRoom) {
    return (
      <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-5 space-y-5 shadow-xl h-full flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400">
              <Spade className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-50">
                Sảnh Bài Tiến Lên Miền Nam (Đấu Người Thật)
              </h3>
              <p className="text-xs text-slate-400">
                Chọn bàn chơi hoặc mở phòng mới để thi đấu trực tiếp cùng các thành viên khác
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-emerald-400">
            {connected ? 'Đang kết nối trực tuyến' : 'Đang đồng bộ...'}
          </span>
        </div>

        {/* Create New Table */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder={`Tên bàn mới (VD: Bàn của ${userName})...`}
            className="flex-1 h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <select
            value={newMaxPlayers}
            onChange={(e) => setNewMaxPlayers(Number(e.target.value))}
            className="h-9 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none"
          >
            <option value={2}>2 người chơi</option>
            <option value={3}>3 người chơi</option>
            <option value={4}>4 người chơi</option>
          </select>
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCreating ? 'Đang tạo...' : 'Tạo Bàn Mới'}</span>
          </button>
        </div>

        {/* Room List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          {tienLenRooms.map((room) => (
            <div
              key={room.id}
              className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 flex flex-col justify-between gap-3 hover:border-emerald-500/40 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-amber-300 font-semibold">Mã: {room.code}</span>
                  <span
                    className={`font-semibold ${
                      room.status === 'playing' ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {room.status === 'playing' ? 'Đang đấu' : 'Đang mở bàn'}
                  </span>
                </div>
                <p className="font-display text-sm font-bold text-slate-100 truncate">
                  {room.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {room.seats.length > 0
                    ? `Trong bàn: ${room.seats.map((s) => s.userName).join(', ')}`
                    : 'Bàn đang trống — Vào ngồi trước để mời bạn chơi!'}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 tabular-nums">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  {room.playerCount}/{room.maxPlayers} người
                </span>

                <button
                  type="button"
                  onClick={() => handleJoinRoom(room.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                >
                  {room.status === 'playing' || room.playerCount >= room.maxPlayers
                    ? 'Vào xem'
                    : 'Vào bàn chơi'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- INSIDE MULTIPLAYER TABLE ---
  const mySeat = activeRoom.seats.find((s) => s.userId === userId);
  const isMyTurn = activeRoom.status === 'playing' && activeRoom.turnUserId === userId;
  const opponents = activeRoom.seats.filter((s) => s.userId !== userId);

  const toggleSelectCard = (id: string) => {
    if (!isMyTurn) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePlaySelected = () => {
    if (!isMyTurn || selectedIds.length === 0) return;
    if (soundEnabled) playCardSound();
    sendEvent('game:play_cards', { cardIds: selectedIds });
    setSelectedIds([]);
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    sendEvent('game:pass_turn');
    setSelectedIds([]);
  };

  const handleSendChat = () => {
    const clean = chatInput.trim();
    if (!clean) return;
    sendEvent('game:chat', { text: clean });
    setChatInput('');
  };

  return (
    <div className="rounded-2xl bg-[#111520] border border-slate-800/90 overflow-hidden shadow-xl flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <Spade className="w-3.5 h-3.5" />
            <span>{activeRoom.name}</span>
            <span className="font-mono text-amber-300">#{activeRoom.code}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {activeRoom.status === 'waiting'
              ? `Đang chờ đủ người chơi (${activeRoom.seats.length}/${activeRoom.maxPlayers})`
              : activeRoom.status === 'finished'
              ? `Ván kết thúc · ${activeRoom.winnerName} chiến thắng!`
              : `Đang tới lượt: ${
                  activeRoom.seats.find((s) => s.userId === activeRoom.turnUserId)?.userName || '...'
                }`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title="Bật/Tắt âm thanh"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {!mySeat && activeRoom.status !== 'playing' && activeRoom.seats.length < activeRoom.maxPlayers && (
            <button
              type="button"
              onClick={() => sendEvent('game:take_seat')}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Ngồi vào bàn
            </button>
          )}

          {mySeat && activeRoom.status !== 'playing' && (
            <button
              type="button"
              onClick={() => sendEvent('game:start')}
              disabled={activeRoom.seats.length < 2}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{activeRoom.status === 'finished' ? 'Chia ván mới' : 'Bắt đầu chia bài'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLeaveRoom}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/25 hover:text-rose-300 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời bàn</span>
          </button>
        </div>
      </div>

      {/* Table Felt */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-[#0C261D] via-[#0B2019] to-[#0B111A] space-y-4">
        {/* Seated Opponents */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {opponents.map((seat) => {
            const isTurn = activeRoom.turnUserId === seat.userId;
            return (
              <div
                key={seat.userId}
                className={`rounded-xl px-3 py-2 border flex items-center justify-between gap-2 ${
                  isTurn
                    ? 'bg-amber-500/20 border-amber-400'
                    : 'bg-slate-950/60 border-white/10'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-100 truncate">{seat.userName}</p>
                  <p className="text-[11px] text-emerald-300">
                    {seat.passed
                      ? 'Đã bỏ lượt'
                      : isTurn
                      ? 'Đang suy nghĩ...'
                      : 'Đang chờ lượt'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-900 font-mono text-xs font-bold text-amber-300 tabular-nums shrink-0">
                  {activeRoom.status === 'playing' ? `${seat.cardCount ?? 0} lá` : 'Sẵn sàng'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Center Board */}
        <div className="min-h-[155px] rounded-2xl border border-emerald-500/20 bg-black/25 p-4 flex flex-col items-center justify-center gap-3">
          {activeRoom.status === 'waiting' ? (
            <div className="text-center space-y-2 max-w-md">
              <Clock className="w-7 h-7 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-100">
                {activeRoom.seats.length < 2
                  ? `Đang chờ người chơi thật khác vào bàn (${activeRoom.seats.length}/${activeRoom.maxPlayers})`
                  : 'Đã đủ người chơi! Hãy bấm "Bắt đầu chia bài" ở góc trên để chơi ngay.'}
              </p>
              <p className="text-xs text-slate-400">
                Mã bàn: <span className="font-mono text-amber-300 font-bold">{activeRoom.code}</span> ·
                Có thể rủ bạn từ Chat Yahoo vào cùng bàn này.
              </p>
            </div>
          ) : activeRoom.status === 'finished' ? (
            <div className="text-center space-y-2">
              <Trophy className="w-9 h-9 text-amber-400 mx-auto" />
              <p className="font-display text-lg font-bold text-amber-300">
                {activeRoom.winnerName} thắng ván này!
              </p>
              {mySeat && activeRoom.seats.length >= 2 && (
                <button
                  type="button"
                  onClick={() => sendEvent('game:start')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Chia bài ván mới
                </button>
              )}
            </div>
          ) : activeRoom.lastPlay ? (
            <div className="space-y-2 text-center">
              <p className="text-xs text-slate-300">
                <span className="font-semibold text-amber-300">{activeRoom.lastPlay.userName}</span>{' '}
                vừa đánh:
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {activeRoom.lastPlay.cards.map((card) => (
                  <CardFace key={`center-${card.id}`} card={card} compact />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-emerald-200/80 text-center">
              {activeRoom.mustInclude3Spade
                ? 'Ván mới! Người giữ lá 3♠ đánh mở màn đầu tiên.'
                : 'Vòng mới tự do — người tới lượt đánh bộ bài bất kỳ!'}
            </p>
          )}
        </div>

        {/* My Hand & Actions */}
        {mySeat ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">
                Bài của bạn ({mySeat.userName}) —{' '}
                {isMyTurn ? (
                  <span className="text-amber-300 font-bold">ĐẾN LƯỢT BẠN!</span>
                ) : (
                  <span className="text-slate-400">
                    {activeRoom.status === 'playing' ? 'Đang chờ đối thủ...' : `${myHand.length} lá`}
                  </span>
                )}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  disabled={selectedIds.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-slate-200 cursor-pointer"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={handlePass}
                  disabled={!isMyTurn || !activeRoom.lastPlay}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-rose-300 cursor-pointer"
                >
                  Bỏ lượt
                </button>
                <button
                  type="button"
                  onClick={handlePlaySelected}
                  disabled={!isMyTurn || selectedIds.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Đánh bài ({selectedIds.length})
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 pt-3 pb-1 min-h-[104px]">
              {myHand.map((card) => (
                <CardFace
                  key={card.id}
                  card={card}
                  selected={selectedIds.includes(card.id)}
                  onClick={() => toggleSelectCard(card.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-2 text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span>Bạn đang xem trực tiếp bàn đấu ({activeRoom.spectators.length} khán giả)</span>
          </div>
        )}
      </div>

      {/* Table Live Chat */}
      <div className="border-t border-slate-800 bg-slate-950/60 p-3 space-y-2">
        <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1 text-xs">
          {activeRoom.chat.map((c) => (
            <div key={c.id}>
              <span className="font-mono text-[10px] text-slate-500 mr-1.5">[{c.timestamp}]</span>
              <span className="font-semibold text-emerald-300 mr-1">{c.sender}:</span>
              <span className="text-slate-200">{c.text}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder="Chat với người chơi trong bàn..."
            className="flex-1 h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleSendChat}
            className="px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Gửi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
