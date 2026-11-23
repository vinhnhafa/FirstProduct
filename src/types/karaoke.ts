export type Genre =
  | 'Tất cả'
  | 'Bolero'
  | 'Nhạc Trẻ'
  | 'Remix'
  | 'Nhạc Trữ Tình';

export type AppView = 'browse' | 'stage' | 'music' | 'rooms' | 'social';

export interface Song {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  genre: Exclude<Genre, 'Tất cả'>;
  durationSeconds: number;
  lyrics: string[];
  tone?: string;
  viewCountText?: string;
  publishedTimeText?: string;
  isKaraoke?: boolean;
}

export interface MusicTrack {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  genre: string;
  durationSeconds: number;
  viewCountText?: string;
  publishedTimeText?: string;
  isHot?: boolean;
  isNew?: boolean;
}

export interface ListeningHistoryItem {
  youtubeId: string;
  title: string;
  artist: string;
  genre: string;
  durationSeconds: number;
  viewCountText?: string;
  listenedAt: number;
  playCount: number;
}

export interface QueueItem {
  queueId: string;
  song: Song;
  addedAt: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

export type ChatRoomId = string;

export interface ChatUser {
  id: string;
  nickname: string;
  status: 'online' | 'singing' | 'busy';
  statusText: string;
}

export interface OnlineChatMember {
  id: string;
  nickname: string;
  roomId: string;
  roomName: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId?: string;
  sender: string;
  text: string;
  timestamp: string;
  color: string;
  isBold?: boolean;
  isItalic?: boolean;
  isBuzz?: boolean;
  isSystem?: boolean;
  sharedSong?: {
    title: string;
    artist: string;
    youtubeId: string;
  };
}

export interface PrivateChatMessage {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  text: string;
  timestamp: string;
  color: string;
  isBold?: boolean;
  isItalic?: boolean;
  isBuzz?: boolean;
  sharedSong?: {
    title: string;
    artist: string;
    youtubeId: string;
  };
}

export interface RoomMember {
  userId: string;
  name: string;
  isHost: boolean;
  isMicLive: boolean;
  heartsGiven: number;
  heartsReceived: number;
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  giftInfo?: {
    label: string;
    hearts: number;
  };
}

export interface LiveRoomSummary {
  id: string;
  code: string;
  name: string;
  hasPasscode: boolean;
  hostName: string;
  singerId: string | null;
  singerName: string | null;
  isMicLive: boolean;
  hasMixedMusic?: boolean;
  currentSong: Song;
  heartsTotal: number;
  memberCount: number;
}

export interface LiveRoomDetail {
  id: string;
  code: string;
  name: string;
  hasPasscode: boolean;
  hostId: string;
  hostName: string;
  singerId: string | null;
  singerName: string | null;
  singerRequests: string[];
  isMicLive: boolean;
  hasMixedMusic?: boolean;
  currentSong: Song;
  customLyrics: string[];
  activeLyricLine: number;
  isPlaying: boolean;
  positionSeconds: number;
  syncedAt: number;
  heartsTotal: number;
  members: RoomMember[];
  chat: RoomChatMessage[];
}

export interface WeeklyGifterEntry {
  userId: string;
  userName: string;
  heartsGiven: number;
  giftsCount: number;
  topSingerName: string;
  topGiftLabel: string;
  lastGiftAt: number;
}

export type GameType = 'tien-len' | 'caro';

export interface GameSeat {
  userId: string;
  userName: string;
  seatIndex: number;
  cardCount?: number;
  passed?: boolean;
}

export interface GameRoomSummary {
  id: string;
  code: string;
  name: string;
  gameType: GameType;
  maxPlayers: number;
  hostId: string;
  hostName: string;
  status: 'waiting' | 'playing' | 'finished';
  playerCount: number;
  spectatorCount: number;
  seats: GameSeat[];
}

export interface GameRoomDetail extends GameRoomSummary {
  spectators: Array<{ userId: string; userName: string }>;
  turnUserId: string | null;
  mustInclude3Spade: boolean;
  lastPlay: {
    userId: string;
    userName: string;
    cards: Array<{ id: string; rank: number; suit: 'spades' | 'clubs' | 'diamonds' | 'hearts' }>;
    type: string;
  } | null;
  caroBoard: Array<'X' | 'O' | null>;
  caroTurn: 'X' | 'O';
  caroLastMove: number | null;
  caroWinLine: number[] | null;
  winnerUserId: string | null;
  winnerName: string | null;
  isDraw: boolean;
  chat: Array<{ id: string; sender: string; text: string; timestamp: string }>;
}
