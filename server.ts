import express from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  type Card,
  type CardCombo,
  canBeat,
  checkCaroWin,
  createShuffledDeck,
  evaluateCombo,
  sortCards,
} from './shared/gameEngine.ts';
import {
  getVietnamChatRoom,
  resolveVietnamChatRoomId,
  VIETNAM_CHAT_ROOM_MAP,
} from './shared/vietnamChatRooms.ts';
import { KARAOKE_SONGS } from './shared/karaokeSongs.ts';
import { STARTER_MUSIC_TRACKS } from './shared/musicTracks.ts';
import {
  buildSongUrlPath,
  parseCommunityRoomPath,
  parseMediaUrlPath,
} from './shared/seoSlug.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomSong {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  genre: string;
  durationSeconds: number;
  lyrics: string[];
  tone?: string;
  viewCountText?: string;
  publishedTimeText?: string;
  isKaraoke?: boolean;
}

interface RoomMember {
  userId: string;
  name: string;
  isHost: boolean;
  isMicLive: boolean;
  heartsGiven: number;
  heartsReceived: number;
}

interface RoomChatMessage {
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

interface KaraokeRoom {
  id: string;
  code: string;
  name: string;
  passcode: string;
  hostId: string;
  hostName: string;
  singerId: string | null;
  singerName: string | null;
  singerRequests: string[];
  isMicLive: boolean;
  hasMixedMusic: boolean;
  currentSong: RoomSong;
  customLyrics: string[];
  activeLyricLine: number;
  isPlaying: boolean;
  positionSeconds: number;
  syncedAt: number;
  heartsTotal: number;
  members: Map<string, RoomMember>;
  chat: RoomChatMessage[];
  createdAt: number;
}

interface YmMessage {
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
  sharedSong?: {
    title: string;
    artist: string;
    youtubeId: string;
  };
}

interface YmPrivateMessage {
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

interface YmRoomTrack {
  trackId: string;
  youtubeId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  addedByUserId: string;
  addedByName: string;
  addedAt: number;
}

interface YmRoomMusicState {
  roomId: string;
  hostUserId: string | null;
  hostName: string | null;
  currentTrack: YmRoomTrack | null;
  playlist: YmRoomTrack[];
  isPlaying: boolean;
  positionSeconds: number;
  syncedAt: number;
}

interface ClientSession {
  ws: WebSocket;
  userId: string;
  userName: string;
  karaokeRoomId: string | null;
  ymRoomId: string | null;
  gameRoomId: string | null;
}

const DEFAULT_ROOM_SONG: RoomSong = {
  id: 'song-1',
  youtubeId: 'LPrOVzOHgZQ',
  title: 'Karaoke Sầu Tím Thiệp Hồng (Song Ca)',
  artist: 'Quang Lê & Lệ Quyên',
  genre: 'Bolero',
  durationSeconds: 295,
  tone: 'Song ca Nam / Nữ',
  isKaraoke: true,
  lyrics: [
    'Từ lúc quen nhau chưa nói một lời gì',
    'Tỏ tình ta mến nhau',
    'Nhiều đêm ngắm sao mờ, hồn lâng lâng giấc mơ',
    'Đời sẽ nên thơ nếu đừng dở dang...',
    'Chiều nay thiệp hồng trên tay, mất rồi ngày xanh',
    'Đau xót cho duyên mình, từ đây hết mong chờ',
    'Sầu tím thiệp hồng anh ơi, nỗi buồn nào nguôi...',
  ],
};

const HEART_PACKAGES: Record<string, { hearts: number; priceVnd: number; label: string }> = {
  pack_50: { hearts: 50, priceVnd: 10000, label: 'Gói 50 Tim' },
  pack_200: { hearts: 200, priceVnd: 35000, label: 'Gói 200 Tim' },
  pack_500: { hearts: 500, priceVnd: 79000, label: 'Gói 500 Tim' },
  pack_1000: { hearts: 1000, priceVnd: 150000, label: 'Gói Đại Gia 1.000 Tim' },
};

const GIFT_TIERS: Record<string, { hearts: number; label: string }> = {
  heart_1: { hearts: 1, label: 'Tim Yêu Thương' },
  rose_5: { hearts: 5, label: 'Hoa Hồng Đỏ' },
  crown_20: { hearts: 20, label: 'Vương Miện Ca Sĩ' },
  fireworks_50: { hearts: 50, label: 'Pháo Hoa Sân Khấu' },
};

// Track blocked / unembeddable / broken YouTube video IDs so they stay hidden
const blockedVideoIds = new Set<string>();
const verifiedEmbedIds = new Set<string>([
  'LPrOVzOHgZQ',
  'CZO9CbtOEmg',
  'NfGfaliF640',
  '6TvFRJixfM4',
  '7f7GZnm4AN8',
  't4rjaYhmazo',
  'iIsfYYw4b2A',
  '2MUfA2g87vo',
  'Vv2mtx5ZWwE',
  'ofUsAErzKKw',
  'H8qhY7rfflY',
  'z6HE1dr4S84',
  '_TozaOg109U',
  'wfk1ncPXOsc',
  'NzYaBnmECIo',
  '9jUNqo_oMBw',
  '2SyqfT06Tk0',
  'dd6WCCL-2Kg',
  'S3bOgUn9Fg4',
  'WaXpzNZw4jI',
  '0Ut2UceKVSQ',
  'mqsN8k2vWzs',
  '7m_zVBmNIas',
  'x1Dym_Xn0e8',
  '96B2zT5xq8c',
  'buK48Ot1K1c',
  'vkrbKs6bS1Y',
  'Rt6kP0q0TqE',
  'm8p6Y2FpUaU',
  'UWz-Oy5M8pc',
  '7Q5Et18-0BU',
  '1k6kScG-kcI',
  '_HUpk4c9n2Y',
  'oqKgI4mTUxk',
  'GlHTL-STO8o',
  'AHV2nRhm-QI',
  '7HJnPM3Ealo',
  'FqU62-YUaKE',
  'sSEYxqLsg28',
  '4Qdg85dDxyI',
]);

// In-memory cache for keyless YouTube search scraping (5 min TTL)
const ytSearchCache = new Map<string, { items: RoomSong[]; expiresAt: number }>();

function parseDurationText(text?: string): number {
  if (!text) return 240;
  const parts = text.trim().split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 240;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 240;
}

function isKaraokeTrack(title: string, channel: string): boolean {
  const hay = `${title} ${channel}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // Exclude official MV / non-karaoke uploads if title doesn't explicitly say karaoke/beat
  const hasExplicitKaraoke =
    titleLower.includes('karaoke') ||
    titleLower.includes('karafun') ||
    titleLower.includes('beat chuẩn') ||
    titleLower.includes('beat gốc') ||
    titleLower.includes('nhạc sống');

  if (
    !hasExplicitKaraoke &&
    (titleLower.includes('official music video') ||
      titleLower.includes('official mv') ||
      titleLower.includes('audio official') ||
      titleLower.includes('full album'))
  ) {
    return false;
  }

  const keywords = [
    'karaoke',
    'beat',
    'tone nam',
    'tone nữ',
    'tone nu',
    'nhạc sống',
    'nhac song',
    'instrumental',
    'karafun',
    'chữ chạy',
    'chu chay',
  ];
  return keywords.some((kw) => hay.includes(kw));
}

function inferTone(title: string): string | undefined {
  const lower = title.toLowerCase();
  if (lower.includes('song ca')) return 'Song ca Nam / Nữ';
  if (lower.includes('tone nữ') || lower.includes('tone nu')) return 'Tone Nữ';
  if (lower.includes('tone nam')) return 'Tone Nam';
  return undefined;
}

function inferGenre(title: string, requestedGenre: string, karaokeOnly = true): string {
  if (requestedGenre && requestedGenre !== 'Tất cả' && requestedGenre !== 'Tất cả thể loại') {
    return requestedGenre;
  }
  const lower = title.toLowerCase();
  if (!karaokeOnly) {
    if (lower.includes('thiền') || lower.includes('tĩnh tâm') || lower.includes('thư giãn')) {
      return 'Nhạc Thiền Thư Giãn';
    }
    if (lower.includes('quan họ') || lower.includes('dân ca')) return 'Dân Ca Quan Họ';
    if (lower.includes('nhạc sống')) return 'Nhạc Sống';
    if (lower.includes('lofi')) return 'Lofi Chill';
    if (lower.includes('acoustic') || lower.includes('cover')) return 'Nhạc Acoustic / Cover';
    if (lower.includes('nhạc hoa')) return 'Nhạc Hoa Lời Việt';
    if (lower.includes('remix')) return 'Nhạc Trữ Tình Remix';
    if (lower.includes('nhạc vàng') || lower.includes('trước 1975')) return 'Nhạc Vàng Xưa';
    if (lower.includes('bolero')) return 'Nhạc Bolero';
    if (lower.includes('trữ tình')) return 'Nhạc Trữ Tình';
    return 'Nhạc Trẻ Hot';
  }
  if (lower.includes('bolero') || lower.includes('nhạc vàng')) return 'Bolero';
  if (lower.includes('remix') || lower.includes('edm') || lower.includes('nhạc sàn')) return 'Remix';
  if (lower.includes('trữ tình') || lower.includes('quê hương') || lower.includes('trịnh')) {
    return 'Nhạc Trữ Tình';
  }
  return 'Nhạc Trẻ';
}

function extractBalancedJson(source: string, startBraceIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(startBraceIndex, i + 1);
      }
    }
  }
  return null;
}

function collectVideoRenderers(node: unknown, out: Array<Record<string, unknown>>) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.videoRenderer && typeof obj.videoRenderer === 'object') {
    out.push(obj.videoRenderer as Record<string, unknown>);
    return;
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') {
      collectVideoRenderers(val, out);
    }
  }
}

async function verifyVideoEmbeddable(videoId: string): Promise<boolean> {
  if (blockedVideoIds.has(videoId)) return false;
  if (verifiedEmbedIds.has(videoId)) return true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2400);
    const resp = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`
      )}&format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (resp.ok) {
      verifiedEmbedIds.add(videoId);
      return true;
    }
    // 401/403/404 from YouTube oEmbed means disabled embedding, private, or removed
    blockedVideoIds.add(videoId);
    return false;
  } catch {
    return false;
  }
}

async function searchYouTubeWithoutApiKey(
  rawQuery: string,
  genre: string,
  karaokeOnly: boolean,
  sort: 'all' | 'hot' | 'new' = 'all',
  musicOnly = false
): Promise<RoomSong[]> {
  const karaokeGenreQueries: Record<string, string> = {
    'Tất cả': 'karaoke nhạc việt beat chuẩn',
    Bolero: 'karaoke bolero beat chuẩn tone nam nữ',
    'Nhạc Trẻ': 'karaoke nhạc trẻ mới nhất beat chuẩn',
    Remix: 'karaoke remix nhạc sống beat chuẩn',
    'Nhạc Trữ Tình': 'karaoke nhạc trữ tình beat chuẩn',
  };

  const musicGenreQueries: Record<string, string> = {
    'Tất cả': 'tuyển chọn nhạc việt',
    'Tất cả thể loại': 'tuyển chọn nhạc việt',
    'Nhạc Trẻ Hot': 'nhạc trẻ vpop ballad',
    'Nhạc Bolero': 'liên khúc nhạc vàng bolero',
    'Nhạc Vàng Xưa': 'nhạc vàng xưa chọn lọc trước 1975',
    'Nhạc Trữ Tình': 'nhạc trữ tình quê hương',
    'Nhạc Sến': 'nhạc sến bolero hải ngoại',
    'Nhạc Trữ Tình Remix': 'nhạc trữ tình bolero remix',
    'Nhạc Sống': 'liên khúc nhạc sống bolero',
    'Dân Ca Quan Họ': 'dân ca quan họ bắc ninh',
    'Nhạc Thiền Thư Giãn': 'nhạc thiền tĩnh tâm thư giãn không quảng cáo',
    'Nhạc Acoustic / Cover': 'nhạc acoustic cover việt chill',
    'Lofi Chill': 'lofi chill nhạc việt nhẹ nhàng',
    'Nhạc Hoa Lời Việt': 'nhạc hoa lời việt bất hủ',
  };

  let query = rawQuery.trim();
  if (!query) {
    if (karaokeOnly) {
      query = karaokeGenreQueries[genre] || 'karaoke nhạc việt';
    } else {
      const base = musicGenreQueries[genre] || genre;
      if (sort === 'new') {
        query = `${base} mới nhất 2026`;
      } else if (sort === 'hot') {
        query = `${base} hay nhất nghe nhiều`;
      } else {
        query = `${base} hay nhất`;
      }
    }
  } else if (karaokeOnly && !query.toLowerCase().includes('karaoke') && !query.toLowerCase().includes('beat')) {
    query = `${query} karaoke`;
  } else if (!karaokeOnly) {
    if (sort === 'new' && !query.toLowerCase().includes('mới')) {
      query = `${query} mới nhất 2026`;
    } else if (sort === 'hot' && !query.toLowerCase().includes('hay nhất')) {
      query = `${query} hay nhất`;
    }
  }

  const cacheKey = `${query.toLowerCase()}|${genre}|${karaokeOnly}|${musicOnly}|${sort}`;
  const cached = ytSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items.filter((item) => !blockedVideoIds.has(item.youtubeId));
  }

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube HTTP ${response.status}`);
  }

  const html = await response.text();
  const markerIdx = html.indexOf('var ytInitialData = ');
  const altMarkerIdx = markerIdx === -1 ? html.indexOf('ytInitialData = ') : markerIdx;
  if (altMarkerIdx === -1) {
    return [];
  }

  const braceStart = html.indexOf('{', altMarkerIdx);
  if (braceStart === -1) return [];

  const jsonSlice = extractBalancedJson(html, braceStart);
  if (!jsonSlice) return [];

  const parsed = JSON.parse(jsonSlice) as unknown;
  const renderers: Array<Record<string, unknown>> = [];
  collectVideoRenderers(parsed, renderers);

  const seenIds = new Set<string>();
  const candidates: RoomSong[] = [];

  for (const v of renderers) {
    const videoId = String(v.videoId || '');
    if (!videoId || seenIds.has(videoId) || blockedVideoIds.has(videoId)) continue;
    seenIds.add(videoId);

    const titleObj = v.title as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
    const title = titleObj?.runs?.map((r) => r.text || '').join('') || titleObj?.simpleText || '';
    if (!title) continue;

    const ownerObj = v.ownerText as { runs?: Array<{ text?: string }> } | undefined;
    const channel = ownerObj?.runs?.[0]?.text || 'YouTube Music';

    const lengthObj = v.lengthText as { simpleText?: string } | undefined;
    const durationSeconds = parseDurationText(lengthObj?.simpleText);

    if (!lengthObj?.simpleText || durationSeconds < 45) continue;

    const karaokeFlag = isKaraokeTrack(title, channel);
    // Strict Karaoke-only enforcement (never let non-karaoke songs leak when karaokeOnly=true)
    if (karaokeOnly && !karaokeFlag) continue;

    // When room/music mode asks strictly for regular songs, exclude explicit karaoke/beat videos unless searched intentionally
    const rawLower = rawQuery.trim().toLowerCase();
    const titleLower = title.toLowerCase();
    if (
      musicOnly &&
      !karaokeOnly &&
      !rawLower.includes('karaoke') &&
      (titleLower.includes('karaoke') ||
        titleLower.includes('karafun') ||
        titleLower.includes('beat chuẩn') ||
        titleLower.includes('không lời') ||
        titleLower.includes('instrumental'))
    ) {
      continue;
    }

    const viewObj = v.shortViewCountText as { simpleText?: string } | undefined;
    const viewCountText = viewObj?.simpleText || '';

    const pubObj = v.publishedTimeText as { simpleText?: string } | undefined;
    const publishedTimeText = pubObj?.simpleText || '';

    candidates.push({
      id: `yt-${videoId}`,
      youtubeId: videoId,
      title,
      artist: channel,
      genre: inferGenre(title, genre, karaokeOnly),
      durationSeconds,
      tone: karaokeOnly ? inferTone(title) : undefined,
      viewCountText,
      publishedTimeText,
      isKaraoke: karaokeFlag,
      lyrics: [
        `Đang phát: ${title}`,
        `Kênh phát hành: ${channel}`,
      ],
    });
  }

  // Verify embeddability & availability via YouTube oEmbed in parallel so broken/unembeddable videos are hidden!
  const topSlice = candidates.slice(0, karaokeOnly ? 18 : 22);
  const checks = await Promise.all(
    topSlice.map(async (song) => ({
      song,
      ok: await verifyVideoEmbeddable(song.youtubeId),
    }))
  );

  const verifiedItems = checks.filter((c) => c.ok).map((c) => c.song);
  if (verifiedItems.length > 0) {
    ytSearchCache.set(cacheKey, { items: verifiedItems, expiresAt: Date.now() + 5 * 60 * 1000 });
  }
  return verifiedItems;
}

interface WeeklyGifterStat {
  userId: string;
  userName: string;
  heartsGiven: number;
  giftsCount: number;
  topSingerName: string;
  topGiftLabel: string;
  lastGiftAt: number;
}

// Server-authoritative state
const wallets = new Map<string, number>();
const rooms = new Map<string, KaraokeRoom>();
const clients = new Map<string, ClientSession>();
const weeklyGiftLeaderboard = new Map<string, WeeklyGifterStat>([
  [
    'patron-1',
    {
      userId: 'patron-1',
      userName: 'minh_quan_vip',
      heartsGiven: 420,
      giftsCount: 14,
      topSingerName: 'MC Tuấn Vũ',
      topGiftLabel: 'Pháo Hoa Sân Khấu',
      lastGiftAt: Date.now() - 1000 * 60 * 18,
    },
  ],
  [
    'patron-2',
    {
      userId: 'patron-2',
      userName: 'ngoc_lan_9x',
      heartsGiven: 265,
      giftsCount: 11,
      topSingerName: 'DJ Thanh Hằng',
      topGiftLabel: 'Vương Miện Ca Sĩ',
      lastGiftAt: Date.now() - 1000 * 60 * 42,
    },
  ],
  [
    'patron-3',
    {
      userId: 'patron-3',
      userName: 'hoang_tuan_sg',
      heartsGiven: 145,
      giftsCount: 9,
      topSingerName: 'MC Tuấn Vũ',
      topGiftLabel: 'Vương Miện Ca Sĩ',
      lastGiftAt: Date.now() - 1000 * 60 * 75,
    },
  ],
  [
    'patron-4',
    {
      userId: 'patron-4',
      userName: 'thao_vy_bolero',
      heartsGiven: 85,
      giftsCount: 7,
      topSingerName: 'Ca sĩ Ngọc Mai',
      topGiftLabel: 'Hoa Hồng Đỏ',
      lastGiftAt: Date.now() - 1000 * 60 * 130,
    },
  ],
  [
    'patron-5',
    {
      userId: 'patron-5',
      userName: 'hai_dang_kara',
      heartsGiven: 45,
      giftsCount: 5,
      topSingerName: 'DJ Thanh Hằng',
      topGiftLabel: 'Hoa Hồng Đỏ',
      lastGiftAt: Date.now() - 1000 * 60 * 210,
    },
  ],
]);

function getWeeklyLeaderboardEntries(): WeeklyGifterStat[] {
  return Array.from(weeklyGiftLeaderboard.values())
    .sort((a, b) => {
      if (b.heartsGiven !== a.heartsGiven) return b.heartsGiven - a.heartsGiven;
      if (b.giftsCount !== a.giftsCount) return b.giftsCount - a.giftsCount;
      return b.lastGiftAt - a.lastGiftAt;
    })
    .slice(0, 20);
}

const monthlyGiftLeaderboard = new Map<string, WeeklyGifterStat>([
  [
    'patron-1',
    {
      userId: 'patron-1',
      userName: 'minh_quan_vip',
      heartsGiven: 1680,
      giftsCount: 52,
      topSingerName: 'MC Tuấn Vũ',
      topGiftLabel: 'Pháo Hoa Sân Khấu',
      lastGiftAt: Date.now() - 1000 * 60 * 18,
    },
  ],
  [
    'patron-month-0',
    {
      userId: 'patron-month-0',
      userName: 'thanh_phong_hcm',
      heartsGiven: 1420,
      giftsCount: 44,
      topSingerName: 'Ca sĩ Ngọc Mai',
      topGiftLabel: 'Pháo Hoa Sân Khấu',
      lastGiftAt: Date.now() - 1000 * 60 * 60 * 26,
    },
  ],
  [
    'patron-2',
    {
      userId: 'patron-2',
      userName: 'ngoc_lan_9x',
      heartsGiven: 980,
      giftsCount: 38,
      topSingerName: 'DJ Thanh Hằng',
      topGiftLabel: 'Vương Miện Ca Sĩ',
      lastGiftAt: Date.now() - 1000 * 60 * 42,
    },
  ],
  [
    'patron-month-1',
    {
      userId: 'patron-month-1',
      userName: 'anh_khoa_danang',
      heartsGiven: 740,
      giftsCount: 29,
      topSingerName: 'MC Tuấn Vũ',
      topGiftLabel: 'Vương Miện Ca Sĩ',
      lastGiftAt: Date.now() - 1000 * 60 * 60 * 50,
    },
  ],
  [
    'patron-3',
    {
      userId: 'patron-3',
      userName: 'hoang_tuan_sg',
      heartsGiven: 590,
      giftsCount: 24,
      topSingerName: 'MC Tuấn Vũ',
      topGiftLabel: 'Vương Miện Ca Sĩ',
      lastGiftAt: Date.now() - 1000 * 60 * 75,
    },
  ],
  [
    'patron-4',
    {
      userId: 'patron-4',
      userName: 'thao_vy_bolero',
      heartsGiven: 340,
      giftsCount: 19,
      topSingerName: 'Ca sĩ Ngọc Mai',
      topGiftLabel: 'Hoa Hồng Đỏ',
      lastGiftAt: Date.now() - 1000 * 60 * 130,
    },
  ],
  [
    'patron-5',
    {
      userId: 'patron-5',
      userName: 'hai_dang_kara',
      heartsGiven: 215,
      giftsCount: 15,
      topSingerName: 'DJ Thanh Hằng',
      topGiftLabel: 'Hoa Hồng Đỏ',
      lastGiftAt: Date.now() - 1000 * 60 * 210,
    },
  ],
]);

function getMonthlyLeaderboardEntries(): WeeklyGifterStat[] {
  return Array.from(monthlyGiftLeaderboard.values())
    .sort((a, b) => {
      if (b.heartsGiven !== a.heartsGiven) return b.heartsGiven - a.heartsGiven;
      if (b.giftsCount !== a.giftsCount) return b.giftsCount - a.giftsCount;
      return b.lastGiftAt - a.lastGiftAt;
    })
    .slice(0, 20);
}

function recordWeeklyHeartGift(
  userId: string,
  userName: string,
  hearts: number,
  singerName: string,
  giftLabel: string
) {
  const now = Date.now();
  const upsert = (targetMap: Map<string, WeeklyGifterStat>) => {
    const existing = targetMap.get(userId);
    if (existing) {
      existing.userName = userName;
      existing.heartsGiven += hearts;
      existing.giftsCount += 1;
      existing.topSingerName = singerName;
      existing.topGiftLabel = giftLabel;
      existing.lastGiftAt = now;
    } else {
      targetMap.set(userId, {
        userId,
        userName,
        heartsGiven: hearts,
        giftsCount: 1,
        topSingerName: singerName,
        topGiftLabel: giftLabel,
        lastGiftAt: now,
      });
    }
  };
  upsert(weeklyGiftLeaderboard);
  upsert(monthlyGiftLeaderboard);
}

function broadcastWeeklyLeaderboard() {
  const entries = getWeeklyLeaderboardEntries();
  const monthlyEntries = getMonthlyLeaderboardEntries();
  for (const client of clients.values()) {
    sendJson(client.ws, 'leaderboard:hearts_updated', { entries, monthlyEntries });
  }
}
const ymHistory = new Map<string, YmMessage[]>([
  [
    'nhac-tre',
    [
      {
        id: 'ym-init-1',
        roomId: 'nhac-tre',
        sender: 'Quản Trị Phòng',
        text: 'Chào mừng đến phòng Yahoo Nhạc Trẻ! Bạn có thể gửi BUZZ! hoặc chia sẻ bài hát đang nghe.',
        timestamp: '20:00',
        color: '#FBBF24',
      },
    ],
  ],
  [
    'bolero',
    [
      {
        id: 'ym-init-2',
        roomId: 'bolero',
        sender: 'Quản Trị Phòng',
        text: 'Phòng Bolero Sầu Tím — nơi giao lưu những giọng ca trữ tình.',
        timestamp: '20:00',
        color: '#C084FC',
      },
    ],
  ],
  [
    'remix',
    [
      {
        id: 'ym-init-3',
        roomId: 'remix',
        sender: 'Quản Trị Phòng',
        text: 'Phòng Quẩy Remix sẵn sàng lên nhạc cùng anh em!',
        timestamp: '20:00',
        color: '#34D399',
      },
    ],
  ],
  [
    'game-thu',
    [
      {
        id: 'ym-init-4',
        roomId: 'game-thu',
        sender: 'Quản Trị Phòng',
        text: 'Phòng Cao Thủ Game — bàn luận Tiến Lên Miền Nam & Cờ Caro.',
        timestamp: '20:00',
        color: '#38BDF8',
      },
    ],
  ],
]);

const ymPrivateHistory = new Map<string, YmPrivateMessage[]>();

function getDmKey(userA: string, userB: string): string {
  return [userA, userB].sort().join('::');
}

function ensureYmRoomHistory(roomId: string): YmMessage[] {
  const existing = ymHistory.get(roomId);
  if (existing) return existing;
  const def = getVietnamChatRoom(roomId);
  const initial: YmMessage[] = [
    {
      id: `ym-init-${roomId}`,
      roomId,
      sender: 'Quản Trị Phòng',
      text: `Chào mừng đến ${def.name} (${def.group})! Chủ phòng điều khiển nhạc nền, còn mọi thành viên đều có thể thêm bài hát hợp gu phòng.`,
      timestamp: nowTimeStr(),
      color: '#FBBF24',
    },
  ];
  ymHistory.set(roomId, initial);
  return initial;
}

const ymRoomStates = new Map<string, YmRoomMusicState>();

function buildInitialTracksForYmRoom(roomId: string): YmRoomTrack[] {
  const def = getVietnamChatRoom(roomId);
  const g = def.suggestedGenre.toLowerCase();

  let matched = STARTER_MUSIC_TRACKS.filter((track) => {
    const tg = track.genre.toLowerCase();
    if (tg === g) return true;
    if (g.includes('bolero') && (tg.includes('bolero') || tg.includes('nhạc vàng'))) return true;
    if (g.includes('vàng') && (tg.includes('nhạc vàng') || tg.includes('bolero'))) return true;
    if (g.includes('sến') && (tg.includes('nhạc sến') || tg.includes('bolero'))) return true;
    if (g.includes('trữ tình') && (tg.includes('trữ tình') || tg.includes('bolero'))) return true;
    if (g.includes('remix') && tg.includes('remix')) return true;
    if (g.includes('lofi') && (tg.includes('lofi') || tg.includes('acoustic'))) return true;
    if (g.includes('acoustic') && (tg.includes('acoustic') || tg.includes('lofi'))) return true;
    return false;
  });

  if (matched.length < 3) {
    const seen = new Set(matched.map((t) => t.youtubeId));
    const extras = STARTER_MUSIC_TRACKS.filter((t) => !seen.has(t.youtubeId));
    matched = [...matched, ...extras];
  }

  return matched.slice(0, 3).map((song, idx) => ({
    trackId: `seed-${roomId}-${idx}-${song.youtubeId}`,
    youtubeId: song.youtubeId,
    title: song.title,
    artist: song.artist,
    durationSeconds: song.durationSeconds,
    addedByUserId: 'system-seed',
    addedByName: 'Gợi ý theo phòng',
    addedAt: Date.now() + idx,
  }));
}

function ensureYmRoomMusicState(roomId: string): YmRoomMusicState {
  const existing = ymRoomStates.get(roomId);
  if (existing) return existing;
  const seeded = buildInitialTracksForYmRoom(roomId);
  const state: YmRoomMusicState = {
    roomId,
    hostUserId: null,
    hostName: null,
    currentTrack: seeded[0] ?? null,
    playlist: seeded,
    isPlaying: false,
    positionSeconds: 0,
    syncedAt: Date.now(),
  };
  ymRoomStates.set(roomId, state);
  return state;
}

function getPrivateThreadsForUser(userId: string) {
  const threads: Array<{ peerId: string; peerName: string; messages: YmPrivateMessage[] }> = [];
  for (const [key, messages] of ymPrivateHistory.entries()) {
    const [a, b] = key.split('::');
    if (a !== userId && b !== userId) continue;
    const peerId = a === userId ? b : a;
    const lastWithPeer = [...messages].reverse().find(
      (m) => m.fromUserId === peerId || m.toUserId === peerId
    );
    const livePeer = clients.get(peerId);
    const peerName =
      livePeer?.userName ||
      (lastWithPeer
        ? lastWithPeer.fromUserId === peerId
          ? lastWithPeer.fromName
          : lastWithPeer.toName
        : 'Thành viên');
    threads.push({ peerId, peerName, messages: messages.slice(-80) });
  }
  return threads;
}

function seedStarterRooms() {
  const starter1: KaraokeRoom = {
    id: 'room-bolero-vip',
    code: 'BOLERO',
    name: 'Phòng Hát Bolero Đêm Khuya',
    passcode: '',
    hostId: 'system-host-1',
    hostName: 'MC Tuấn Vũ',
    singerId: null,
    singerName: null,
    singerRequests: [],
    isMicLive: false,
    hasMixedMusic: false,
    currentSong: DEFAULT_ROOM_SONG,
    customLyrics: DEFAULT_ROOM_SONG.lyrics,
    activeLyricLine: 0,
    isPlaying: false,
    positionSeconds: 0,
    syncedAt: Date.now(),
    heartsTotal: 128,
    members: new Map(),
    chat: [
      {
        id: 'rc-1',
        senderId: 'system',
        senderName: 'Hệ thống',
        text: 'Chủ phòng có thể chọn thành viên lên hát, bật Mic kèm Echo & trộn nhạc YouTube trực tiếp tới cả phòng!',
        timestamp: '20:00',
      },
    ],
    createdAt: Date.now(),
  };

  const starter2: KaraokeRoom = {
    id: 'room-vpop-live',
    code: 'VPOP99',
    name: 'Phòng Nhạc Trẻ & Song Ca',
    passcode: '',
    hostId: 'system-host-2',
    hostName: 'DJ Minh Anh',
    singerId: null,
    singerName: null,
    singerRequests: [],
    isMicLive: false,
    hasMixedMusic: false,
    currentSong: {
      id: 'song-6',
      youtubeId: 't4rjaYhmazo',
      title: 'Karaoke Nơi Này Có Anh (Beat Hạ Tông)',
      artist: 'Sơn Tùng M-TP · NTV Karaoke',
      genre: 'Nhạc Trẻ',
      durationSeconds: 262,
      tone: 'Tone Nam',
      isKaraoke: true,
      lyrics: [
        'Em là ai từ đâu bước đến nơi đây dịu dàng chân phương',
        'Em là ai tựa như ánh nắng ban mai ngọt ngào trong sương',
        'Cầm tay anh, dựa vai anh, kề bên anh nơi này có anh',
        'Gió mang câu tình ca, ngàn ánh sao vụt qua, nhẹ ôm lấy em',
      ],
    },
    customLyrics: [
      'Em là ai từ đâu bước đến nơi đây dịu dàng chân phương',
      'Em là ai tựa như ánh nắng ban mai ngọt ngào trong sương',
      'Cầm tay anh, dựa vai anh, kề bên anh nơi này có anh',
      'Gió mang câu tình ca, ngàn ánh sao vụt qua, nhẹ ôm lấy em',
    ],
    activeLyricLine: 0,
    isPlaying: false,
    positionSeconds: 0,
    syncedAt: Date.now(),
    heartsTotal: 86,
    members: new Map(),
    chat: [
      {
        id: 'rc-2',
        senderId: 'system',
        senderName: 'Hệ thống',
        text: 'Hãy đăng ký hát, bật Mic phát trực tiếp hoặc thả Tim cổ vũ người đang hát nhé!',
        timestamp: '20:00',
      },
    ],
    createdAt: Date.now(),
  };

  rooms.set(starter1.id, starter1);
  rooms.set(starter2.id, starter2);
}

seedStarterRooms();

// --- MULTIPLAYER GAME ROOMS (REAL PLAYERS ONLY, SERVER-AUTHORITATIVE) ---
interface ServerGameSeat {
  userId: string;
  userName: string;
  seatIndex: number;
}

interface ServerGameRoom {
  id: string;
  code: string;
  name: string;
  gameType: 'tien-len' | 'caro';
  maxPlayers: number;
  hostId: string;
  hostName: string;
  status: 'waiting' | 'playing' | 'finished';
  seats: ServerGameSeat[];
  spectators: Array<{ userId: string; userName: string }>;
  hands: Map<string, Card[]>;
  passedUserIds: Set<string>;
  turnUserId: string | null;
  lastPlay: { userId: string; userName: string; combo: CardCombo } | null;
  mustInclude3Spade: boolean;
  caroBoard: Array<'X' | 'O' | null>;
  caroTurn: 'X' | 'O';
  caroLastMove: number | null;
  caroWinLine: number[] | null;
  winnerUserId: string | null;
  winnerName: string | null;
  isDraw: boolean;
  chat: Array<{ id: string; sender: string; text: string; timestamp: string }>;
  createdAt: number;
}

const gameRooms = new Map<string, ServerGameRoom>();

function seedStarterGameRooms() {
  const presets: Array<{ id: string; code: string; name: string; gameType: 'tien-len' | 'caro'; maxPlayers: number }> = [
    { id: 'g-tienlen-1', code: 'TL0001', name: 'Bàn Tiến Lên #1 — Giao Lưu 4 Người', gameType: 'tien-len', maxPlayers: 4 },
    { id: 'g-tienlen-2', code: 'TL0002', name: 'Bàn Tiến Lên #2 — Đấu Nhanh', gameType: 'tien-len', maxPlayers: 4 },
    { id: 'g-caro-1', code: 'CR0001', name: 'Bàn Cờ Caro #1 — Thách Đấu 1v1', gameType: 'caro', maxPlayers: 2 },
    { id: 'g-caro-2', code: 'CR0002', name: 'Bàn Cờ Caro #2 — Giao Lưu', gameType: 'caro', maxPlayers: 2 },
  ];

  for (const p of presets) {
    gameRooms.set(p.id, {
      id: p.id,
      code: p.code,
      name: p.name,
      gameType: p.gameType,
      maxPlayers: p.maxPlayers,
      hostId: 'system-table',
      hostName: 'Bàn mở',
      status: 'waiting',
      seats: [],
      spectators: [],
      hands: new Map(),
      passedUserIds: new Set(),
      turnUserId: null,
      lastPlay: null,
      mustInclude3Spade: false,
      caroBoard: Array(225).fill(null),
      caroTurn: 'X',
      caroLastMove: null,
      caroWinLine: null,
      winnerUserId: null,
      winnerName: null,
      isDraw: false,
      chat: [],
      createdAt: Date.now(),
    });
  }
}

seedStarterGameRooms();

function serializeGameRoomSummary(room: ServerGameRoom) {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    gameType: room.gameType,
    maxPlayers: room.maxPlayers,
    hostId: room.hostId,
    hostName: room.hostName,
    status: room.status,
    playerCount: room.seats.length,
    spectatorCount: room.spectators.length,
    seats: room.seats.map((s) => ({
      userId: s.userId,
      userName: s.userName,
      seatIndex: s.seatIndex,
      cardCount: room.hands.get(s.userId)?.length ?? 0,
      passed: room.passedUserIds.has(s.userId),
    })),
  };
}

function serializeGameRoomDetail(room: ServerGameRoom) {
  return {
    ...serializeGameRoomSummary(room),
    spectators: room.spectators,
    turnUserId: room.turnUserId,
    mustInclude3Spade: room.mustInclude3Spade,
    lastPlay: room.lastPlay
      ? {
          userId: room.lastPlay.userId,
          userName: room.lastPlay.userName,
          cards: room.lastPlay.combo.cards,
          type: room.lastPlay.combo.type,
        }
      : null,
    caroBoard: room.caroBoard,
    caroTurn: room.caroTurn,
    caroLastMove: room.caroLastMove,
    caroWinLine: room.caroWinLine,
    winnerUserId: room.winnerUserId,
    winnerName: room.winnerName,
    isDraw: room.isDraw,
    chat: room.chat.slice(-40),
  };
}

function broadcastGameRoomList() {
  const list = Array.from(gameRooms.values()).map(serializeGameRoomSummary);
  for (const client of clients.values()) {
    sendJson(client.ws, 'game:list', { rooms: list });
  }
}

function broadcastGameRoom(room: ServerGameRoom) {
  const detail = serializeGameRoomDetail(room);
  for (const client of clients.values()) {
    if (client.gameRoomId === room.id) {
      sendJson(client.ws, 'game:room_state', { room: detail });
      if (room.gameType === 'tien-len') {
        const hand = room.hands.get(client.userId) || [];
        sendJson(client.ws, 'game:private_hand', { roomId: room.id, hand });
      }
    }
  }
}

function joinServerGameRoom(room: ServerGameRoom, userId: string, userName: string) {
  const existingSeat = room.seats.find((s) => s.userId === userId);
  if (existingSeat) {
    existingSeat.userName = userName;
    if (room.hostId === userId) room.hostName = userName;
    return;
  }

  room.spectators = room.spectators.filter((sp) => sp.userId !== userId);

  if (room.seats.length < room.maxPlayers && room.status !== 'playing') {
    const usedIndices = new Set(room.seats.map((s) => s.seatIndex));
    let seatIndex = 0;
    while (usedIndices.has(seatIndex)) seatIndex++;
    room.seats.push({ userId, userName, seatIndex });
    room.seats.sort((a, b) => a.seatIndex - b.seatIndex);
    if (room.hostId === 'system-table' || room.seats.length === 1) {
      room.hostId = userId;
      room.hostName = userName;
    }
  } else {
    room.spectators.push({ userId, userName });
  }
}

function leaveServerGameRoom(session: ClientSession) {
  if (!session.gameRoomId) return;
  const room = gameRooms.get(session.gameRoomId);
  session.gameRoomId = null;
  if (!room) return;

  const wasSeated = room.seats.some((s) => s.userId === session.userId);
  room.seats = room.seats.filter((s) => s.userId !== session.userId);
  room.spectators = room.spectators.filter((s) => s.userId !== session.userId);
  room.hands.delete(session.userId);
  room.passedUserIds.delete(session.userId);

  if (room.hostId === session.userId) {
    if (room.seats.length > 0) {
      room.hostId = room.seats[0].userId;
      room.hostName = room.seats[0].userName;
    } else {
      room.hostId = 'system-table';
      room.hostName = 'Bàn mở';
    }
  }

  if (wasSeated && room.status === 'playing' && room.seats.length < 2) {
    room.status = 'waiting';
    room.turnUserId = null;
    room.lastPlay = null;
    room.hands.clear();
    room.passedUserIds.clear();
    room.caroBoard = Array(225).fill(null);
    room.caroLastMove = null;
    room.caroWinLine = null;
    room.chat.push({
      id: `gc-${Date.now()}`,
      sender: 'Hệ thống',
      text: `${session.userName} đã rời bàn. Ván đấu tạm dừng để chờ đủ người chơi.`,
      timestamp: nowTimeStr(),
    });
  } else if (wasSeated && room.status === 'playing' && room.turnUserId === session.userId) {
    const nextSeat = room.seats.find((s) => !room.passedUserIds.has(s.userId)) || room.seats[0];
    room.turnUserId = nextSeat?.userId || null;
  }

  broadcastGameRoom(room);
  broadcastGameRoomList();
}

function startGameInRoom(room: ServerGameRoom) {
  room.winnerUserId = null;
  room.winnerName = null;
  room.isDraw = false;
  room.status = 'playing';

  if (room.gameType === 'caro') {
    room.caroBoard = Array(225).fill(null);
    room.caroTurn = 'X';
    room.caroLastMove = null;
    room.caroWinLine = null;
    room.turnUserId = room.seats[0]?.userId || null;
    room.chat.push({
      id: `gc-${Date.now()}`,
      sender: 'Hệ thống',
      text: `Ván Cờ Caro bắt đầu! ${room.seats[0]?.userName || 'X'} đi quân X trước.`,
      timestamp: nowTimeStr(),
    });
    return;
  }

  // Tiến Lên Miền Nam: Deal 13 cards per seated real player
  const deck = createShuffledDeck();
  room.hands.clear();
  room.passedUserIds.clear();
  room.lastPlay = null;

  let starterUserId = room.seats[0].userId;
  let has3SpadeGlobal = false;

  room.seats.forEach((seat, idx) => {
    const hand = sortCards(deck.slice(idx * 13, (idx + 1) * 13));
    room.hands.set(seat.userId, hand);
    if (hand.some((c) => c.rank === 3 && c.suit === 'spades')) {
      starterUserId = seat.userId;
      has3SpadeGlobal = true;
    }
  });

  room.mustInclude3Spade = has3SpadeGlobal;
  room.turnUserId = starterUserId;
  const starterName = room.seats.find((s) => s.userId === starterUserId)?.userName || 'Người chơi';
  room.chat.push({
    id: `gc-${Date.now()}`,
    sender: 'Hệ thống',
    text: `Đã chia bài cho ${room.seats.length} người chơi! ${starterName} đánh trước.`,
    timestamp: nowTimeStr(),
  });
}

function getOrInitWallet(userId: string): number {
  if (!wallets.has(userId)) {
    wallets.set(userId, 30);
  }
  return wallets.get(userId) ?? 30;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function serializeRoomSummary(room: KaraokeRoom) {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    hasPasscode: room.passcode.length > 0,
    hostName: room.hostName,
    singerId: room.singerId,
    singerName: room.singerName,
    isMicLive: room.isMicLive,
    hasMixedMusic: room.hasMixedMusic,
    currentSong: room.currentSong,
    heartsTotal: room.heartsTotal,
    memberCount: room.members.size,
  };
}

function serializeRoomDetail(room: KaraokeRoom) {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    hasPasscode: room.passcode.length > 0,
    hostId: room.hostId,
    hostName: room.hostName,
    singerId: room.singerId,
    singerName: room.singerName,
    singerRequests: room.singerRequests,
    isMicLive: room.isMicLive,
    hasMixedMusic: room.hasMixedMusic,
    currentSong: room.currentSong,
    customLyrics: room.customLyrics,
    activeLyricLine: room.activeLyricLine,
    isPlaying: room.isPlaying,
    positionSeconds: room.positionSeconds,
    syncedAt: room.syncedAt,
    heartsTotal: room.heartsTotal,
    members: Array.from(room.members.values()),
    chat: room.chat.slice(-60),
  };
}

function sendJson(ws: WebSocket, type: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcastRoom(roomId: string, type: string, payload: unknown, excludeUserId?: string) {
  for (const session of clients.values()) {
    if (session.karaokeRoomId === roomId && session.userId !== excludeUserId) {
      sendJson(session.ws, type, payload);
    }
  }
}

function broadcastRoomList() {
  const summaries = Array.from(rooms.values()).map(serializeRoomSummary);
  for (const session of clients.values()) {
    sendJson(session.ws, 'rooms:list', { rooms: summaries });
  }
}

function broadcastYmRoom(roomId: string, type: string, payload: unknown) {
  for (const session of clients.values()) {
    if (session.ymRoomId === roomId) {
      sendJson(session.ws, type, payload);
    }
  }
}

function getYmRoomUsers(roomId: string): Array<{ id: string; nickname: string }> {
  const users: Array<{ id: string; nickname: string }> = [];
  for (const session of clients.values()) {
    if (session.ymRoomId === roomId) {
      users.push({ id: session.userId, nickname: session.userName });
    }
  }
  return users;
}

function broadcastYmRoomMusic(roomId: string) {
  const state = ensureYmRoomMusicState(roomId);
  broadcastYmRoom(roomId, 'ym:music_state', { state });
}

function leaveYmRoom(session: ClientSession) {
  const prevRoom = session.ymRoomId;
  if (!prevRoom) return;
  session.ymRoomId = null;

  const remainingUsers = getYmRoomUsers(prevRoom);
  const state = ymRoomStates.get(prevRoom);
  if (state && state.hostUserId === session.userId) {
    if (remainingUsers.length > 0) {
      state.hostUserId = remainingUsers[0].id;
      state.hostName = remainingUsers[0].nickname;
    } else {
      state.hostUserId = null;
      state.hostName = null;
      state.isPlaying = false;
    }
    broadcastYmRoomMusic(prevRoom);
  }

  broadcastYmRoom(prevRoom, 'ym:presence', {
    roomId: prevRoom,
    users: remainingUsers,
  });
}

function broadcastYmDirectory() {
  const roomCounts: Record<string, number> = {};
  const onlineUsers: Array<{ id: string; nickname: string; roomId: string; roomName: string }> = [];
  for (const session of clients.values()) {
    const rid = session.ymRoomId;
    if (rid) {
      roomCounts[rid] = (roomCounts[rid] || 0) + 1;
    }
    onlineUsers.push({
      id: session.userId,
      nickname: session.userName,
      roomId: rid || '',
      roomName: rid ? getVietnamChatRoom(rid).shortName : 'Sảnh chờ',
    });
  }

  const roomSummaries: Record<
    string,
    {
      count: number;
      hostName: string | null;
      currentTrackTitle: string | null;
      isPlaying: boolean;
      playlistCount: number;
    }
  > = {};

  for (const [rid, count] of Object.entries(roomCounts)) {
    const st = ymRoomStates.get(rid);
    roomSummaries[rid] = {
      count,
      hostName: st?.hostName || null,
      currentTrackTitle: st?.currentTrack?.title || null,
      isPlaying: Boolean(st?.isPlaying),
      playlistCount: st?.playlist.length || 0,
    };
  }
  for (const [rid, st] of ymRoomStates.entries()) {
    if (!roomSummaries[rid]) {
      roomSummaries[rid] = {
        count: 0,
        hostName: st.hostName,
        currentTrackTitle: st.currentTrack?.title || null,
        isPlaying: st.isPlaying,
        playlistCount: st.playlist.length,
      };
    }
  }

  for (const session of clients.values()) {
    sendJson(session.ws, 'ym:directory', { onlineUsers, roomCounts, roomSummaries });
  }
}

function sendToUsers(userIds: string[], type: string, payload: unknown) {
  const targetSet = new Set(userIds);
  for (const session of clients.values()) {
    if (targetSet.has(session.userId)) {
      sendJson(session.ws, type, payload);
    }
  }
}

function leaveKaraokeRoom(session: ClientSession) {
  const roomId = session.karaokeRoomId;
  if (!roomId) return;
  session.karaokeRoomId = null;

  const room = rooms.get(roomId);
  if (!room) return;

  room.members.delete(session.userId);
  room.singerRequests = room.singerRequests.filter((id) => id !== session.userId);

  if (room.singerId === session.userId) {
    room.singerId = null;
    room.singerName = null;
    room.isMicLive = false;
    room.hasMixedMusic = false;
  }

  if (room.hostId === session.userId && room.members.size > 0) {
    const nextHost = Array.from(room.members.values())[0];
    nextHost.isHost = true;
    room.hostId = nextHost.userId;
    room.hostName = nextHost.name;
  }

  broadcastRoom(roomId, 'room:state', { room: serializeRoomDetail(room) });
  broadcastRoomList();
}

function addUserToRoom(room: KaraokeRoom, userId: string, userName: string) {
  const isHost =
    room.hostId === userId ||
    room.hostId.startsWith('system-host') ||
    room.members.size === 0;

  if (isHost) {
    room.hostId = userId;
    room.hostName = userName;
  }

  if (!room.members.has(userId)) {
    room.members.set(userId, {
      userId,
      name: userName,
      isHost,
      isMicLive: room.singerId === userId ? room.isMicLive : false,
      heartsGiven: 0,
      heartsReceived: 0,
    });
  } else {
    const existing = room.members.get(userId)!;
    existing.name = userName;
    if (isHost) existing.isHost = true;
  }
}

async function bootstrap() {
  const app = express();
  app.use(express.json());

  // Keyless YouTube Karaoke & Music Search + Embed Verification
  app.get('/api/youtube/search', async (req, res) => {
    const q = String(req.query.q || '');
    const genre = String(req.query.genre || 'Tất cả');
    const karaokeOnly = req.query.karaokeOnly !== 'false';
    const musicOnly = req.query.musicOnly === 'true';
    const rawSort = String(req.query.sort || 'all');
    const sort: 'all' | 'hot' | 'new' =
      rawSort === 'hot' || rawSort === 'new' ? rawSort : 'all';

    try {
      const items = await searchYouTubeWithoutApiKey(q, genre, karaokeOnly, sort, musicOnly);
      res.json({ items, source: 'youtube-live' });
    } catch {
      res.status(502).json({ items: [], error: 'Không thể tải kết quả từ YouTube lúc này.' });
    }
  });

  app.get('/api/youtube/blocked', (_req, res) => {
    res.json({ blockedIds: Array.from(blockedVideoIds) });
  });

  app.post('/api/youtube/block', (req, res) => {
    const youtubeId = String(req.body?.youtubeId || '').trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
      blockedVideoIds.add(youtubeId);
      verifiedEmbedIds.delete(youtubeId);
    }
    res.json({ ok: true, blockedIds: Array.from(blockedVideoIds) });
  });

  app.get('/api/youtube/oembed', async (req, res) => {
    const id = String(req.query.id || '').trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      res.status(400).json({ error: 'ID YouTube không hợp lệ.' });
      return;
    }
    try {
      const targetUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${id}`
      )}&format=json`;
      const resp = await fetch(targetUrl);
      if (!resp.ok) {
        blockedVideoIds.add(id);
        res.status(404).json({ error: 'Video này không tồn tại hoặc không cho phép nhúng.' });
        return;
      }
      const data = (await resp.json()) as { title?: string; author_name?: string };
      verifiedEmbedIds.add(id);
      res.json({
        youtubeId: id,
        title: data.title || `Video YouTube (${id})`,
        artist: data.author_name || 'YouTube Karaoke',
        isKaraoke: isKaraokeTrack(data.title || '', data.author_name || ''),
      });
    } catch {
      res.status(502).json({ error: 'Lỗi lấy thông tin video YouTube.' });
    }
  });

  // MoMo Payment Gateway API v2 State & Cryptographic Verification
  interface MomoOrderRecord {
    orderId: string;
    requestId: string;
    userId: string;
    packageId: string;
    hearts: number;
    amountVnd: number;
    status: 'pending' | 'paid' | 'failed';
    transId?: string;
    payUrl?: string;
    qrCodeUrl?: string;
    deeplink?: string;
    createdAt: number;
    paidAt?: number;
  }

  const momoOrders = new Map<string, MomoOrderRecord>();
  const paidMomoOrderIds = new Set<string>();
  const claimedGuestWallets = new Set<string>();

  function getMomoConfig() {
    const partnerCode = (process.env.MOMO_PARTNER_CODE || '').trim();
    const accessKey = (process.env.MOMO_ACCESS_KEY || '').trim();
    const secretKey = (process.env.MOMO_SECRET_KEY || '').trim();
    const endpoint = (
      process.env.MOMO_ENDPOINT || 'https://payment.momo.vn/v2/gateway/api/create'
    ).trim();
    const queryEndpoint = endpoint.replace('/create', '/query');
    return {
      configured: Boolean(partnerCode && accessKey && secretKey),
      partnerCode,
      accessKey,
      secretKey,
      endpoint,
      queryEndpoint,
    };
  }

  function signMomoHmac(rawSignature: string, secretKey: string): string {
    return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
  }

  function verifySafeHmac(expectedHex: string, actualHex: string): boolean {
    if (!expectedHex || !actualHex || expectedHex.length !== actualHex.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(expectedHex, 'utf8'), Buffer.from(actualHex, 'utf8'));
    } catch {
      return false;
    }
  }

  function resolveAppBaseUrl(req: express.Request): string {
    const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
    if (envUrl && /^https?:\/\//i.test(envUrl) && !envUrl.includes('MY_APP_URL')) {
      return envUrl;
    }
    const protoHeader = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
    const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
    const safeProto = protoHeader === 'https' || hostHeader.includes('.run.app') ? 'https' : 'http';
    return `${safeProto}://${hostHeader}`;
  }

  function creditMomoOrderOnce(orderId: string, transId?: string): { ok: boolean; heartsBalance: number; heartsAdded: number } {
    const order = momoOrders.get(orderId);
    if (!order) return { ok: false, heartsBalance: 0, heartsAdded: 0 };
    if (paidMomoOrderIds.has(orderId)) {
      return { ok: true, heartsBalance: getOrInitWallet(order.userId), heartsAdded: 0 };
    }
    paidMomoOrderIds.add(orderId);
    order.status = 'paid';
    order.transId = transId || order.transId;
    order.paidAt = Date.now();

    const nextBalance = getOrInitWallet(order.userId) + order.hearts;
    wallets.set(order.userId, nextBalance);

    const session = clients.get(order.userId);
    if (session) {
      sendJson(session.ws, 'wallet:updated', { heartsBalance: nextBalance });
      sendJson(session.ws, 'momo:order_paid', {
        orderId: order.orderId,
        heartsAdded: order.hearts,
        heartsBalance: nextBalance,
        transId: order.transId,
      });
    }
    return { ok: true, heartsBalance: nextBalance, heartsAdded: order.hearts };
  }

  // Wallet & Real MoMo Payment API
  app.get('/api/wallet/:userId', (req, res) => {
    const balance = getOrInitWallet(req.params.userId);
    res.json({ userId: req.params.userId, heartsBalance: balance });
  });

  app.post('/api/wallet/merge-guest', (req, res) => {
    const { guestUserId, authUserId } = req.body as {
      guestUserId?: string;
      authUserId?: string;
    };
    const guestId = (guestUserId || '').trim();
    const authId = (authUserId || '').trim();
    if (
      !guestId ||
      !authId ||
      guestId === authId ||
      !guestId.startsWith('u-') ||
      claimedGuestWallets.has(guestId)
    ) {
      res.json({ ok: true, heartsBalance: getOrInitWallet(authId || guestId) });
      return;
    }

    claimedGuestWallets.add(guestId);
    const guestBal = wallets.get(guestId) ?? 0;
    const authCurrent = wallets.get(authId);
    if (guestBal > 30) {
      const merged = (authCurrent ?? 30) + (guestBal - 30);
      wallets.set(authId, merged);
      wallets.set(guestId, 30);
    } else if (authCurrent === undefined) {
      wallets.set(authId, guestBal || 30);
    }

    const finalBalance = getOrInitWallet(authId);
    const session = clients.get(authId);
    if (session) {
      sendJson(session.ws, 'wallet:updated', { heartsBalance: finalBalance });
    }
    res.json({ ok: true, heartsBalance: finalBalance });
  });

  app.get('/api/momo/config', (_req, res) => {
    const cfg = getMomoConfig();
    res.json({
      configured: cfg.configured,
      environment: cfg.endpoint.includes('test-payment.momo.vn') ? 'sandbox' : 'production',
    });
  });

  app.post('/api/momo/create', async (req, res) => {
    const { userId, packageId } = req.body as {
      userId?: string;
      packageId?: string;
    };

    if (!userId || !packageId || !HEART_PACKAGES[packageId]) {
      res.status(400).json({ error: 'Gói Tim hoặc tài khoản không hợp lệ.' });
      return;
    }

    const cfg = getMomoConfig();
    if (!cfg.configured) {
      res.status(503).json({
        missingConfig: true,
        requiredEnv: ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY'],
        error:
          'Cổng thanh toán MoMo chưa được cấu hình khóa đối tác trên máy chủ (MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY).',
      });
      return;
    }

    const pack = HEART_PACKAGES[packageId];
    const orderId = `DKO_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const requestId = `REQ_${orderId}`;
    const amount = String(pack.priceVnd);
    const orderInfo = `Karaoke Online - Nap ${pack.hearts} Tim`;
    const baseUrl = resolveAppBaseUrl(req);
    const redirectUrl = `${baseUrl}/?momoReturn=1`;
    const ipnUrl = `${baseUrl}/api/momo/ipn`;
    const requestType = 'captureWallet';
    const extraData = Buffer.from(JSON.stringify({ userId, packageId }), 'utf8').toString('base64');

    const rawSignature =
      `accessKey=${cfg.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}` +
      `&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${cfg.partnerCode}` +
      `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = signMomoHmac(rawSignature, cfg.secretKey);

    try {
      const momoRes = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerCode: cfg.partnerCode,
          partnerName: 'Karaoke Online',
          storeId: 'KaraokeOnline',
          requestId,
          amount,
          orderId,
          orderInfo,
          redirectUrl,
          ipnUrl,
          lang: 'vi',
          requestType,
          autoCapture: true,
          extraData,
          signature,
        }),
      });

      const data = (await momoRes.json()) as {
        resultCode?: number;
        message?: string;
        payUrl?: string;
        qrCodeUrl?: string;
        deeplink?: string;
      };

      if (!momoRes.ok || data.resultCode !== 0 || !data.payUrl) {
        res.status(502).json({
          error: data.message || `MoMo từ chối khởi tạo giao dịch (mã ${data.resultCode ?? momoRes.status}).`,
        });
        return;
      }

      const record: MomoOrderRecord = {
        orderId,
        requestId,
        userId,
        packageId,
        hearts: pack.hearts,
        amountVnd: pack.priceVnd,
        status: 'pending',
        payUrl: data.payUrl,
        qrCodeUrl: data.qrCodeUrl,
        deeplink: data.deeplink,
        createdAt: Date.now(),
      };
      momoOrders.set(orderId, record);

      res.json({
        orderId,
        amountVnd: pack.priceVnd,
        hearts: pack.hearts,
        payUrl: data.payUrl,
        qrCodeUrl: data.qrCodeUrl || null,
        deeplink: data.deeplink || null,
      });
    } catch {
      res.status(502).json({ error: 'Không kết nối được tới máy chủ thanh toán MoMo.' });
    }
  });

  // Official MoMo IPN Webhook (HMAC-SHA256 verified)
  app.post('/api/momo/ipn', (req, res) => {
    const cfg = getMomoConfig();
    if (!cfg.configured) {
      res.status(503).end();
      return;
    }
    const body = req.body as Record<string, unknown>;
    const partnerCode = String(body.partnerCode || '');
    const orderId = String(body.orderId || '');
    const requestId = String(body.requestId || '');
    const amount = String(body.amount ?? '');
    const orderInfo = String(body.orderInfo || '');
    const orderType = String(body.orderType || '');
    const transId = String(body.transId ?? '');
    const resultCode = String(body.resultCode ?? '');
    const message = String(body.message || '');
    const payType = String(body.payType || '');
    const responseTime = String(body.responseTime ?? '');
    const extraData = String(body.extraData || '');
    const signature = String(body.signature || '');

    const rawSignature =
      `accessKey=${cfg.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}` +
      `&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}` +
      `&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}` +
      `&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expectedSig = signMomoHmac(rawSignature, cfg.secretKey);
    if (!verifySafeHmac(expectedSig, signature)) {
      res.status(400).json({ error: 'Invalid MoMo signature' });
      return;
    }

    const order = momoOrders.get(orderId);
    if (!order || Number(amount) !== order.amountVnd) {
      res.status(404).end();
      return;
    }

    if (Number(resultCode) === 0) {
      creditMomoOrderOnce(orderId, transId);
    } else if (order.status === 'pending') {
      order.status = 'failed';
    }

    res.status(204).end();
  });

  // Verify signed MoMo return parameters when user returns from MoMo checkout page
  app.post('/api/momo/verify-return', (req, res) => {
    const cfg = getMomoConfig();
    if (!cfg.configured) {
      res.status(503).json({ error: 'MoMo chưa được cấu hình trên máy chủ.' });
      return;
    }

    const params = req.body as Record<string, string>;
    const partnerCode = String(params.partnerCode || '');
    const orderId = String(params.orderId || '');
    const requestId = String(params.requestId || '');
    const amount = String(params.amount || '');
    const orderInfo = String(params.orderInfo || '');
    const orderType = String(params.orderType || '');
    const transId = String(params.transId || '');
    const resultCode = String(params.resultCode || '');
    const message = String(params.message || '');
    const payType = String(params.payType || '');
    const responseTime = String(params.responseTime || '');
    const extraData = String(params.extraData || '');
    const signature = String(params.signature || '');

    const rawSignature =
      `accessKey=${cfg.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}` +
      `&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}` +
      `&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}` +
      `&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expectedSig = signMomoHmac(rawSignature, cfg.secretKey);
    if (!verifySafeHmac(expectedSig, signature)) {
      res.status(400).json({ error: 'Chữ ký xác thực từ MoMo không hợp lệ.' });
      return;
    }

    const order = momoOrders.get(orderId);
    if (!order || Number(amount) !== order.amountVnd) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng MoMo tương ứng.' });
      return;
    }

    if (Number(resultCode) !== 0) {
      if (order.status === 'pending') order.status = 'failed';
      res.status(400).json({ error: message || 'Giao dịch MoMo chưa thành công.' });
      return;
    }

    const result = creditMomoOrderOnce(orderId, transId);
    res.json({
      success: true,
      orderId,
      heartsAdded: result.heartsAdded || order.hearts,
      heartsBalance: result.heartsBalance,
      transId,
    });
  });

  // Live MoMo transaction status query (supports QR scan polling)
  app.get('/api/momo/order/:orderId', async (req, res) => {
    const order = momoOrders.get(req.params.orderId);
    if (!order) {
      res.status(404).json({ error: 'Không tìm thấy mã đơn hàng.' });
      return;
    }

    if (order.status === 'pending') {
      const cfg = getMomoConfig();
      if (cfg.configured) {
        try {
          const queryReqId = `Q_${Date.now()}`;
          const rawSignature =
            `accessKey=${cfg.accessKey}&orderId=${order.orderId}` +
            `&partnerCode=${cfg.partnerCode}&requestId=${queryReqId}`;
          const signature = signMomoHmac(rawSignature, cfg.secretKey);
          const qRes = await fetch(cfg.queryEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partnerCode: cfg.partnerCode,
              requestId: queryReqId,
              orderId: order.orderId,
              lang: 'vi',
              signature,
            }),
          });
          if (qRes.ok) {
            const qData = (await qRes.json()) as { resultCode?: number; transId?: number | string };
            if (qData.resultCode === 0) {
              creditMomoOrderOnce(order.orderId, String(qData.transId || ''));
            } else if (qData.resultCode && qData.resultCode !== 1000 && qData.resultCode !== 7000) {
              order.status = 'failed';
            }
          }
        } catch {
          // Keep pending on transient network glitch
        }
      }
    }

    res.json({
      orderId: order.orderId,
      status: order.status,
      hearts: order.hearts,
      amountVnd: order.amountVnd,
      heartsBalance: getOrInitWallet(order.userId),
      transId: order.transId || null,
    });
  });

  app.get('/api/leaderboard/hearts', (req, res) => {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const weeklyEntries = getWeeklyLeaderboardEntries();
    const monthlyEntries = getMonthlyLeaderboardEntries();
    res.json({
      period,
      entries: period === 'month' ? monthlyEntries : weeklyEntries,
      weeklyEntries,
      monthlyEntries,
    });
  });

  // Multiplayer Game Rooms REST API
  app.get('/api/game-rooms', (_req, res) => {
    res.json({ rooms: Array.from(gameRooms.values()).map(serializeGameRoomSummary) });
  });

  app.get('/api/game-rooms/:roomId', (req, res) => {
    const room = gameRooms.get(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: 'Không tìm thấy bàn chơi.' });
      return;
    }
    const uid = String(req.query.userId || '');
    res.json({
      room: serializeGameRoomDetail(room),
      hand: uid ? room.hands.get(uid) || [] : [],
    });
  });

  app.post('/api/game-rooms', (req, res) => {
    const { name, gameType, maxPlayers, hostId, hostName } = req.body as {
      name?: string;
      gameType?: 'tien-len' | 'caro';
      maxPlayers?: number;
      hostId?: string;
      hostName?: string;
    };

    const gType = gameType === 'caro' ? 'caro' : 'tien-len';
    const cleanName = (name || '').trim() || (gType === 'caro' ? 'Bàn Cờ Caro Mới' : 'Bàn Tiến Lên Mới');
    const seatsLimit = gType === 'caro' ? 2 : Math.min(4, Math.max(2, Number(maxPlayers || 4)));
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const room: ServerGameRoom = {
      id,
      code,
      name: cleanName,
      gameType: gType,
      maxPlayers: seatsLimit,
      hostId: hostId || 'system-table',
      hostName: (hostName || 'Chủ bàn').trim(),
      status: 'waiting',
      seats: [],
      spectators: [],
      hands: new Map(),
      passedUserIds: new Set(),
      turnUserId: null,
      lastPlay: null,
      mustInclude3Spade: false,
      caroBoard: Array(225).fill(null),
      caroTurn: 'X',
      caroLastMove: null,
      caroWinLine: null,
      winnerUserId: null,
      winnerName: null,
      isDraw: false,
      chat: [],
      createdAt: Date.now(),
    };

    gameRooms.set(id, room);
    broadcastGameRoomList();
    res.status(201).json({ room: serializeGameRoomSummary(room) });
  });

  app.post('/api/game-rooms/:roomId/join', (req, res) => {
    const room = gameRooms.get(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: 'Không tìm thấy bàn chơi.' });
      return;
    }
    const { userId, userName } = req.body as { userId?: string; userName?: string };
    const uid = (userId || `player-${Date.now()}`).trim();
    const uname = (userName || 'Người chơi').trim().slice(0, 28);

    const session = clients.get(uid);
    if (session) {
      if (session.gameRoomId && session.gameRoomId !== room.id) {
        leaveServerGameRoom(session);
      }
      session.gameRoomId = room.id;
      session.userName = uname;
    }

    joinServerGameRoom(room, uid, uname);
    broadcastGameRoom(room);
    broadcastGameRoomList();

    res.json({
      room: serializeGameRoomDetail(room),
      hand: room.hands.get(uid) || [],
    });
  });

  // Rooms REST API (Reliable entry + state sync alongside WebSocket)
  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: Array.from(rooms.values()).map(serializeRoomSummary) });
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: 'Không tìm thấy phòng hát.' });
      return;
    }
    res.json({ room: serializeRoomDetail(room) });
  });

  app.post('/api/rooms/:roomIdOrCode/join', (req, res) => {
    const roomIdOrCode = String(req.params.roomIdOrCode || '').trim();
    const { userId, userName, passcode } = req.body as {
      userId?: string;
      userName?: string;
      passcode?: string;
    };

    let targetRoom = rooms.get(roomIdOrCode);
    if (!targetRoom) {
      targetRoom = Array.from(rooms.values()).find(
        (r) => r.code.toUpperCase() === roomIdOrCode.toUpperCase()
      );
    }

    if (!targetRoom) {
      res.status(404).json({ error: 'Không tìm thấy phòng hát với mã này.' });
      return;
    }

    if (targetRoom.passcode && targetRoom.passcode !== (passcode || '').trim()) {
      res.status(403).json({ error: 'Mật khẩu phòng hát không đúng.' });
      return;
    }

    const uid = (userId || `guest-${Date.now()}`).trim();
    const uname = (userName || 'Ca sĩ ẩn danh').trim().slice(0, 28);

    const session = clients.get(uid);
    if (session) {
      if (session.karaokeRoomId && session.karaokeRoomId !== targetRoom.id) {
        leaveKaraokeRoom(session);
      }
      session.karaokeRoomId = targetRoom.id;
      session.userName = uname;
    }

    addUserToRoom(targetRoom, uid, uname);
    broadcastRoom(targetRoom.id, 'room:state', { room: serializeRoomDetail(targetRoom) }, uid);
    broadcastRoomList();

    res.json({ room: serializeRoomDetail(targetRoom) });
  });

  app.post('/api/rooms', (req, res) => {
    const { name, hostId, hostName, passcode, song } = req.body as {
      name?: string;
      hostId?: string;
      hostName?: string;
      passcode?: string;
      song?: RoomSong;
    };

    const cleanName = (name || '').trim();
    if (!cleanName) {
      res.status(400).json({ error: 'Vui lòng nhập tên phòng hát.' });
      return;
    }

    const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const initialSong = song || DEFAULT_ROOM_SONG;

    const newRoom: KaraokeRoom = {
      id: roomId,
      code,
      name: cleanName,
      passcode: (passcode || '').trim(),
      hostId: hostId || 'host',
      hostName: (hostName || 'Chủ phòng').trim(),
      singerId: hostId || null,
      singerName: (hostName || 'Chủ phòng').trim(),
      singerRequests: [],
      isMicLive: false,
      hasMixedMusic: false,
      currentSong: initialSong,
      customLyrics: initialSong.lyrics || [],
      activeLyricLine: 0,
      isPlaying: false,
      positionSeconds: 0,
      syncedAt: Date.now(),
      heartsTotal: 0,
      members: new Map(),
      chat: [
        {
          id: `rc-${Date.now()}`,
          senderId: 'system',
          senderName: 'Hệ thống',
          text: `Phòng "${cleanName}" (Mã: ${code}) đã mở! Chủ phòng có thể chọn thành viên hát & bật Mic Echo trực tiếp.`,
          timestamp: nowTimeStr(),
        },
      ],
      createdAt: Date.now(),
    };

    rooms.set(roomId, newRoom);
    broadcastRoomList();
    res.status(201).json({ room: serializeRoomSummary(newRoom) });
  });

  // Search Engine Crawlability: robots.txt & XML sitemap
  app.get('/robots.txt', (req, res) => {
    const baseUrl = resolveAppBaseUrl(req);
    res
      .type('text/plain; charset=utf-8')
      .send(
        [
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/',
          'Disallow: /ws',
          `Sitemap: ${baseUrl}/sitemap.xml`,
        ].join('\n')
      );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = resolveAppBaseUrl(req);
    const today = new Date().toISOString().split('T')[0];
    const escapeXml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const staticRoutes = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/hat-karaoke-khong-quang-cao', priority: '0.95', changefreq: 'daily' },
      { loc: '/nghe-nhac-youtube-mp3', priority: '0.95', changefreq: 'daily' },
      { loc: '/nghe-nhac-khong-quang-cao', priority: '0.9', changefreq: 'daily' },
      { loc: '/phong-hat-karaoke-truc-tuyen', priority: '0.85', changefreq: 'daily' },
      { loc: '/phong-chat-va-game', priority: '0.8', changefreq: 'weekly' },
    ];

    const dynamicKaraokeRoutes = KARAOKE_SONGS.map((song) => ({
      loc: buildSongUrlPath(song.title, song.youtubeId, 'karaoke'),
      priority: '0.82',
      changefreq: 'weekly',
    }));

    const featuredMp3Routes = [
      { loc: '/lk-ca-nhac-bolero-tru-tinh-hay-nhat-mp3-WaXpzNZw4jI', priority: '0.8', changefreq: 'weekly' },
      { loc: '/nhac-tre-ballad-hot-trend-mp3-S3bOgUn9Fg4', priority: '0.8', changefreq: 'weekly' },
      { loc: '/nhac-bolero-tru-tinh-phoi-moi-ai-mp3-vF4UE-dOMdg', priority: '0.8', changefreq: 'weekly' },
      { loc: '/em-say-roi-myra-tran-hat-live-mp3-Xzj4MCe53xM', priority: '0.8', changefreq: 'weekly' },
    ];

    const seenLocs = new Set<string>();
    const allRoutes = [...staticRoutes, ...dynamicKaraokeRoutes, ...featuredMp3Routes].filter((r) => {
      if (seenLocs.has(r.loc)) return false;
      seenLocs.add(r.loc);
      return true;
    });

    const urlEntries = allRoutes
      .map(
        (u) =>
          `  <url>\n    <loc>${escapeXml(`${baseUrl}${u.loc}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      )
      .join('\n');
    res
      .set('Cache-Control', 'public, max-age=3600')
      .type('application/xml; charset=utf-8')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`
      );
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let sessionUserId = `guest-${Math.random().toString(36).slice(2, 9)}`;
    // Register guest session immediately so early messages are never dropped
    clients.set(sessionUserId, {
      ws,
      userId: sessionUserId,
      userName: 'Ca sĩ ẩn danh',
      karaokeRoomId: null,
      ymRoomId: null,
      gameRoomId: null,
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; payload?: Record<string, unknown> };
        const payload = msg.payload || {};

        if (msg.type === 'auth:identify') {
          const prevSession = clients.get(sessionUserId);
          const uid = String(payload.userId || sessionUserId);
          const uname = String(payload.userName || 'Ca sĩ ẩn danh').slice(0, 28);
          if (uid !== sessionUserId) {
            clients.delete(sessionUserId);
            sessionUserId = uid;
          }
          clients.set(uid, {
            ws,
            userId: uid,
            userName: uname,
            karaokeRoomId: prevSession?.karaokeRoomId ?? clients.get(uid)?.karaokeRoomId ?? null,
            ymRoomId: prevSession?.ymRoomId ?? clients.get(uid)?.ymRoomId ?? null,
            gameRoomId: prevSession?.gameRoomId ?? clients.get(uid)?.gameRoomId ?? null,
          });
          const balance = getOrInitWallet(uid);
          sendJson(ws, 'wallet:updated', { heartsBalance: balance });
          sendJson(ws, 'rooms:list', {
            rooms: Array.from(rooms.values()).map(serializeRoomSummary),
          });
          sendJson(ws, 'leaderboard:hearts_updated', {
            entries: getWeeklyLeaderboardEntries(),
            monthlyEntries: getMonthlyLeaderboardEntries(),
          });
          sendJson(ws, 'game:list', {
            rooms: Array.from(gameRooms.values()).map(serializeGameRoomSummary),
          });
          sendJson(ws, 'ym:dm_sync', {
            threads: getPrivateThreadsForUser(uid),
          });
          broadcastYmDirectory();
          return;
        }

        const session = clients.get(sessionUserId);
        if (!session) return;

        if (msg.type === 'auth:rename') {
          const nextName = String(payload.userName || '').trim().slice(0, 28);
          if (nextName) {
            session.userName = nextName;
            const lbWeek = weeklyGiftLeaderboard.get(session.userId);
            const lbMonth = monthlyGiftLeaderboard.get(session.userId);
            if (lbWeek) lbWeek.userName = nextName;
            if (lbMonth) lbMonth.userName = nextName;
            if (lbWeek || lbMonth) {
              broadcastWeeklyLeaderboard();
            }
            if (session.karaokeRoomId) {
              const room = rooms.get(session.karaokeRoomId);
              const member = room?.members.get(session.userId);
              if (room && member) {
                member.name = nextName;
                if (room.singerId === session.userId) room.singerName = nextName;
                if (room.hostId === session.userId) room.hostName = nextName;
                broadcastRoom(room.id, 'room:state', { room: serializeRoomDetail(room) });
              }
            }
            if (session.ymRoomId) {
              const ymState = ymRoomStates.get(session.ymRoomId);
              if (ymState && ymState.hostUserId === session.userId) {
                ymState.hostName = nextName;
                broadcastYmRoomMusic(session.ymRoomId);
              }
              broadcastYmRoom(session.ymRoomId, 'ym:presence', {
                roomId: session.ymRoomId,
                users: getYmRoomUsers(session.ymRoomId),
              });
            }
            broadcastYmDirectory();
          }
          return;
        }

        // --- KARAOKE ROOMS ---
        if (msg.type === 'room:join') {
          const roomIdOrCode = String(payload.roomId || '').trim();
          const passcode = String(payload.passcode || '').trim();

          let targetRoom = rooms.get(roomIdOrCode);
          if (!targetRoom) {
            targetRoom = Array.from(rooms.values()).find(
              (r) => r.code.toUpperCase() === roomIdOrCode.toUpperCase()
            );
          }
          if (!targetRoom) {
            sendJson(ws, 'room:error', { error: 'Không tìm thấy phòng hát này.' });
            return;
          }
          if (targetRoom.passcode && targetRoom.passcode !== passcode) {
            sendJson(ws, 'room:error', { error: 'Mật khẩu phòng hát không đúng.' });
            return;
          }

          if (session.karaokeRoomId && session.karaokeRoomId !== targetRoom.id) {
            leaveKaraokeRoom(session);
          }

          session.karaokeRoomId = targetRoom.id;
          addUserToRoom(targetRoom, session.userId, session.userName);

          sendJson(ws, 'room:joined', { room: serializeRoomDetail(targetRoom) });
          broadcastRoom(
            targetRoom.id,
            'room:state',
            { room: serializeRoomDetail(targetRoom) },
            session.userId
          );
          broadcastRoomList();
          return;
        }

        if (msg.type === 'room:leave') {
          leaveKaraokeRoom(session);
          return;
        }

        if (msg.type === 'room:request_mic') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room) return;
          if (!room.singerRequests.includes(session.userId)) {
            room.singerRequests.push(session.userId);
          }
          room.chat.push({
            id: `rc-${Date.now()}`,
            senderId: 'system',
            senderName: 'Hệ thống',
            text: `${session.userName} đã giơ tay đăng ký xin lên hát!`,
            timestamp: nowTimeStr(),
          });
          broadcastRoom(room.id, 'room:state', { room: serializeRoomDetail(room) });
          return;
        }

        if (msg.type === 'room:select_singer') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room) return;
          if (room.hostId !== session.userId && room.singerId !== null) {
            sendJson(ws, 'room:error', { error: 'Chỉ Chủ phòng mới có quyền chọn người hát tiếp theo.' });
            return;
          }
          const targetId = String(payload.targetUserId || '');
          const targetMember = room.members.get(targetId);
          if (!targetMember) return;

          room.singerId = targetMember.userId;
          room.singerName = targetMember.name;
          room.isMicLive = false;
          room.singerRequests = room.singerRequests.filter((id) => id !== targetId);

          for (const m of room.members.values()) {
            m.isMicLive = false;
          }

          room.chat.push({
            id: `rc-${Date.now()}`,
            senderId: 'system',
            senderName: 'Hệ thống',
            text: `Chủ phòng đã chọn ${targetMember.name} làm Ca sĩ chính trên sân khấu!`,
            timestamp: nowTimeStr(),
          });

          broadcastRoom(room.id, 'room:singer_selected', {
            singerId: targetMember.userId,
            singerName: targetMember.name,
          });
          broadcastRoom(room.id, 'room:state', { room: serializeRoomDetail(room) });
          broadcastRoomList();
          return;
        }

        if (msg.type === 'room:claim_mic') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room) return;

          room.singerId = session.userId;
          room.singerName = session.userName;
          room.isMicLive = Boolean(payload.isMicLive);
          room.hasMixedMusic = room.isMicLive && Boolean(payload.hasMixedMusic);
          room.singerRequests = room.singerRequests.filter((id) => id !== session.userId);

          for (const m of room.members.values()) {
            m.isMicLive = m.userId === session.userId ? room.isMicLive : false;
          }

          room.chat.push({
            id: `rc-${Date.now()}`,
            senderId: 'system',
            senderName: 'Hệ thống',
            text: `${session.userName} đã lên sân khấu cầm Mic!`,
            timestamp: nowTimeStr(),
          });

          broadcastRoom(room.id, 'room:state', { room: serializeRoomDetail(room) });
          broadcastRoomList();
          return;
        }

        if (msg.type === 'room:release_mic') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room || room.singerId !== session.userId) return;

          room.singerId = null;
          room.singerName = null;
          room.isMicLive = false;
          room.hasMixedMusic = false;
          const m = room.members.get(session.userId);
          if (m) m.isMicLive = false;

          broadcastRoom(room.id, 'room:state', { room: serializeRoomDetail(room) });
          broadcastRoomList();
          return;
        }

        if (msg.type === 'room:mic_status') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room || room.singerId !== session.userId) return;
          room.isMicLive = Boolean(payload.isMicLive);
          room.hasMixedMusic = room.isMicLive && Boolean(payload.hasMixedMusic);
          const m = room.members.get(session.userId);
          if (m) m.isMicLive = room.isMicLive;
          broadcastRoom(room.id, 'room:state', { room: serializeRoomDetail(room) });
          broadcastRoomList();
          return;
        }

        if (msg.type === 'room:sync_song') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room) return;
          if (payload.song) {
            const nextSong = payload.song as RoomSong;
            const changedSong = nextSong.youtubeId !== room.currentSong.youtubeId;
            room.currentSong = nextSong;
            if (changedSong && Array.isArray(nextSong.lyrics)) {
              room.customLyrics = nextSong.lyrics;
              room.activeLyricLine = 0;
            }
          }
          if (typeof payload.isPlaying === 'boolean') {
            room.isPlaying = payload.isPlaying;
          }
          if (typeof payload.positionSeconds === 'number') {
            room.positionSeconds = payload.positionSeconds;
          }
          room.syncedAt = Date.now();

          broadcastRoom(room.id, 'room:song_synced', {
            currentSong: room.currentSong,
            customLyrics: room.customLyrics,
            activeLyricLine: room.activeLyricLine,
            isPlaying: room.isPlaying,
            positionSeconds: room.positionSeconds,
            syncedAt: room.syncedAt,
            byName: session.userName,
          });
          broadcastRoomList();
          return;
        }

        if (msg.type === 'room:sync_lyrics') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room) return;
          if (Array.isArray(payload.lyrics)) {
            room.customLyrics = (payload.lyrics as string[]).map((l) => String(l));
          }
          if (typeof payload.activeLyricLine === 'number') {
            room.activeLyricLine = Math.max(0, payload.activeLyricLine);
          }

          broadcastRoom(room.id, 'room:lyrics_synced', {
            customLyrics: room.customLyrics,
            activeLyricLine: room.activeLyricLine,
            byName: session.userName,
          });
          return;
        }

        // WebRTC Signaling between Singer and Listeners in the same room
        if (msg.type === 'rtc:offer' || msg.type === 'rtc:answer' || msg.type === 'rtc:ice') {
          const targetId = String(payload.targetId || '');
          const targetSession = clients.get(targetId);
          if (
            targetSession &&
            session.karaokeRoomId &&
            targetSession.karaokeRoomId === session.karaokeRoomId
          ) {
            sendJson(targetSession.ws, msg.type, {
              ...payload,
              fromId: session.userId,
              fromName: session.userName,
            });
          }
          return;
        }

        if (msg.type === 'room:heart') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room) return;
          room.heartsTotal += 1;
          broadcastRoom(room.id, 'room:heart_burst', {
            fromId: session.userId,
            fromName: session.userName,
            heartsTotal: room.heartsTotal,
          });
          return;
        }

        if (msg.type === 'room:gift') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room) return;
          const giftId = String(payload.giftId || 'heart_1');
          const gift = GIFT_TIERS[giftId];
          if (!gift) return;

          const balance = getOrInitWallet(session.userId);
          if (balance < gift.hearts) {
            sendJson(ws, 'room:error', {
              error: `Bạn cần ${gift.hearts} Tim để tặng "${gift.label}". Vui lòng Mua thêm Tim!`,
            });
            return;
          }

          const nextBalance = balance - gift.hearts;
          wallets.set(session.userId, nextBalance);
          sendJson(ws, 'wallet:updated', { heartsBalance: nextBalance });

          room.heartsTotal += gift.hearts;
          const senderMember = room.members.get(session.userId);
          if (senderMember) {
            senderMember.heartsGiven += gift.hearts;
          }
          if (room.singerId) {
            const singerMember = room.members.get(room.singerId);
            if (singerMember) {
              singerMember.heartsReceived += gift.hearts;
            }
          }

          const recipientName = room.singerName || room.hostName || room.name;
          recordWeeklyHeartGift(
            session.userId,
            session.userName,
            gift.hearts,
            recipientName,
            gift.label
          );

          const chatEntry: RoomChatMessage = {
            id: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            senderId: session.userId,
            senderName: session.userName,
            text: `đã tặng ${gift.label} (+${gift.hearts} Tim) cho ${room.singerName || 'phòng hát'}!`,
            timestamp: nowTimeStr(),
            giftInfo: {
              label: gift.label,
              hearts: gift.hearts,
            },
          };
          room.chat.push(chatEntry);

          broadcastRoom(room.id, 'room:gift_received', {
            fromName: session.userName,
            toName: room.singerName || room.name,
            giftLabel: gift.label,
            hearts: gift.hearts,
            heartsTotal: room.heartsTotal,
          });
          broadcastRoom(room.id, 'room:state', { room: serializeRoomDetail(room) });
          broadcastRoomList();
          broadcastWeeklyLeaderboard();
          return;
        }

        if (msg.type === 'room:chat') {
          const room = session.karaokeRoomId ? rooms.get(session.karaokeRoomId) : null;
          if (!room) return;
          const text = String(payload.text || '').trim().slice(0, 300);
          if (!text) return;

          const entry: RoomChatMessage = {
            id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            senderId: session.userId,
            senderName: session.userName,
            text,
            timestamp: nowTimeStr(),
          };
          room.chat.push(entry);
          broadcastRoom(room.id, 'room:state', { room: serializeRoomDetail(room) });
          return;
        }

        // --- YAHOO! MESSENGER ROOMS (CHAT CHUNG, PHÒNG THỂ LOẠI NHẠC & 63 TỈNH THÀNH VN) ---
        if (msg.type === 'ym:join') {
          const requestedRoomId = String(payload.roomId || 'nhac-tre');
          const roomId = resolveVietnamChatRoomId(requestedRoomId);
          if (session.ymRoomId && session.ymRoomId !== roomId) {
            leaveYmRoom(session);
          }
          session.ymRoomId = roomId;

          const roomUsers = getYmRoomUsers(roomId);
          const musicState = ensureYmRoomMusicState(roomId);
          const hostStillPresent =
            musicState.hostUserId && roomUsers.some((u) => u.id === musicState.hostUserId);
          if (!hostStillPresent) {
            musicState.hostUserId = session.userId;
            musicState.hostName = session.userName;
          }

          sendJson(ws, 'ym:history', {
            roomId,
            messages: ensureYmRoomHistory(roomId),
          });
          sendJson(ws, 'ym:music_state', {
            state: musicState,
          });
          broadcastYmRoom(roomId, 'ym:presence', {
            roomId,
            users: roomUsers,
          });
          broadcastYmRoomMusic(roomId);
          broadcastYmDirectory();
          return;
        }

        if (msg.type === 'ym:leave_room') {
          leaveYmRoom(session);
          broadcastYmDirectory();
          return;
        }

        if (msg.type === 'ym:claim_host') {
          const roomId = String(payload.roomId || session.ymRoomId || '');
          if (!roomId || session.ymRoomId !== roomId) return;
          const musicState = ensureYmRoomMusicState(roomId);
          const roomUsers = getYmRoomUsers(roomId);
          const hostPresent =
            musicState.hostUserId && roomUsers.some((u) => u.id === musicState.hostUserId);
          if (!hostPresent) {
            musicState.hostUserId = session.userId;
            musicState.hostName = session.userName;
            broadcastYmRoomMusic(roomId);
            broadcastYmDirectory();
          }
          return;
        }

        if (msg.type === 'ym:transfer_host') {
          const roomId = String(payload.roomId || session.ymRoomId || '');
          const targetUserId = String(payload.targetUserId || '');
          if (!roomId || !targetUserId || session.ymRoomId !== roomId) return;
          const musicState = ensureYmRoomMusicState(roomId);
          if (musicState.hostUserId !== session.userId) return;
          const targetUser = getYmRoomUsers(roomId).find((u) => u.id === targetUserId);
          if (!targetUser) return;
          musicState.hostUserId = targetUser.id;
          musicState.hostName = targetUser.nickname;
          broadcastYmRoomMusic(roomId);
          broadcastYmDirectory();
          return;
        }

        if (msg.type === 'ym:music_control') {
          const roomId = String(payload.roomId || session.ymRoomId || '');
          if (!roomId || session.ymRoomId !== roomId) return;
          const musicState = ensureYmRoomMusicState(roomId);
          if (musicState.hostUserId !== session.userId) {
            sendJson(ws, 'toast', {
              message: 'Chỉ Chủ phòng mới có quyền bật, tắt hoặc chuyển nhạc phòng.',
              type: 'warning',
            });
            return;
          }

          const action = String(payload.action || '');
          if (action === 'play') {
            if (!musicState.currentTrack && musicState.playlist.length > 0) {
              musicState.currentTrack = musicState.playlist[0];
            }
            if (typeof payload.positionSeconds === 'number' && Number.isFinite(payload.positionSeconds)) {
              musicState.positionSeconds = Math.max(0, payload.positionSeconds);
            }
            musicState.isPlaying = Boolean(musicState.currentTrack);
            musicState.syncedAt = Date.now();
          } else if (action === 'pause') {
            if (typeof payload.positionSeconds === 'number' && Number.isFinite(payload.positionSeconds)) {
              musicState.positionSeconds = Math.max(0, payload.positionSeconds);
            }
            musicState.isPlaying = false;
            musicState.syncedAt = Date.now();
          } else if (action === 'seek') {
            const pos = Number(payload.positionSeconds ?? 0);
            if (Number.isFinite(pos)) {
              musicState.positionSeconds = Math.max(0, pos);
              musicState.syncedAt = Date.now();
            }
          } else if (action === 'select_track') {
            const trackId = String(payload.trackId || '');
            const found = musicState.playlist.find((t) => t.trackId === trackId);
            if (found) {
              musicState.currentTrack = found;
              musicState.positionSeconds = 0;
              musicState.isPlaying = true;
              musicState.syncedAt = Date.now();
            }
          } else if (action === 'next') {
            if (musicState.playlist.length > 0) {
              const curIdx = musicState.currentTrack
                ? musicState.playlist.findIndex((t) => t.trackId === musicState.currentTrack?.trackId)
                : -1;
              const nextIdx = curIdx >= 0 ? (curIdx + 1) % musicState.playlist.length : 0;
              musicState.currentTrack = musicState.playlist[nextIdx];
              musicState.positionSeconds = 0;
              musicState.isPlaying = true;
              musicState.syncedAt = Date.now();
            }
          }

          broadcastYmRoomMusic(roomId);
          broadcastYmDirectory();
          return;
        }

        if (msg.type === 'ym:playlist_add') {
          const roomId = String(payload.roomId || session.ymRoomId || '');
          if (!roomId || session.ymRoomId !== roomId) return;
          const rawSong = payload.song as
            | { youtubeId?: string; title?: string; artist?: string; durationSeconds?: number }
            | undefined;
          const youtubeId = String(rawSong?.youtubeId || '').trim();
          if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) return;

          const musicState = ensureYmRoomMusicState(roomId);
          const already = musicState.playlist.find((t) => t.youtubeId === youtubeId);
          if (already) {
            sendJson(ws, 'toast', {
              message: `Bài "${already.title}" đã có sẵn trong danh sách phòng.`,
              type: 'info',
            });
            return;
          }

          const newTrack: YmRoomTrack = {
            trackId: `trk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            youtubeId,
            title: String(rawSong?.title || `Bài hát YouTube (${youtubeId})`).trim().slice(0, 140),
            artist: String(rawSong?.artist || 'Nguồn YouTube').trim().slice(0, 80),
            durationSeconds:
              typeof rawSong?.durationSeconds === 'number' && rawSong.durationSeconds > 0
                ? Math.round(rawSong.durationSeconds)
                : 240,
            addedByUserId: session.userId,
            addedByName: session.userName,
            addedAt: Date.now(),
          };

          musicState.playlist.push(newTrack);
          if (musicState.playlist.length > 50) {
            const firstNonPlayingIdx = musicState.playlist.findIndex(
              (t) => t.trackId !== musicState.currentTrack?.trackId
            );
            if (firstNonPlayingIdx >= 0) musicState.playlist.splice(firstNonPlayingIdx, 1);
          }
          if (!musicState.currentTrack) {
            musicState.currentTrack = newTrack;
          }

          const notice: YmMessage = {
            id: `ym-trk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            roomId,
            sender: 'Hệ thống phòng',
            text: `${session.userName} vừa thêm bài "${newTrack.title}" vào danh sách nhạc phòng.`,
            timestamp: nowTimeStr(),
            color: '#34D399',
          };
          const list = ensureYmRoomHistory(roomId);
          list.push(notice);
          if (list.length > 80) list.shift();
          ymHistory.set(roomId, list);

          broadcastYmRoom(roomId, 'ym:message', { message: notice });
          broadcastYmRoomMusic(roomId);
          broadcastYmDirectory();
          return;
        }

        if (msg.type === 'ym:playlist_remove') {
          const roomId = String(payload.roomId || session.ymRoomId || '');
          const trackId = String(payload.trackId || '');
          if (!roomId || !trackId || session.ymRoomId !== roomId) return;
          const musicState = ensureYmRoomMusicState(roomId);
          const idx = musicState.playlist.findIndex((t) => t.trackId === trackId);
          if (idx < 0) return;
          const target = musicState.playlist[idx];
          if (musicState.hostUserId !== session.userId && target.addedByUserId !== session.userId) {
            return;
          }
          musicState.playlist.splice(idx, 1);
          if (musicState.currentTrack?.trackId === trackId) {
            musicState.currentTrack = musicState.playlist[0] ?? null;
            musicState.positionSeconds = 0;
            if (!musicState.currentTrack) musicState.isPlaying = false;
            musicState.syncedAt = Date.now();
          }
          broadcastYmRoomMusic(roomId);
          broadcastYmDirectory();
          return;
        }

        if (msg.type === 'ym:send') {
          const roomId = String(payload.roomId || session.ymRoomId || 'nhac-tre');
          const message = payload.message as YmMessage | undefined;
          if (!message || !message.text) return;

          const cleanMsg: YmMessage = {
            ...message,
            id: message.id || `ym-${Date.now()}`,
            roomId,
            senderId: session.userId,
            sender: session.userName,
            timestamp: nowTimeStr(),
          };
          const list = ensureYmRoomHistory(roomId);
          list.push(cleanMsg);
          if (list.length > 80) list.shift();
          ymHistory.set(roomId, list);

          broadcastYmRoom(roomId, 'ym:message', { message: cleanMsg });
          return;
        }

        if (msg.type === 'ym:buzz') {
          const roomId = String(payload.roomId || session.ymRoomId || 'nhac-tre');
          const buzzMsg: YmMessage = {
            id: `buzz-${Date.now()}`,
            roomId,
            senderId: session.userId,
            sender: session.userName,
            text: 'BUZZ!!!',
            timestamp: nowTimeStr(),
            color: '#EF4444',
            isBold: true,
            isBuzz: true,
          };
          const list = ensureYmRoomHistory(roomId);
          list.push(buzzMsg);
          if (list.length > 80) list.shift();
          ymHistory.set(roomId, list);

          broadcastYmRoom(roomId, 'ym:buzz', { message: buzzMsg });
          return;
        }

        // --- YAHOO! MESSENGER PRIVATE 1-1 CHAT (CHAT RIÊNG) ---
        if (msg.type === 'ym:dm_history') {
          const peerId = String(payload.peerId || '').trim();
          if (!peerId) return;
          const dmKey = getDmKey(session.userId, peerId);
          sendJson(ws, 'ym:dm_thread', {
            peerId,
            messages: ymPrivateHistory.get(dmKey) || [],
          });
          return;
        }

        if (msg.type === 'ym:dm_send') {
          const toUserId = String(payload.toUserId || '').trim();
          if (!toUserId || toUserId === session.userId) return;
          const rawMsg = payload.message as Partial<YmPrivateMessage> | undefined;
          const text = String(rawMsg?.text || '').trim().slice(0, 600);
          if (!text) return;

          const targetClient = clients.get(toUserId);
          const toName = targetClient?.userName || String(payload.toName || 'Thành viên').slice(0, 28);
          const dmMsg: YmPrivateMessage = {
            id: rawMsg?.id || `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            fromUserId: session.userId,
            fromName: session.userName,
            toUserId,
            toName,
            text,
            timestamp: nowTimeStr(),
            color: String(rawMsg?.color || '#F8FAFC'),
            isBold: Boolean(rawMsg?.isBold),
            isItalic: Boolean(rawMsg?.isItalic),
            sharedSong: rawMsg?.sharedSong,
          };
          const dmKey = getDmKey(session.userId, toUserId);
          const list = ymPrivateHistory.get(dmKey) || [];
          list.push(dmMsg);
          if (list.length > 100) list.shift();
          ymPrivateHistory.set(dmKey, list);

          sendToUsers([session.userId, toUserId], 'ym:dm_message', { message: dmMsg });
          return;
        }

        if (msg.type === 'ym:dm_buzz') {
          const toUserId = String(payload.toUserId || '').trim();
          if (!toUserId || toUserId === session.userId) return;
          const targetClient = clients.get(toUserId);
          const toName = targetClient?.userName || String(payload.toName || 'Thành viên').slice(0, 28);
          const buzzMsg: YmPrivateMessage = {
            id: `dm-buzz-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            fromUserId: session.userId,
            fromName: session.userName,
            toUserId,
            toName,
            text: 'BUZZ!!!',
            timestamp: nowTimeStr(),
            color: '#EF4444',
            isBold: true,
            isBuzz: true,
          };
          const dmKey = getDmKey(session.userId, toUserId);
          const list = ymPrivateHistory.get(dmKey) || [];
          list.push(buzzMsg);
          if (list.length > 100) list.shift();
          ymPrivateHistory.set(dmKey, list);

          sendToUsers([session.userId, toUserId], 'ym:dm_buzz', { message: buzzMsg });
          return;
        }

        // --- MULTIPLAYER GAME ROOMS ---
        if (msg.type === 'game:join') {
          const roomId = String(payload.roomId || '');
          const room = gameRooms.get(roomId);
          if (!room) return;
          if (session.gameRoomId && session.gameRoomId !== room.id) {
            leaveServerGameRoom(session);
          }
          session.gameRoomId = room.id;
          joinServerGameRoom(room, session.userId, session.userName);
          broadcastGameRoom(room);
          broadcastGameRoomList();
          return;
        }

        if (msg.type === 'game:leave') {
          leaveServerGameRoom(session);
          return;
        }

        if (msg.type === 'game:take_seat') {
          const room = session.gameRoomId ? gameRooms.get(session.gameRoomId) : null;
          if (!room || room.status === 'playing') return;
          if (room.seats.some((s) => s.userId === session.userId)) return;
          if (room.seats.length >= room.maxPlayers) {
            sendJson(ws, 'game:error', { error: 'Bàn chơi đã đủ người.' });
            return;
          }
          joinServerGameRoom(room, session.userId, session.userName);
          broadcastGameRoom(room);
          broadcastGameRoomList();
          return;
        }

        if (msg.type === 'game:start') {
          const room = session.gameRoomId ? gameRooms.get(session.gameRoomId) : null;
          if (!room) return;
          if (!room.seats.some((s) => s.userId === session.userId)) {
            sendJson(ws, 'game:error', { error: 'Chỉ người ngồi trong bàn mới có thể bắt đầu.' });
            return;
          }
          if (room.seats.length < 2) {
            sendJson(ws, 'game:error', { error: 'Cần ít nhất 2 người chơi thật trong bàn để bắt đầu!' });
            return;
          }
          startGameInRoom(room);
          broadcastGameRoom(room);
          broadcastGameRoomList();
          return;
        }

        if (msg.type === 'game:play_cards') {
          const room = session.gameRoomId ? gameRooms.get(session.gameRoomId) : null;
          if (!room || room.gameType !== 'tien-len' || room.status !== 'playing') return;
          if (room.turnUserId !== session.userId) {
            sendJson(ws, 'game:error', { error: 'Chưa tới lượt đánh của bạn.' });
            return;
          }

          const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds.map(String) : [];
          const hand = room.hands.get(session.userId) || [];
          const selected = hand.filter((c) => cardIds.includes(c.id));
          if (selected.length !== cardIds.length || selected.length === 0) {
            sendJson(ws, 'game:error', { error: 'Lá bài không hợp lệ.' });
            return;
          }

          const combo = evaluateCombo(selected);
          if (!combo) {
            sendJson(ws, 'game:error', { error: 'Bộ bài không hợp lệ theo luật Tiến Lên Miền Nam!' });
            return;
          }

          if (room.mustInclude3Spade && !selected.some((c) => c.rank === 3 && c.suit === 'spades')) {
            sendJson(ws, 'game:error', { error: 'Ván đầu tiên phải đánh kèm lá 3♠!' });
            return;
          }

          if (!canBeat(combo, room.lastPlay?.combo || null)) {
            sendJson(ws, 'game:error', { error: 'Bài của bạn chưa đủ lớn để chặt bài trên bàn!' });
            return;
          }

          const remaining = hand.filter((c) => !cardIds.includes(c.id));
          room.hands.set(session.userId, remaining);
          room.lastPlay = { userId: session.userId, userName: session.userName, combo };
          room.mustInclude3Spade = false;

          if (remaining.length === 0) {
            room.status = 'finished';
            room.winnerUserId = session.userId;
            room.winnerName = session.userName;
            room.turnUserId = null;
            room.chat.push({
              id: `gc-${Date.now()}`,
              sender: 'Hệ thống',
              text: `${session.userName} đã về nhất ván Tiến Lên!`,
              timestamp: nowTimeStr(),
            });
            broadcastGameRoom(room);
            broadcastGameRoomList();
            return;
          }

          // Advance turn to next active (non-passed) seated player
          const curIdx = room.seats.findIndex((s) => s.userId === session.userId);
          let nextUserId: string | null = null;
          for (let offset = 1; offset <= room.seats.length; offset++) {
            const cand = room.seats[(curIdx + offset) % room.seats.length];
            if (!room.passedUserIds.has(cand.userId)) {
              nextUserId = cand.userId;
              break;
            }
          }
          room.turnUserId = nextUserId;
          broadcastGameRoom(room);
          return;
        }

        if (msg.type === 'game:pass_turn') {
          const room = session.gameRoomId ? gameRooms.get(session.gameRoomId) : null;
          if (!room || room.gameType !== 'tien-len' || room.status !== 'playing') return;
          if (room.turnUserId !== session.userId) return;
          if (!room.lastPlay) {
            sendJson(ws, 'game:error', { error: 'Bạn đang cầm cái vòng mới, không thể bỏ lượt!' });
            return;
          }

          room.passedUserIds.add(session.userId);
          const remainingActive = room.seats.filter((s) => !room.passedUserIds.has(s.userId));

          if (remainingActive.length <= 1) {
            // New round starts with the lastPlay owner (or remaining active seat)
            const leadId =
              remainingActive[0]?.userId ||
              room.lastPlay.userId ||
              room.seats[0]?.userId ||
              null;
            room.passedUserIds.clear();
            room.lastPlay = null;
            room.turnUserId = leadId;
          } else {
            const curIdx = room.seats.findIndex((s) => s.userId === session.userId);
            for (let offset = 1; offset <= room.seats.length; offset++) {
              const cand = room.seats[(curIdx + offset) % room.seats.length];
              if (!room.passedUserIds.has(cand.userId)) {
                room.turnUserId = cand.userId;
                break;
              }
            }
          }
          broadcastGameRoom(room);
          return;
        }

        if (msg.type === 'game:caro_move') {
          const room = session.gameRoomId ? gameRooms.get(session.gameRoomId) : null;
          if (!room || room.gameType !== 'caro' || room.status !== 'playing') return;

          const seatIdx = room.seats.findIndex((s) => s.userId === session.userId);
          if (seatIdx === -1) {
            sendJson(ws, 'game:error', { error: 'Bạn đang ở chế độ khán giả.' });
            return;
          }

          const mySymbol: 'X' | 'O' = seatIdx === 0 ? 'X' : 'O';
          if (room.caroTurn !== mySymbol) {
            sendJson(ws, 'game:error', { error: `Chưa tới lượt quân ${mySymbol}!` });
            return;
          }

          const index = Number(payload.index);
          if (!Number.isInteger(index) || index < 0 || index >= 225 || room.caroBoard[index] !== null) {
            return;
          }

          room.caroBoard[index] = mySymbol;
          room.caroLastMove = index;

          const winLine = checkCaroWin(room.caroBoard, index);
          if (winLine) {
            room.caroWinLine = winLine;
            room.status = 'finished';
            room.winnerUserId = session.userId;
            room.winnerName = session.userName;
            room.turnUserId = null;
            room.chat.push({
              id: `gc-${Date.now()}`,
              sender: 'Hệ thống',
              text: `${session.userName} (${mySymbol}) đã thắng 5 quân liên tiếp!`,
              timestamp: nowTimeStr(),
            });
            broadcastGameRoom(room);
            broadcastGameRoomList();
            return;
          }

          if (room.caroBoard.every((cell) => cell !== null)) {
            room.isDraw = true;
            room.status = 'finished';
            room.turnUserId = null;
            broadcastGameRoom(room);
            broadcastGameRoomList();
            return;
          }

          room.caroTurn = mySymbol === 'X' ? 'O' : 'X';
          room.turnUserId = room.seats[room.caroTurn === 'X' ? 0 : 1]?.userId || null;
          broadcastGameRoom(room);
          return;
        }

        if (msg.type === 'game:chat') {
          const room = session.gameRoomId ? gameRooms.get(session.gameRoomId) : null;
          if (!room) return;
          const text = String(payload.text || '').trim().slice(0, 240);
          if (!text) return;
          room.chat.push({
            id: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            sender: session.userName,
            text,
            timestamp: nowTimeStr(),
          });
          broadcastGameRoom(room);
          return;
        }
      } catch {
        // Ignore malformed WebSocket packets
      }
    });

    ws.on('close', () => {
      const session = clients.get(sessionUserId);
      if (!session) return;
      leaveKaraokeRoom(session);
      leaveServerGameRoom(session);
      clients.delete(sessionUserId);
      leaveYmRoom(session);
      broadcastYmDirectory();
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    const escapeHtmlAttr = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      try {
        let html = fs.readFileSync(indexHtmlPath, 'utf8');
        const baseUrl = resolveAppBaseUrl(req);
        const reqPath = req.path || '/';
        let seoTitle = 'Hát Karaoke Không Quảng Cáo & Nghe Nhạc YouTube MP3 | Karaoke Online';
        let seoDesc =
          'Hát karaoke không quảng cáo pop-up trên điện thoại & TV, nghe nhạc YouTube MP3 và nghe nhạc không quảng cáo mọi thể loại ngay trong trình duyệt.';
        let canonicalPath = reqPath === '/' ? '/' : reqPath;

        if (reqPath === '/hat-karaoke-khong-quang-cao') {
          seoTitle = 'Kho Nhạc Hát Karaoke Không Quảng Cáo | Karaoke Online';
          seoDesc =
            'Kho bài hát karaoke không quảng cáo pop-up: lọc sẵn Bolero, Nhạc Trẻ, Remix, Nhạc Trữ Tình beat chuẩn YouTube ngay trên trình duyệt.';
        } else if (reqPath === '/nghe-nhac-youtube-mp3' || reqPath === '/nghe-nhac-khong-quang-cao') {
          seoTitle = 'Nghe Nhạc YouTube MP3 & Nghe Nhạc Không Quảng Cáo | Karaoke Online';
          seoDesc =
            'Nghe nhạc YouTube MP3 và nghe nhạc không quảng cáo pop-up mọi thể loại: Bolero, Nhạc Trẻ, Nhạc Trữ Tình, Nhạc Sống, hỗ trợ lưu lịch sử & tắt màn hình.';
        } else if (reqPath === '/phong-hat-karaoke-truc-tuyen') {
          seoTitle = 'Phòng Hát Karaoke Trực Tuyến Mic Live | Karaoke Online';
          seoDesc =
            'Vào phòng hát karaoke trực tuyến miễn phí, bật mic echo trộn nhạc nền YouTube, tặng tim cổ vũ ca sĩ và hát karaoke không quảng cáo cùng bạn bè.';
        } else if (reqPath === '/phong-chat-va-game') {
          seoTitle = 'Phòng Chat 34 Tỉnh Thành Mới & Sảnh Game | Karaoke Online';
          seoDesc =
            'Chat chung 34 tỉnh thành mới Việt Nam, chat riêng 1-1, chơi Tiến Lên & Cờ Caro kết hợp hát karaoke và nghe nhạc YouTube MP3 không quảng cáo.';
        } else {
          const rawCommunityRoomId = parseCommunityRoomPath(reqPath);
          const resolvedRoomId = rawCommunityRoomId
            ? resolveVietnamChatRoomId(rawCommunityRoomId)
            : null;
          if (rawCommunityRoomId && resolvedRoomId && VIETNAM_CHAT_ROOM_MAP.has(resolvedRoomId)) {
            const roomDef = getVietnamChatRoom(resolvedRoomId);
            seoTitle = `${roomDef.name} (${roomDef.group}) — Nghe Nhạc & Chat Online | Karaoke Online`;
            seoDesc = `${roomDef.topic}. Tham gia ${roomDef.name} để chat chung, chat riêng 1-1 và nghe nhạc ${roomDef.suggestedGenre} không quảng cáo cùng mọi người.`;
          } else {
            const media = parseMediaUrlPath(reqPath);
            if (media) {
              const matchedSong = KARAOKE_SONGS.find((s) => s.youtubeId === media.youtubeId);
              const cleanTitle = matchedSong?.title || media.rawSlug.replace(/-/g, ' ');
              if (media.kind === 'mp3') {
                seoTitle = `${cleanTitle} MP3 — Nghe Nhạc YouTube MP3 | Karaoke Online`;
                seoDesc = `Nghe nhạc YouTube MP3 bài ${cleanTitle}. Nghe nhạc không quảng cáo pop-up ngay trong trình duyệt điện thoại, hỗ trợ tắt màn hình.`;
              } else {
                seoTitle = `${cleanTitle} — Hát Karaoke Không Quảng Cáo | Karaoke Online`;
                seoDesc = `Hát karaoke không quảng cáo bài ${cleanTitle}${matchedSong ? ` (${matchedSong.artist})` : ''}. Beat chuẩn chữ chạy mượt trên trình duyệt điện thoại và TV.`;
              }
            }
          }
        }

        const fullUrl = `${baseUrl}${canonicalPath}`;
        html = html
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlAttr(seoTitle)}</title>`)
          .replace(
            /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
            `<meta name="description" content="${escapeHtmlAttr(seoDesc)}" />`
          )
          .replace(
            /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
            `<meta property="og:title" content="${escapeHtmlAttr(seoTitle)}" />`
          )
          .replace(
            /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
            `<meta property="og:description" content="${escapeHtmlAttr(seoDesc)}" />`
          )
          .replace(
            /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
            `<meta property="og:url" content="${escapeHtmlAttr(fullUrl)}" />`
          )
          .replace(
            /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
            `<meta name="twitter:title" content="${escapeHtmlAttr(seoTitle)}" />`
          )
          .replace(
            /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
            `<meta name="twitter:description" content="${escapeHtmlAttr(seoDesc)}" />`
          )
          .replace(
            '</head>',
            `  <link rel="canonical" href="${escapeHtmlAttr(fullUrl)}" />\n  </head>`
          );

        res.type('text/html; charset=utf-8').send(html);
      } catch {
        res.sendFile(indexHtmlPath);
      }
    });
  }

  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Karaoke Online server running at http://localhost:${port}`);
  });
}

bootstrap();
