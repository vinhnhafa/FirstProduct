export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function slugifyTitle(title: string): string {
  const clean = removeVietnameseTones(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return clean || 'bai-hat';
}

export function buildSongUrlPath(
  title: string,
  youtubeId: string,
  kind: 'karaoke' | 'mp3'
): string {
  let slug = slugifyTitle(title);
  if (kind === 'karaoke' && !slug.includes('karaoke')) {
    slug = `${slug}-karaoke`;
  } else if (kind === 'mp3' && !slug.includes('mp3')) {
    slug = `${slug}-mp3`;
  }
  return `/${slug}-${youtubeId}`;
}

export function parseMediaUrlPath(
  pathname: string
): { youtubeId: string; kind: 'karaoke' | 'mp3'; rawSlug: string } | null {
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
  if (!cleanPath || cleanPath.startsWith('api/')) return null;
  const match = cleanPath.match(/^(.*)-([a-zA-Z0-9_-]{11})$/);
  if (!match) return null;
  const rawSlug = match[1];
  const youtubeId = match[2];
  const kind: 'karaoke' | 'mp3' =
    rawSlug.endsWith('-mp3') || rawSlug.includes('-mp3-') ? 'mp3' : 'karaoke';
  return { youtubeId, kind, rawSlug };
}

export function parseStaticSeoView(
  pathname: string
): 'browse' | 'music' | 'rooms' | 'social' | null {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (clean === 'hat-karaoke-khong-quang-cao') return 'browse';
  if (clean === 'nghe-nhac-youtube-mp3' || clean === 'nghe-nhac-khong-quang-cao') return 'music';
  if (clean === 'phong-hat-karaoke-truc-tuyen') return 'rooms';
  if (clean === 'phong-chat-va-game') return 'social';
  if (clean.startsWith('phong/')) return 'social';
  return null;
}

export function parseCommunityRoomPath(pathname: string): string | null {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const match = clean.match(/^phong\/([a-z0-9-]+)$/);
  return match ? match[1] : null;
}
