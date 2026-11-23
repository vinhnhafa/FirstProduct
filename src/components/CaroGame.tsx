import { useState, useCallback, useEffect } from 'react';
import { RotateCcw, Undo2, Users, Cpu, Trophy } from 'lucide-react';
import { playStoneSound, playWinSound } from '../utils/vietnamese';

type Cell = 'X' | 'O' | null;
type Mode = 'ai' | 'pvp';

const BOARD_SIZE = 15;

interface MoveRecord {
  row: number;
  col: number;
  player: 'X' | 'O';
}

function createEmptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null));
}

function checkWinner(board: Cell[][]): { winner: 'X' | 'O'; line: [number, number][] } | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const player = board[r][c];
      if (!player) continue;
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]];
        for (let k = 1; k < 5; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (
            nr >= 0 &&
            nr < BOARD_SIZE &&
            nc >= 0 &&
            nc < BOARD_SIZE &&
            board[nr][nc] === player
          ) {
            line.push([nr, nc]);
          } else {
            break;
          }
        }
        if (line.length === 5) {
          return { winner: player, line };
        }
      }
    }
  }
  return null;
}

// Heuristic line scorer for smart Gomoku AI
function evaluatePoint(board: Cell[][], r: number, c: number, player: 'X' | 'O'): number {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  let total = 0;

  for (const [dr, dc] of dirs) {
    let count = 1;
    let openEnds = 0;

    for (const sign of [-1, 1]) {
      for (let step = 1; step <= 4; step++) {
        const nr = r + dr * step * sign;
        const nc = c + dc * step * sign;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (board[nr][nc] === player) {
          count++;
        } else if (board[nr][nc] === null) {
          openEnds++;
          break;
        } else {
          break;
        }
      }
    }

    if (count >= 5) total += 100000;
    else if (count === 4 && openEnds === 2) total += 15000;
    else if (count === 4 && openEnds === 1) total += 3500;
    else if (count === 3 && openEnds === 2) total += 1500;
    else if (count === 3 && openEnds === 1) total += 300;
    else if (count === 2 && openEnds === 2) total += 120;
    else if (count === 2 && openEnds === 1) total += 25;
    else total += 5;
  }

  return total;
}

function chooseBestAiMove(board: Cell[][]): [number, number] {
  const candidates: [number, number][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;
      // Only consider cells within distance 2 of existing pieces
      let hasNeighbor = false;
      for (let dr = -2; dr <= 2 && !hasNeighbor; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nr < BOARD_SIZE &&
            nc >= 0 &&
            nc < BOARD_SIZE &&
            board[nr][nc] !== null
          ) {
            hasNeighbor = true;
            break;
          }
        }
      }
      if (hasNeighbor) candidates.push([r, c]);
    }
  }

  if (candidates.length === 0) return [7, 7];

  let bestScore = -1;
  let bestMove = candidates[0];

  for (const [r, c] of candidates) {
    const attack = evaluatePoint(board, r, c, 'O') * 1.1;
    const defense = evaluatePoint(board, r, c, 'X');
    const centerBias = 7 - (Math.abs(r - 7) + Math.abs(c - 7)) * 0.1;
    const score = Math.max(attack, defense) + (attack + defense) * 0.25 + centerBias;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }

  return bestMove;
}

export function CaroGame({
  onToast,
}: {
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}) {
  const [board, setBoard] = useState<Cell[][]>(createEmptyBoard);
  const [mode, setMode] = useState<Mode>('ai');
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [history, setHistory] = useState<MoveRecord[]>([]);
  const [winInfo, setWinInfo] = useState<{ winner: 'X' | 'O'; line: [number, number][] } | null>(
    null
  );
  const [isDraw, setIsDraw] = useState(false);
  const [scores, setScores] = useState({ X: 0, O: 0, draw: 0 });

  const resetGame = useCallback((nextMode?: Mode) => {
    setBoard(createEmptyBoard());
    setTurn('X');
    setHistory([]);
    setWinInfo(null);
    setIsDraw(false);
    if (nextMode) setMode(nextMode);
  }, []);

  const applyMove = useCallback(
    (r: number, c: number, player: 'X' | 'O', currentBoard: Cell[][]) => {
      const nextBoard = currentBoard.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? player : cell)) : row
      );
      setBoard(nextBoard);
      setHistory((prev) => [...prev, { row: r, col: c, player }]);
      playStoneSound(player === 'X');

      const result = checkWinner(nextBoard);
      if (result) {
        setWinInfo(result);
        setScores((prev) => ({ ...prev, [result.winner]: prev[result.winner] + 1 }));
        playWinSound();
        onToast(
          mode === 'ai'
            ? result.winner === 'X'
              ? 'Bạn đã chiến thắng Cờ Caro!'
              : 'Máy (O) đã thắng ván Caro này!'
            : `Người chơi ${result.winner} đã chiến thắng Cờ Caro!`,
          result.winner === 'X' ? 'success' : 'info'
        );
        return;
      }

      const full = nextBoard.every((row) => row.every((cell) => cell !== null));
      if (full) {
        setIsDraw(true);
        setScores((prev) => ({ ...prev, draw: prev.draw + 1 }));
        onToast('Ván Cờ Caro kết thúc hòa!', 'info');
        return;
      }

      setTurn(player === 'X' ? 'O' : 'X');
    },
    [mode, onToast]
  );

  // Trigger AI move when mode === 'ai' and turn === 'O'
  useEffect(() => {
    if (mode !== 'ai' || turn !== 'O' || winInfo || isDraw) return;
    const timer = window.setTimeout(() => {
      const [r, c] = chooseBestAiMove(board);
      applyMove(r, c, 'O', board);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [mode, turn, winInfo, isDraw, board, applyMove]);

  const handleCellClick = (r: number, c: number) => {
    if (winInfo || isDraw || board[r][c] !== null) return;
    if (mode === 'ai' && turn === 'O') return;
    applyMove(r, c, turn, board);
  };

  const handleUndo = () => {
    if (history.length === 0 || winInfo || isDraw) return;
    const stepsToUndo = mode === 'ai' && turn === 'X' && history.length >= 2 ? 2 : 1;
    const trimmed = history.slice(0, history.length - stepsToUndo);
    const rebuilt = createEmptyBoard();
    for (const m of trimmed) {
      rebuilt[m.row][m.col] = m.player;
    }
    setBoard(rebuilt);
    setHistory(trimmed);
    setTurn(trimmed.length % 2 === 0 ? 'X' : 'O');
  };

  const lastMove = history[history.length - 1];
  const winCellSet = new Set(winInfo?.line.map(([r, c]) => `${r}-${c}`) ?? []);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#111520] shadow-2xl flex flex-col h-[600px]">
      {/* Top Bar */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm sm:text-base font-bold text-slate-50">
            Cờ Caro (5 Nước)
          </h3>
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => resetGame('ai')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                mode === 'ai'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Đấu Máy</span>
            </button>
            <button
              type="button"
              onClick={() => resetGame('pvp')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                mode === 'pvp'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>2 Người</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0 || !!winInfo || isDraw}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Đi lại</span>
          </button>
          <button
            type="button"
            onClick={() => resetGame()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ván mới</span>
          </button>
        </div>
      </div>

      {/* Score & Turn Status */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-4 font-mono tabular-nums">
          <span className="text-rose-400 font-semibold">X: {scores.X}</span>
          <span className="text-slate-400">Hòa: {scores.draw}</span>
          <span className="text-sky-400 font-semibold">
            {mode === 'ai' ? 'Máy (O)' : 'O'}: {scores.O}
          </span>
        </div>
        <div className="font-medium">
          {winInfo ? (
            <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
              <Trophy className="w-3.5 h-3.5" />
              {winInfo.winner} Chiến thắng!
            </span>
          ) : isDraw ? (
            <span className="text-slate-300">Hòa cờ!</span>
          ) : (
            <span className={turn === 'X' ? 'text-rose-400' : 'text-sky-400'}>
              Lượt: {turn === 'X' ? 'X (Bạn)' : mode === 'ai' ? 'Máy (O) đang nghĩ...' : 'O'}
            </span>
          )}
        </div>
      </div>

      {/* 15x15 Interactive Board */}
      <div className="flex-1 flex items-center justify-center p-3 overflow-auto bg-[#0C0F17]">
        <div
          className="grid gap-px bg-slate-700/70 p-1 rounded-lg border border-slate-700 shadow-inner"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isLast = lastMove?.row === r && lastMove?.col === c;
              const isWinCell = winCellSet.has(`${r}-${c}`);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleCellClick(r, c)}
                  aria-label={`Ô hàng ${r + 1} cột ${c + 1}`}
                  className={`w-[21px] h-[21px] sm:w-[27px] sm:h-[27px] flex items-center justify-center text-xs sm:text-sm font-extrabold leading-none transition-colors cursor-pointer ${
                    isWinCell
                      ? 'bg-amber-500/30 ring-1 ring-amber-400'
                      : isLast
                        ? 'bg-slate-800 ring-1 ring-inset ring-amber-400/70'
                        : 'bg-[#151A28] hover:bg-slate-800/80'
                  }`}
                >
                  {cell === 'X' && <span className="text-rose-400">X</span>}
                  {cell === 'O' && <span className="text-sky-400">O</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
