import { useState, useEffect, useRef } from 'react';
import {
  Grid3X3,
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
import { GameRoomDetail, GameRoomSummary } from '../types/karaoke';
import { WsListener } from '../hooks/useRealtimeSocket';
import { playStoneSound, playWinSound } from '../utils/vietnamese';

interface CaroGameProps {
  userId: string;
  userName: string;
  rooms: GameRoomSummary[];
  connected: boolean;
  sendEvent: (type: string, payload?: Record<string, unknown>) => void;
  subscribe: (listener: WsListener) => () => void;
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export function CaroGame({
  userId,
  userName,
  rooms,
  connected,
  sendEvent,
  subscribe,
  onToast,
}: CaroGameProps) {
  const [activeRoom, setActiveRoom] = useState<GameRoomDetail | null>(null);
  const activeRoomRef = useRef<GameRoomDetail | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [newRoomName, setNewRoomName] = useState('');
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
        if (!room || room.gameType !== 'caro') return;

        const prevLast = activeRoomRef.current?.caroLastMove;
        const prevWinner = activeRoomRef.current?.winnerUserId;
        setActiveRoom(room);

        if (soundEnabled && room.caroLastMove !== null && room.caroLastMove !== prevLast) {
          const placed = room.caroBoard[room.caroLastMove];
          if (placed) playStoneSound(placed === 'X');
        }
        if (room.status === 'finished' && room.winnerUserId && room.winnerUserId !== prevWinner) {
          if (soundEnabled) playWinSound();
          onToast(`${room.winnerName} đã chiến thắng Cờ Caro!`, 'success');
        }
      } else if (type === 'game:error') {
        onToast(String(payload.error || 'Không thể đánh nước này.'), 'warning');
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
      const data = (await res.json()) as { room?: GameRoomDetail; error?: string };
      if (!res.ok || !data.room) {
        onToast(data.error || 'Không vào được bàn Cờ Caro.', 'warning');
        return;
      }
      setActiveRoom(data.room);
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
          name: newRoomName.trim() || `Bàn Caro của ${userName}`,
          gameType: 'caro',
          maxPlayers: 2,
          hostId: userId,
          hostName: userName,
        }),
      });
      const data = (await res.json()) as { room?: GameRoomSummary; error?: string };
      if (!res.ok || !data.room) {
        onToast(data.error || 'Không tạo được bàn Cờ Caro.', 'warning');
        return;
      }
      setNewRoomName('');
      await handleJoinRoom(data.room.id);
      onToast(`Đã mở bàn "${data.room.name}"!`, 'success');
    } catch {
      onToast('Lỗi kết nối khi tạo bàn Cờ Caro.', 'warning');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLeaveRoom = () => {
    sendEvent('game:leave');
    setActiveRoom(null);
  };

  const caroRooms = rooms.filter((r) => r.gameType === 'caro');

  // --- LOBBY VIEW ---
  if (!activeRoom) {
    return (
      <div className="rounded-2xl bg-[#111520] border border-slate-800/90 p-5 space-y-5 shadow-xl h-full flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400">
              <Grid3X3 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-50">
                Sảnh Cờ Caro 15×15 (Đấu 1v1 Người Thật)
              </h3>
              <p className="text-xs text-slate-400">
                Chọn bàn thách đấu hoặc tạo phòng mới để so tài trực tiếp với người chơi khác
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-amber-400">
            {connected ? 'Sẵn sàng ghép đấu' : 'Đang kết nối...'}
          </span>
        </div>

        {/* Create New Room */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder={`Tên bàn Cờ Caro (VD: Thách đấu cùng ${userName})...`}
            className="flex-1 h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCreating ? 'Đang tạo...' : 'Tạo Bàn Caro Mới'}</span>
          </button>
        </div>

        {/* Room Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          {caroRooms.map((room) => (
            <div
              key={room.id}
              className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 flex flex-col justify-between gap-3 hover:border-amber-500/40 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-amber-300 font-semibold">Mã: {room.code}</span>
                  <span
                    className={`font-semibold ${
                      room.status === 'playing' ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {room.status === 'playing' ? 'Đang thi đấu' : 'Đang chờ đối thủ'}
                  </span>
                </div>
                <p className="font-display text-sm font-bold text-slate-100 truncate">
                  {room.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {room.seats.length > 0
                    ? `Người chơi: ${room.seats.map((s) => s.userName).join(' vs ')}`
                    : 'Chưa có người ngồi — Vào làm quân X trước!'}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 tabular-nums">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  {room.playerCount}/2 người
                </span>

                <button
                  type="button"
                  onClick={() => handleJoinRoom(room.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {room.status === 'playing' || room.playerCount >= 2 ? 'Vào xem' : 'Vào bàn đấu'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- ACTIVE CARO ROOM ---
  const mySeatIdx = activeRoom.seats.findIndex((s) => s.userId === userId);
  const mySymbol: 'X' | 'O' | null = mySeatIdx === 0 ? 'X' : mySeatIdx === 1 ? 'O' : null;
  const isMyTurn = activeRoom.status === 'playing' && mySymbol === activeRoom.caroTurn;
  const winSet = new Set(activeRoom.caroWinLine || []);

  const seatX = activeRoom.seats[0];
  const seatO = activeRoom.seats[1];

  const handleCellClick = (idx: number) => {
    if (!isMyTurn || activeRoom.caroBoard[idx] !== null) return;
    sendEvent('game:caro_move', { index: idx });
  };

  const handleSendChat = () => {
    const clean = chatInput.trim();
    if (!clean) return;
    sendEvent('game:chat', { text: clean });
    setChatInput('');
  };

  return (
    <div className="rounded-2xl bg-[#111520] border border-slate-800/90 overflow-hidden shadow-xl flex flex-col">
      {/* Top Bar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>{activeRoom.name}</span>
            <span className="font-mono text-slate-300">#{activeRoom.code}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {seatX ? `X: ${seatX.userName}` : 'X: Trống'} · {seatO ? `O: ${seatO.userName}` : 'O: Trống'}
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

          {!mySymbol && activeRoom.status !== 'playing' && activeRoom.seats.length < 2 && (
            <button
              type="button"
              onClick={() => sendEvent('game:take_seat')}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Ngồi vào đấu
            </button>
          )}

          {mySymbol && activeRoom.status !== 'playing' && (
            <button
              type="button"
              onClick={() => sendEvent('game:start')}
              disabled={activeRoom.seats.length < 2}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{activeRoom.status === 'finished' ? 'Đấu lại' : 'Bắt đầu ván'}</span>
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

      {/* Status & Board */}
      <div className="p-4 flex flex-col items-center gap-3 bg-slate-950/40">
        {activeRoom.status === 'waiting' ? (
          <div className="w-full rounded-xl bg-slate-900/90 border border-slate-800 p-4 text-center space-y-1.5">
            <Clock className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-100">
              {activeRoom.seats.length < 2
                ? `Đang chờ thêm 1 người chơi thật vào bàn (${activeRoom.seats.length}/2)`
                : 'Cả 2 người chơi đã sẵn sàng — Bấm "Bắt đầu ván" để vào trận!'}
            </p>
            <p className="text-xs text-slate-400">
              Mã bàn: <span className="font-mono text-amber-300 font-bold">{activeRoom.code}</span>
            </p>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between text-xs px-2">
            {activeRoom.status === 'finished' ? (
              <span className="inline-flex items-center gap-1.5 text-amber-300 font-bold">
                <Trophy className="w-4 h-4" />
                {activeRoom.isDraw ? 'Hòa cờ!' : `${activeRoom.winnerName} chiến thắng!`}
              </span>
            ) : (
              <span className="text-slate-200 font-semibold">
                Lượt đi:{' '}
                <span className={activeRoom.caroTurn === 'X' ? 'text-sky-400' : 'text-rose-400'}>
                  Quân {activeRoom.caroTurn}
                </span>{' '}
                {isMyTurn ? '(Lượt của bạn!)' : ''}
              </span>
            )}
            {mySymbol ? (
              <span className="text-slate-400">
                Bạn cầm quân{' '}
                <strong className={mySymbol === 'X' ? 'text-sky-400' : 'text-rose-400'}>
                  {mySymbol}
                </strong>
              </span>
            ) : (
              <span className="text-slate-400 inline-flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Khán giả
              </span>
            )}
          </div>
        )}

        <div className="w-full max-w-[460px] aspect-square grid grid-cols-[repeat(15,minmax(0,1fr))] bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
          {activeRoom.caroBoard.map((cell, idx) => {
            const isWin = winSet.has(idx);
            const isLast = activeRoom.caroLastMove === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleCellClick(idx)}
                disabled={!isMyTurn || cell !== null}
                className={`border border-slate-800/80 flex items-center justify-center text-xs sm:text-sm font-extrabold transition-colors ${
                  isWin
                    ? 'bg-emerald-500/35'
                    : isLast
                    ? 'bg-amber-500/20'
                    : 'bg-[#101522] hover:bg-slate-800/80'
                } ${isMyTurn && cell === null ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {cell === 'X' && <span className="text-sky-400">X</span>}
                {cell === 'O' && <span className="text-rose-400">O</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Chat */}
      <div className="border-t border-slate-800 bg-slate-950/60 p-3 space-y-2">
        <div className="max-h-20 overflow-y-auto custom-scrollbar space-y-1 text-xs">
          {activeRoom.chat.map((c) => (
            <div key={c.id}>
              <span className="font-mono text-[10px] text-slate-500 mr-1.5">[{c.timestamp}]</span>
              <span className="font-semibold text-amber-300 mr-1">{c.sender}:</span>
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
            placeholder="Nhắn với đối thủ..."
            className="flex-1 h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={handleSendChat}
            className="px-3 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Gửi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
