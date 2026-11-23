import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Sparkles, Volume2, VolumeX, ArrowUpDown, SkipForward, Trophy } from 'lucide-react';
import { playCardSound, playWinSound } from '../utils/vietnamese';

type Suit = 0 | 1 | 2 | 3; // 0: ♠, 1: ♣, 2: ♦, 3: ♥
interface Card {
  id: string;
  rank: number; // 3..15 (11=J, 12=Q, 13=K, 14=A, 15=2)
  suit: Suit;
}

type ComboType =
  | 'SINGLE'
  | 'PAIR'
  | 'TRIPLE'
  | 'STRAIGHT'
  | 'PINE_3'
  | 'FOUR_KIND'
  | 'PINE_4';

interface Combo {
  type: ComboType;
  label: string;
  length: number;
  highCard: Card;
}

const SUIT_SYMBOLS: Record<Suit, string> = { 0: '♠', 1: '♣', 2: '♦', 3: '♥' };
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

const PLAYER_NAMES = ['Bạn', 'Tư Béo', 'Bảy Lúa', 'Út Lan'];

function cardPower(c: Card): number {
  return c.rank * 4 + c.suit;
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => cardPower(a) - cardPower(b));
}

function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (let r = 3; r <= 15; r++) {
    for (let s = 0; s <= 3; s++) {
      deck.push({ id: `${r}-${s}`, rank: r, suit: s as Suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function analyzeCombo(cards: Card[]): Combo | null {
  if (cards.length === 0) return null;
  const sorted = sortCards(cards);
  const n = sorted.length;

  if (n === 1) {
    return {
      type: 'SINGLE',
      label: `Lá lẻ ${RANK_LABELS[sorted[0].rank]}${SUIT_SYMBOLS[sorted[0].suit]}`,
      length: 1,
      highCard: sorted[0],
    };
  }

  if (n === 2 && sorted[0].rank === sorted[1].rank) {
    return {
      type: 'PAIR',
      label: `Đôi ${RANK_LABELS[sorted[0].rank]}`,
      length: 2,
      highCard: sorted[1],
    };
  }

  if (n === 3 && sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank) {
    return {
      type: 'TRIPLE',
      label: `Sám cô ${RANK_LABELS[sorted[0].rank]}`,
      length: 3,
      highCard: sorted[2],
    };
  }

  if (n === 4 && sorted.every((c) => c.rank === sorted[0].rank)) {
    return {
      type: 'FOUR_KIND',
      label: `Tứ quý ${RANK_LABELS[sorted[0].rank]}`,
      length: 4,
      highCard: sorted[3],
    };
  }

  // Straight: >= 3 consecutive ranks, no 2 (rank 15)
  if (n >= 3 && sorted.every((c) => c.rank < 15)) {
    let isStraight = true;
    for (let i = 1; i < n; i++) {
      if (sorted[i].rank !== sorted[i - 1].rank + 1) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) {
      return {
        type: 'STRAIGHT',
        label: `Sảnh ${n} lá`,
        length: n,
        highCard: sorted[n - 1],
      };
    }
  }

  // Consecutive pairs (Đôi thông): 6 cards (3 pairs) or 8 cards (4 pairs), no 2
  if ((n === 6 || n === 8) && sorted.every((c) => c.rank < 15)) {
    let validPairs = true;
    for (let i = 0; i < n; i += 2) {
      if (sorted[i].rank !== sorted[i + 1].rank) {
        validPairs = false;
        break;
      }
      if (i > 0 && sorted[i].rank !== sorted[i - 2].rank + 1) {
        validPairs = false;
        break;
      }
    }
    if (validPairs) {
      return {
        type: n === 6 ? 'PINE_3' : 'PINE_4',
        label: n === 6 ? '3 Đôi thông' : '4 Đôi thông',
        length: n,
        highCard: sorted[n - 1],
      };
    }
  }

  return null;
}

function canBeat(next: Combo, prev: Combo | null): boolean {
  if (!prev) return true;

  // Special pig-chopping rules (Chặt heo / hàng)
  if (prev.type === 'SINGLE' && prev.highCard.rank === 15) {
    if (next.type === 'PINE_3' || next.type === 'FOUR_KIND' || next.type === 'PINE_4') {
      return true;
    }
  }
  if (prev.type === 'PAIR' && prev.highCard.rank === 15) {
    if (next.type === 'FOUR_KIND' || next.type === 'PINE_4') {
      return true;
    }
  }
  if (prev.type === 'PINE_3' && (next.type === 'FOUR_KIND' || next.type === 'PINE_4')) {
    return true;
  }
  if (prev.type === 'FOUR_KIND' && next.type === 'PINE_4') {
    return true;
  }

  if (next.type !== prev.type) return false;
  if (next.type === 'STRAIGHT' && next.length !== prev.length) return false;

  return cardPower(next.highCard) > cardPower(prev.highCard);
}

// Find all valid plays from a hand that beat prevCombo
function findValidMoves(hand: Card[], prev: Combo | null): Card[][] {
  const sorted = sortCards(hand);
  const candidates: Card[][] = [];

  // Singles
  for (const c of sorted) {
    candidates.push([c]);
  }

  // Group by rank
  const byRank = new Map<number, Card[]>();
  for (const c of sorted) {
    const arr = byRank.get(c.rank) || [];
    arr.push(c);
    byRank.set(c.rank, arr);
  }

  // Pairs, Triples, Quads
  for (const [, group] of byRank) {
    if (group.length >= 2) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          candidates.push([group[i], group[j]]);
        }
      }
    }
    if (group.length >= 3) {
      candidates.push(group.slice(0, 3));
    }
    if (group.length === 4) {
      candidates.push(group.slice(0, 4));
    }
  }

  // Straights (length 3 to 12)
  const uniqueRanks = Array.from(byRank.keys())
    .filter((r) => r < 15)
    .sort((a, b) => a - b);

  for (let start = 0; start < uniqueRanks.length; start++) {
    const seq: Card[] = [byRank.get(uniqueRanks[start])![0]];
    for (let end = start + 1; end < uniqueRanks.length; end++) {
      if (uniqueRanks[end] === uniqueRanks[end - 1] + 1) {
        seq.push(byRank.get(uniqueRanks[end])![0]);
        if (seq.length >= 3) {
          // Also push variant using highest suit for last card if beating same length straight
          candidates.push([...seq]);
          const lastGroup = byRank.get(uniqueRanks[end])!;
          if (lastGroup.length > 1) {
            const altSeq = [...seq.slice(0, -1), lastGroup[lastGroup.length - 1]];
            candidates.push(altSeq);
          }
        }
      } else {
        break;
      }
    }
  }

  // 3-pair pine
  const pairRanks = uniqueRanks.filter((r) => (byRank.get(r)?.length ?? 0) >= 2);
  for (let i = 0; i <= pairRanks.length - 3; i++) {
    if (pairRanks[i + 1] === pairRanks[i] + 1 && pairRanks[i + 2] === pairRanks[i] + 2) {
      candidates.push([
        ...byRank.get(pairRanks[i])!.slice(0, 2),
        ...byRank.get(pairRanks[i + 1])!.slice(0, 2),
        ...byRank.get(pairRanks[i + 2])!.slice(0, 2),
      ]);
    }
  }

  return candidates.filter((cards) => {
    const combo = analyzeCombo(cards);
    return combo ? canBeat(combo, prev) : false;
  });
}

function CardView({
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
  const isRed = card.suit === 2 || card.suit === 3;
  const colorClass = isRed ? 'text-rose-600' : 'text-slate-900';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative rounded-lg bg-white border border-slate-300 shadow-md select-none transition-transform duration-150 flex flex-col justify-between text-left ${
        compact ? 'w-11 h-16 p-1' : 'w-12 h-[72px] sm:w-14 sm:h-20 p-1.5'
      } ${
        onClick ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-default'
      } ${selected ? '-translate-y-3.5 ring-2 ring-amber-400 shadow-amber-500/30' : ''}`}
    >
      <div className={`leading-none font-bold ${compact ? 'text-xs' : 'text-xs sm:text-sm'} ${colorClass}`}>
        <div>{RANK_LABELS[card.rank]}</div>
        <div className="text-[11px]">{SUIT_SYMBOLS[card.suit]}</div>
      </div>
      <div
        className={`self-center leading-none ${compact ? 'text-base' : 'text-lg sm:text-xl'} ${colorClass}`}
      >
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </button>
  );
}

export function TienLenGame({
  onToast,
}: {
  onToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}) {
  const [hands, setHands] = useState<Card[][]>([[], [], [], []]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [lastPlay, setLastPlay] = useState<{
    playerIndex: number;
    cards: Card[];
    combo: Combo;
  } | null>(null);
  const [passedPlayers, setPassedPlayers] = useState<boolean[]>([false, false, false, false]);
  const [winner, setWinner] = useState<number | null>(null);
  const [statusLog, setStatusLog] = useState<string>('Bấm "Ván mới" hoặc đánh bài để bắt đầu!');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mustInclude3Spade, setMustInclude3Spade] = useState(false);

  const startNewGame = useCallback(() => {
    const deck = createShuffledDeck();
    const dealt: Card[][] = [
      sortCards(deck.slice(0, 13)),
      sortCards(deck.slice(13, 26)),
      sortCards(deck.slice(26, 39)),
      sortCards(deck.slice(39, 52)),
    ];

    // Whoever has 3♠ goes first
    let starter = 0;
    dealt.forEach((h, idx) => {
      if (h.some((c) => c.rank === 3 && c.suit === 0)) {
        starter = idx;
      }
    });

    setHands(dealt);
    setSelectedIds([]);
    setCurrentTurn(starter);
    setLastPlay(null);
    setPassedPlayers([false, false, false, false]);
    setWinner(null);
    setMustInclude3Spade(true);
    setStatusLog(
      starter === 0
        ? 'Bạn có 3♠ — bạn được quyền đánh trước!'
        : `${PLAYER_NAMES[starter]} có 3♠ và đánh trước...`
    );
  }, []);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  const advanceTurn = useCallback(
    (
      nextHands: Card[][],
      nextPassed: boolean[],
      fromPlayer: number,
      nextLastPlay: { playerIndex: number; cards: Card[]; combo: Combo } | null
    ) => {
      // Find next player who hasn't passed and still has cards
      let candidate = (fromPlayer + 1) % 4;
      for (let step = 0; step < 4; step++) {
        if (!nextPassed[candidate] && nextHands[candidate].length > 0) {
          break;
        }
        candidate = (candidate + 1) % 4;
      }

      // If turn returns to the player who made lastPlay, round resets!
      if (nextLastPlay && candidate === nextLastPlay.playerIndex) {
        setPassedPlayers([false, false, false, false]);
        setLastPlay(null);
        setCurrentTurn(candidate);
        setStatusLog(`Cả bàn bỏ lượt! ${PLAYER_NAMES[candidate]} được tự do ra bài mới.`);
      } else {
        setPassedPlayers(nextPassed);
        setLastPlay(nextLastPlay);
        setCurrentTurn(candidate);
      }
    },
    []
  );

  // Bot turn automation
  useEffect(() => {
    if (winner !== null || currentTurn === 0) return;

    const timer = window.setTimeout(() => {
      const botHand = hands[currentTurn];
      if (botHand.length === 0) return;

      let validMoves = findValidMoves(botHand, lastPlay ? lastPlay.combo : null);
      if (mustInclude3Spade) {
        const with3S = validMoves.filter((m) => m.some((c) => c.rank === 3 && c.suit === 0));
        if (with3S.length > 0) validMoves = with3S;
      }

      if (validMoves.length === 0) {
        // Bot passes
        const nextPassed = [...passedPlayers];
        nextPassed[currentTurn] = true;
        setStatusLog(`${PLAYER_NAMES[currentTurn]} bỏ lượt.`);
        advanceTurn(hands, nextPassed, currentTurn, lastPlay);
        return;
      }

      // Prefer multi-card combos when leading freely, otherwise smallest winning play
      let chosen = validMoves[0];
      if (!lastPlay) {
        const multi = validMoves.filter((m) => m.length >= 2);
        if (multi.length > 0) {
          multi.sort((a, b) => b.length - a.length || cardPower(a[0]) - cardPower(b[0]));
          chosen = multi[0];
        }
      } else {
        chosen = validMoves[0];
      }

      const combo = analyzeCombo(chosen)!;
      const chosenIds = new Set(chosen.map((c) => c.id));
      const updatedHand = botHand.filter((c) => !chosenIds.has(c.id));
      const nextHands = hands.map((h, i) => (i === currentTurn ? updatedHand : h));

      if (soundEnabled) playCardSound();
      setHands(nextHands);
      setMustInclude3Spade(false);

      const newPlay = { playerIndex: currentTurn, cards: sortCards(chosen), combo };
      setStatusLog(`${PLAYER_NAMES[currentTurn]} đánh ${combo.label}`);

      if (updatedHand.length === 0) {
        setLastPlay(newPlay);
        setWinner(currentTurn);
        if (soundEnabled) playWinSound();
        onToast(`${PLAYER_NAMES[currentTurn]} đã về nhất ván Tiến Lên!`, 'info');
        return;
      }

      advanceTurn(nextHands, passedPlayers, currentTurn, newPlay);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [currentTurn, hands, lastPlay, passedPlayers, winner, mustInclude3Spade, soundEnabled, advanceTurn, onToast]);

  const toggleSelectCard = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedCards = hands[0].filter((c) => selectedIds.includes(c.id));
  const selectedCombo = analyzeCombo(selectedCards);

  const handlePlayerPlay = () => {
    if (currentTurn !== 0 || winner !== null) return;
    if (!selectedCombo) {
      onToast('Bộ bài bạn chọn không hợp lệ!', 'warning');
      return;
    }
    if (mustInclude3Spade && !selectedCards.some((c) => c.rank === 3 && c.suit === 0)) {
      onToast('Lượt đầu tiên phải đánh kèm lá 3♠!', 'warning');
      return;
    }
    if (!canBeat(selectedCombo, lastPlay ? lastPlay.combo : null)) {
      onToast('Bài của bạn chưa đủ lớn để chặt bài trên bàn!', 'warning');
      return;
    }

    const chosenSet = new Set(selectedIds);
    const updatedHand = hands[0].filter((c) => !chosenSet.has(c.id));
    const nextHands = hands.map((h, i) => (i === 0 ? updatedHand : h));

    if (soundEnabled) playCardSound();
    setHands(nextHands);
    setSelectedIds([]);
    setMustInclude3Spade(false);

    const newPlay = { playerIndex: 0, cards: sortCards(selectedCards), combo: selectedCombo };
    setStatusLog(`Bạn đã đánh ${selectedCombo.label}`);

    if (updatedHand.length === 0) {
      setLastPlay(newPlay);
      setWinner(0);
      if (soundEnabled) playWinSound();
      onToast('Chúc mừng! Bạn đã về nhất Tiến Lên Miền Nam!', 'success');
      return;
    }

    advanceTurn(nextHands, passedPlayers, 0, newPlay);
  };

  const handlePlayerPass = () => {
    if (currentTurn !== 0 || !lastPlay || winner !== null) return;
    const nextPassed = [...passedPlayers];
    nextPassed[0] = true;
    setSelectedIds([]);
    setStatusLog('Bạn đã bỏ lượt.');
    advanceTurn(hands, nextPassed, 0, lastPlay);
  };

  const handleHint = () => {
    if (currentTurn !== 0 || winner !== null) return;
    let moves = findValidMoves(hands[0], lastPlay ? lastPlay.combo : null);
    if (mustInclude3Spade) {
      moves = moves.filter((m) => m.some((c) => c.rank === 3 && c.suit === 0));
    }
    if (moves.length === 0) {
      onToast('Không có nước đi hợp lệ — bạn cần bấm Bỏ lượt.', 'warning');
      return;
    }
    setSelectedIds(moves[0].map((c) => c.id));
  };

  const handleSortPlayerHand = () => {
    setHands((prev) => prev.map((h, i) => (i === 0 ? sortCards(h) : h)));
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-900/60 bg-[#0B3B24] shadow-2xl flex flex-col h-[600px]">
      {/* Table Top HUD */}
      <div className="px-4 py-2.5 bg-[#082B1A] border-b border-emerald-900/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-sm sm:text-base font-bold text-amber-300">
            Tiến Lên Miền Nam
          </h3>
          <span className="text-xs text-emerald-200/80">4 Người chơi · Luật Chuẩn</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className="p-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 transition-colors cursor-pointer"
            aria-label={soundEnabled ? 'Tắt âm thanh game' : 'Bật âm thanh game'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={startNewGame}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ván mới</span>
          </button>
        </div>
      </div>

      {/* Card Table Surface */}
      <div className="relative flex-1 flex flex-col justify-between p-3 sm:p-4 bg-[radial-gradient(circle_at_center,#125E3A_0%,#0A3621_100%)] overflow-hidden">
        {/* Opponents Row */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((idx) => {
            const isTurn = currentTurn === idx && winner === null;
            const isPass = passedPlayers[idx];
            return (
              <div
                key={idx}
                className={`rounded-xl px-2.5 py-2 border transition-colors text-center ${
                  isTurn
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-black/25 border-emerald-900/60 text-emerald-100'
                }`}
              >
                <p className="text-xs font-semibold truncate">{PLAYER_NAMES[idx]}</p>
                <p className="font-mono text-xs tabular-nums mt-0.5 text-emerald-300">
                  {hands[idx].length} lá {isPass ? '· Bỏ lượt' : isTurn ? '· Đang đánh' : ''}
                </p>
              </div>
            );
          })}
        </div>

        {/* Center Battle Zone */}
        <div className="my-auto flex flex-col items-center justify-center gap-2.5 py-3">
          {lastPlay ? (
            <>
              <div className="flex items-center justify-center flex-wrap gap-1.5">
                {lastPlay.cards.map((c) => (
                  <CardView key={c.id} card={c} compact />
                ))}
              </div>
              <p className="text-xs font-medium text-amber-200 bg-black/35 px-3 py-1 rounded-md">
                {PLAYER_NAMES[lastPlay.playerIndex]}: {lastPlay.combo.label}
              </p>
            </>
          ) : (
            <div className="px-4 py-3 rounded-xl border border-dashed border-emerald-700/60 text-xs text-emerald-200/80 text-center">
              Bàn trống — người tới lượt được đánh bộ bài bất kỳ
            </div>
          )}

          <p className="text-xs text-emerald-100/90 text-center font-medium">{statusLog}</p>
        </div>

        {/* Player Controls & Hand */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                  currentTurn === 0 && winner === null
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-black/35 text-emerald-200'
                }`}
              >
                {currentTurn === 0 && winner === null
                  ? 'Lượt của bạn'
                  : winner !== null
                    ? `${PLAYER_NAMES[winner]} Thắng!`
                    : `Chờ ${PLAYER_NAMES[currentTurn]}...`}
              </span>
              {selectedCombo && (
                <span className="text-xs text-amber-300 font-medium">
                  Đã chọn: {selectedCombo.label}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleSortPlayerHand}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/35 hover:bg-black/55 text-emerald-100 text-xs font-medium transition-colors cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Xếp bài</span>
              </button>
              <button
                type="button"
                onClick={handleHint}
                disabled={currentTurn !== 0 || winner !== null}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/35 hover:bg-black/55 disabled:opacity-40 text-amber-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gợi ý</span>
              </button>
              <button
                type="button"
                onClick={handlePlayerPass}
                disabled={currentTurn !== 0 || !lastPlay || winner !== null}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/85 hover:bg-rose-500 disabled:opacity-35 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Bỏ lượt</span>
              </button>
              <button
                type="button"
                onClick={handlePlayerPlay}
                disabled={currentTurn !== 0 || selectedIds.length === 0 || winner !== null}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                Đánh bài
              </button>
            </div>
          </div>

          {/* Player 13-Card Fan */}
          <div className="flex items-end justify-center flex-wrap gap-1 sm:gap-1.5 pt-3 pb-1 min-h-[92px]">
            {hands[0].map((card) => (
              <CardView
                key={card.id}
                card={card}
                selected={selectedIds.includes(card.id)}
                onClick={() => toggleSelectCard(card.id)}
              />
            ))}
          </div>
        </div>

        {/* Victory Overlay */}
        {winner !== null && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-4 z-20">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-display text-2xl font-bold text-white">
                {winner === 0 ? 'Bạn Đã Thắng!' : `${PLAYER_NAMES[winner]} Về Nhất!`}
              </h4>
              <p className="text-sm text-slate-300 mt-1">
                {winner === 0
                  ? 'Quá đỉnh! Hãy làm thêm ván nữa hoặc quay lại cầm mic nhé.'
                  : 'Chút nữa thôi! Chia bài lại làm ván mới phục thù nào.'}
              </p>
            </div>
            <button
              type="button"
              onClick={startNewGame}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
            >
              Chơi ván mới
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
