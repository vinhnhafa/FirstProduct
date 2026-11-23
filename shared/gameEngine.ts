export type Suit = 'spades' | 'clubs' | 'diamonds' | 'hearts';

export interface Card {
  id: string;
  rank: number; // 3..15 (11=J, 12=Q, 13=K, 14=A, 15=2)
  suit: Suit;
}

export type ComboType =
  | 'SINGLE'
  | 'PAIR'
  | 'TRIPLE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT'
  | 'THREE_PAIR_PINE'
  | 'FOUR_PAIR_PINE';

export interface CardCombo {
  type: ComboType;
  cards: Card[];
  highCard: Card;
  length: number;
}

const SUIT_WEIGHT: Record<Suit, number> = {
  spades: 0,
  clubs: 1,
  diamonds: 2,
  hearts: 3,
};

export function cardValue(card: Card): number {
  return card.rank * 4 + SUIT_WEIGHT[card.suit];
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => cardValue(a) - cardValue(b));
}

export function createShuffledDeck(): Card[] {
  const suits: Suit[] = ['spades', 'clubs', 'diamonds', 'hearts'];
  const deck: Card[] = [];
  for (let rank = 3; rank <= 15; rank++) {
    for (const suit of suits) {
      deck.push({ id: `${rank}-${suit}`, rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function evaluateCombo(rawCards: Card[]): CardCombo | null {
  if (rawCards.length === 0) return null;
  const cards = sortCards(rawCards);
  const n = cards.length;
  const highCard = cards[n - 1];

  if (n === 1) {
    return { type: 'SINGLE', cards, highCard, length: 1 };
  }

  if (n === 2 && cards[0].rank === cards[1].rank) {
    return { type: 'PAIR', cards, highCard, length: 2 };
  }

  if (n === 3 && cards.every((c) => c.rank === cards[0].rank)) {
    return { type: 'TRIPLE', cards, highCard, length: 3 };
  }

  if (n === 4 && cards.every((c) => c.rank === cards[0].rank)) {
    return { type: 'FOUR_OF_A_KIND', cards, highCard, length: 4 };
  }

  if (n === 6 && cards[0].rank === cards[1].rank && cards[2].rank === cards[3].rank && cards[4].rank === cards[5].rank) {
    const r0 = cards[0].rank;
    const r1 = cards[2].rank;
    const r2 = cards[4].rank;
    if (r2 < 15 && r1 === r0 + 1 && r2 === r1 + 1) {
      return { type: 'THREE_PAIR_PINE', cards, highCard, length: 6 };
    }
  }

  if (
    n === 8 &&
    cards[0].rank === cards[1].rank &&
    cards[2].rank === cards[3].rank &&
    cards[4].rank === cards[5].rank &&
    cards[6].rank === cards[7].rank
  ) {
    const r0 = cards[0].rank;
    const r1 = cards[2].rank;
    const r2 = cards[4].rank;
    const r3 = cards[6].rank;
    if (r3 < 15 && r1 === r0 + 1 && r2 === r1 + 1 && r3 === r2 + 1) {
      return { type: 'FOUR_PAIR_PINE', cards, highCard, length: 8 };
    }
  }

  if (n >= 3 && !cards.some((c) => c.rank === 15)) {
    let isSeq = true;
    for (let i = 1; i < n; i++) {
      if (cards[i].rank !== cards[i - 1].rank + 1) {
        isSeq = false;
        break;
      }
    }
    if (isSeq) {
      return { type: 'STRAIGHT', cards, highCard, length: n };
    }
  }

  return null;
}

export function canBeat(next: CardCombo, prev: CardCombo | null): boolean {
  if (!prev) return true;

  if (prev.type === 'SINGLE' && prev.highCard.rank === 15) {
    if (next.type === 'FOUR_OF_A_KIND' || next.type === 'THREE_PAIR_PINE' || next.type === 'FOUR_PAIR_PINE') {
      return true;
    }
  }

  if (prev.type === 'PAIR' && prev.highCard.rank === 15) {
    if (next.type === 'FOUR_OF_A_KIND' || next.type === 'FOUR_PAIR_PINE') {
      return true;
    }
  }

  if (prev.type === 'THREE_PAIR_PINE' && (next.type === 'FOUR_OF_A_KIND' || next.type === 'FOUR_PAIR_PINE')) {
    return true;
  }

  if (next.type !== prev.type) return false;
  if (next.type === 'STRAIGHT' && next.length !== prev.length) return false;

  return cardValue(next.highCard) > cardValue(prev.highCard);
}

export function checkCaroWin(board: Array<'X' | 'O' | null>, lastIndex: number): number[] | null {
  const size = 15;
  const player = board[lastIndex];
  if (!player) return null;

  const row = Math.floor(lastIndex / size);
  const col = lastIndex % size;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of dirs) {
    const line: number[] = [lastIndex];
    for (const sign of [-1, 1]) {
      let step = 1;
      while (true) {
        const nr = row + dr * step * sign;
        const nc = col + dc * step * sign;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
        const idx = nr * size + nc;
        if (board[idx] !== player) break;
        if (sign === -1) line.unshift(idx);
        else line.push(idx);
        step++;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}
