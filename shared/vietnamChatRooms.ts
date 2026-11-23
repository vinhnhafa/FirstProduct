export type ChatRoomGroup = 'Chủ đề chung' | 'Miền Bắc' | 'Miền Trung & Tây Nguyên' | 'Miền Nam';

export interface VietnamChatRoomDef {
  id: string;
  name: string;
  shortName: string;
  group: ChatRoomGroup;
  topic: string;
}

export const VIETNAM_CHAT_ROOMS: VietnamChatRoomDef[] = [
  // Chủ đề chung
  {
    id: 'nhac-tre',
    name: 'Phòng Nhạc Trẻ 9x',
    shortName: 'Nhạc Trẻ 9x',
    group: 'Chủ đề chung',
    topic: 'Giao lưu V-Pop, tìm bạn song ca & ôn kỷ niệm Y!M toàn quốc',
  },
  {
    id: 'bolero',
    name: 'Phòng Bolero Sầu Tím',
    shortName: 'Bolero Sầu Tím',
    group: 'Chủ đề chung',
    topic: 'Trữ tình, nhạc vàng & tâm sự đêm khuya mọi miền',
  },
  {
    id: 'remix',
    name: 'Phòng Quẩy Remix',
    shortName: 'Quẩy Remix',
    group: 'Chủ đề chung',
    topic: 'Nhạc sàn cực căng, bay hết mình cùng anh em cả nước',
  },
  {
    id: 'game-thu',
    name: 'Phòng Cao Thủ Game',
    shortName: 'Cao Thủ Game',
    group: 'Chủ đề chung',
    topic: 'Rủ nhau đánh Tiến Lên Miền Nam & Cờ Caro trực tuyến',
  },

  // Miền Bắc (25)
  { id: 'tinh-ha-noi', name: 'Phòng Hà Nội', shortName: 'Hà Nội', group: 'Miền Bắc', topic: 'Hội đồng hương Hà Nội · Giao lưu hát Karaoke & Game' },
  { id: 'tinh-hai-phong', name: 'Phòng Hải Phòng', shortName: 'Hải Phòng', group: 'Miền Bắc', topic: 'Hội đồng hương Hải Phòng · Đất Cảng hát hay' },
  { id: 'tinh-quang-ninh', name: 'Phòng Quảng Ninh', shortName: 'Quảng Ninh', group: 'Miền Bắc', topic: 'Giao lưu anh chị em Hạ Long - Quảng Ninh' },
  { id: 'tinh-bac-ninh', name: 'Phòng Bắc Ninh', shortName: 'Bắc Ninh', group: 'Miền Bắc', topic: 'Kinh Bắc Quan Họ · Kết bạn hát Karaoke & Tiến Lên' },
  { id: 'tinh-bac-giang', name: 'Phòng Bắc Giang', shortName: 'Bắc Giang', group: 'Miền Bắc', topic: 'Hội đồng hương Bắc Giang giao lưu ca nhạc' },
  { id: 'tinh-hai-duong', name: 'Phòng Hải Dương', shortName: 'Hải Dương', group: 'Miền Bắc', topic: 'Hội đồng hương Hải Dương · Kết bạn bốn phương' },
  { id: 'tinh-hung-yen', name: 'Phòng Hưng Yên', shortName: 'Hưng Yên', group: 'Miền Bắc', topic: 'Hội đồng hương Phố Hiến - Hưng Yên' },
  { id: 'tinh-thai-binh', name: 'Phòng Thái Bình', shortName: 'Thái Bình', group: 'Miền Bắc', topic: 'Hội đồng hương Thái Bình · Giao lưu ca hát' },
  { id: 'tinh-nam-dinh', name: 'Phòng Nam Định', shortName: 'Nam Định', group: 'Miền Bắc', topic: 'Thành Nam hội ngộ · Hát Karaoke & đánh Caro' },
  { id: 'tinh-ninh-binh', name: 'Phòng Ninh Bình', shortName: 'Ninh Bình', group: 'Miền Bắc', topic: 'Cố đô Ninh Bình · Kết bạn tám chuyện Yahoo' },
  { id: 'tinh-ha-nam', name: 'Phòng Hà Nam', shortName: 'Hà Nam', group: 'Miền Bắc', topic: 'Hội đồng hương Hà Nam giao lưu thân mật' },
  { id: 'tinh-vinh-phuc', name: 'Phòng Vĩnh Phúc', shortName: 'Vĩnh Phúc', group: 'Miền Bắc', topic: 'Hội đồng hương Vĩnh Phúc · Ca hát giải trí' },
  { id: 'tinh-phu-tho', name: 'Phòng Phú Thọ', shortName: 'Phú Thọ', group: 'Miền Bắc', topic: 'Đất Tổ Phú Thọ · Giao lưu ca nhạc mỗi tối' },
  { id: 'tinh-thai-nguyen', name: 'Phòng Thái Nguyên', shortName: 'Thái Nguyên', group: 'Miền Bắc', topic: 'Đất chè Thái Nguyên · Giao lưu sinh viên & bạn bè' },
  { id: 'tinh-bac-kan', name: 'Phòng Bắc Kạn', shortName: 'Bắc Kạn', group: 'Miền Bắc', topic: 'Hội đồng hương Bắc Kạn kết nối bạn bè' },
  { id: 'tinh-cao-bang', name: 'Phòng Cao Bằng', shortName: 'Cao Bằng', group: 'Miền Bắc', topic: 'Hội đồng hương Cao Bằng giao lưu văn nghệ' },
  { id: 'tinh-lang-son', name: 'Phòng Lạng Sơn', shortName: 'Lạng Sơn', group: 'Miền Bắc', topic: 'Xứ Lạng Lạng Sơn · Giao lưu hát cùng nhau' },
  { id: 'tinh-tuyen-quang', name: 'Phòng Tuyên Quang', shortName: 'Tuyên Quang', group: 'Miền Bắc', topic: 'Thành Tuyên giao lưu hát Karaoke & chơi game' },
  { id: 'tinh-ha-giang', name: 'Phòng Hà Giang', shortName: 'Hà Giang', group: 'Miền Bắc', topic: 'Cao nguyên đá Hà Giang · Kết nối tâm giao' },
  { id: 'tinh-lao-cai', name: 'Phòng Lào Cai', shortName: 'Lào Cai', group: 'Miền Bắc', topic: 'Lào Cai - Sa Pa · Giao lưu nhạc trẻ & trữ tình' },
  { id: 'tinh-yen-bai', name: 'Phòng Yên Bái', shortName: 'Yên Bái', group: 'Miền Bắc', topic: 'Hội đồng hương Yên Bái trò chuyện cuối ngày' },
  { id: 'tinh-lai-chau', name: 'Phòng Lai Châu', shortName: 'Lai Châu', group: 'Miền Bắc', topic: 'Hội đồng hương Lai Châu kết bạn bốn phương' },
  { id: 'tinh-dien-bien', name: 'Phòng Điện Biên', shortName: 'Điện Biên', group: 'Miền Bắc', topic: 'Hội đồng hương Điện Biên giao lưu ca nhạc' },
  { id: 'tinh-son-la', name: 'Phòng Sơn La', shortName: 'Sơn La', group: 'Miền Bắc', topic: 'Tây Bắc Sơn La · Giao lưu ca hát & giải trí' },
  { id: 'tinh-hoa-binh', name: 'Phòng Hòa Bình', shortName: 'Hòa Bình', group: 'Miền Bắc', topic: 'Hội đồng hương Hòa Bình · Chia sẻ bài hát hay' },

  // Miền Trung & Tây Nguyên (19)
  { id: 'tinh-thanh-hoa', name: 'Phòng Thanh Hóa', shortName: 'Thanh Hóa', group: 'Miền Trung & Tây Nguyên', topic: 'Xứ Thanh hội ngộ · Hát Karaoke & đánh Tiến Lên' },
  { id: 'tinh-nghe-an', name: 'Phòng Nghệ An', shortName: 'Nghệ An', group: 'Miền Trung & Tây Nguyên', topic: 'Xứ Nghệ thương nhau · Giao lưu dân ca & Bolero' },
  { id: 'tinh-ha-tinh', name: 'Phòng Hà Tĩnh', shortName: 'Hà Tĩnh', group: 'Miền Trung & Tây Nguyên', topic: 'Hội đồng hương Hà Tĩnh · Kết bạn gần xa' },
  { id: 'tinh-quang-binh', name: 'Phòng Quảng Bình', shortName: 'Quảng Bình', group: 'Miền Trung & Tây Nguyên', topic: 'Quảng Bình quê ta · Giao lưu văn nghệ trực tuyến' },
  { id: 'tinh-quang-tri', name: 'Phòng Quảng Trị', shortName: 'Quảng Trị', group: 'Miền Trung & Tây Nguyên', topic: 'Hội đồng hương Quảng Trị tâm sự & ca hát' },
  { id: 'tinh-thua-thien-hue', name: 'Phòng Thừa Thiên Huế', shortName: 'Huế', group: 'Miền Trung & Tây Nguyên', topic: 'Cố đô Huế mộng mơ · Nghe nhạc trữ tình & Bolero' },
  { id: 'tinh-da-nang', name: 'Phòng Đà Nẵng', shortName: 'Đà Nẵng', group: 'Miền Trung & Tây Nguyên', topic: 'Thành phố đáng sống Đà Nẵng · Giao lưu hát Live & Game' },
  { id: 'tinh-quang-nam', name: 'Phòng Quảng Nam', shortName: 'Quảng Nam', group: 'Miền Trung & Tây Nguyên', topic: 'Xứ Quảng thân thương · Giao lưu đồng hương mọi nơi' },
  { id: 'tinh-quang-ngai', name: 'Phòng Quảng Ngãi', shortName: 'Quảng Ngãi', group: 'Miền Trung & Tây Nguyên', topic: 'Hội đồng hương Quảng Ngãi · Hát hay kết bạn' },
  { id: 'tinh-binh-dinh', name: 'Phòng Bình Định', shortName: 'Bình Định', group: 'Miền Trung & Tây Nguyên', topic: 'Đất võ Bình Định · Giao lưu ca hát & Cờ Caro' },
  { id: 'tinh-phu-yen', name: 'Phòng Phú Yên', shortName: 'Phú Yên', group: 'Miền Trung & Tây Nguyên', topic: 'Hoa vàng cỏ xanh Phú Yên · Kết nối bạn bè' },
  { id: 'tinh-khanh-hoa', name: 'Phòng Khánh Hòa', shortName: 'Khánh Hòa (Nha Trang)', group: 'Miền Trung & Tây Nguyên', topic: 'Biển Nha Trang - Khánh Hòa · Giao lưu nhạc trẻ & chill' },
  { id: 'tinh-ninh-thuan', name: 'Phòng Ninh Thuận', shortName: 'Ninh Thuận', group: 'Miền Trung & Tây Nguyên', topic: 'Phan Rang - Ninh Thuận giao lưu trực tuyến' },
  { id: 'tinh-binh-thuan', name: 'Phòng Bình Thuận', shortName: 'Bình Thuận', group: 'Miền Trung & Tây Nguyên', topic: 'Phan Thiết - Bình Thuận · Giao lưu ca nhạc mỗi tối' },
  { id: 'tinh-kon-tum', name: 'Phòng Kon Tum', shortName: 'Kon Tum', group: 'Miền Trung & Tây Nguyên', topic: 'Phố núi Kon Tum · Kết bạn hát Karaoke cùng nhau' },
  { id: 'tinh-gia-lai', name: 'Phòng Gia Lai', shortName: 'Gia Lai', group: 'Miền Trung & Tây Nguyên', topic: 'Phố núi Pleiku - Gia Lai · Acoustic & Nhạc Trẻ' },
  { id: 'tinh-dak-lak', name: 'Phòng Đắk Lắk', shortName: 'Đắk Lắk', group: 'Miền Trung & Tây Nguyên', topic: 'Buôn Ma Thuột - Đắk Lắk · Cà phê & Karaoke online' },
  { id: 'tinh-dak-nong', name: 'Phòng Đắk Nông', shortName: 'Đắk Nông', group: 'Miền Trung & Tây Nguyên', topic: 'Hội đồng hương Đắk Nông giao lưu kết bạn' },
  { id: 'tinh-lam-dong', name: 'Phòng Lâm Đồng', shortName: 'Lâm Đồng (Đà Lạt)', group: 'Miền Trung & Tây Nguyên', topic: 'Đà Lạt mộng mơ · Nghe nhạc chill & tâm sự đêm' },

  // Miền Nam (19)
  { id: 'tinh-tp-hcm', name: 'Phòng TP. Hồ Chí Minh', shortName: 'TP.HCM', group: 'Miền Nam', topic: 'Sài Gòn năng động · Kết bạn hát Karaoke & Tiến Lên' },
  { id: 'tinh-binh-duong', name: 'Phòng Bình Dương', shortName: 'Bình Dương', group: 'Miền Nam', topic: 'Anh chị em Bình Dương · Giao lưu sau giờ làm' },
  { id: 'tinh-dong-nai', name: 'Phòng Đồng Nai', shortName: 'Đồng Nai', group: 'Miền Nam', topic: 'Biên Hòa - Đồng Nai · Kết bạn hát ca giải trí' },
  { id: 'tinh-ba-ria-vung-tau', name: 'Phòng Bà Rịa - Vũng Tàu', shortName: 'Vũng Tàu', group: 'Miền Nam', topic: 'Phố biển Vũng Tàu · Nghe nhạc Remix & giao lưu' },
  { id: 'tinh-binh-phuoc', name: 'Phòng Bình Phước', shortName: 'Bình Phước', group: 'Miền Nam', topic: 'Hội đồng hương Bình Phước · Hát Bolero & Nhạc Trẻ' },
  { id: 'tinh-tay-ninh', name: 'Phòng Tây Ninh', shortName: 'Tây Ninh', group: 'Miền Nam', topic: 'Đất thánh Tây Ninh · Giao lưu bạn bè bốn phương' },
  { id: 'tinh-long-an', name: 'Phòng Long An', shortName: 'Long An', group: 'Miền Nam', topic: 'Cửa ngõ miền Tây Long An · Ca cổ & Bolero' },
  { id: 'tinh-tien-giang', name: 'Phòng Tiền Giang', shortName: 'Tiền Giang', group: 'Miền Nam', topic: 'Mỹ Tho - Tiền Giang · Giao lưu trữ tình miền Tây' },
  { id: 'tinh-ben-tre', name: 'Phòng Bến Tre', shortName: 'Bến Tre', group: 'Miền Nam', topic: 'Xứ dừa Bến Tre · Hát Karaoke Bolero ngọt lịm' },
  { id: 'tinh-tra-vinh', name: 'Phòng Trà Vinh', shortName: 'Trà Vinh', group: 'Miền Nam', topic: 'Hội đồng hương Trà Vinh giao lưu văn nghệ' },
  { id: 'tinh-vinh-long', name: 'Phòng Vĩnh Long', shortName: 'Vĩnh Long', group: 'Miền Nam', topic: 'Miền Tây Vĩnh Long · Kết bạn hát hay' },
  { id: 'tinh-dong-thap', name: 'Phòng Đồng Tháp', shortName: 'Đồng Tháp', group: 'Miền Nam', topic: 'Đất sen hồng Đồng Tháp · Giao lưu nhạc sến Bolero' },
  { id: 'tinh-an-giang', name: 'Phòng An Giang', shortName: 'An Giang', group: 'Miền Nam', topic: 'Long Xuyên - Châu Đốc An Giang · Tám chuyện & ca hát' },
  { id: 'tinh-kien-giang', name: 'Phòng Kiên Giang', shortName: 'Kiên Giang', group: 'Miền Nam', topic: 'Rạch Giá - Phú Quốc · Giao lưu kết bạn gần xa' },
  { id: 'tinh-can-tho', name: 'Phòng Cần Thơ', shortName: 'Cần Thơ', group: 'Miền Nam', topic: 'Tây Đô Cần Thơ · Giao lưu giọng ca miền sông nước' },
  { id: 'tinh-hau-giang', name: 'Phòng Hậu Giang', shortName: 'Hậu Giang', group: 'Miền Nam', topic: 'Hội đồng hương Hậu Giang giao lưu thân tình' },
  { id: 'tinh-soc-trang', name: 'Phòng Sóc Trăng', shortName: 'Sóc Trăng', group: 'Miền Nam', topic: 'Hội đồng hương Sóc Trăng · Giao lưu văn nghệ' },
  { id: 'tinh-bac-lieu', name: 'Phòng Bạc Liêu', shortName: 'Bạc Liêu', group: 'Miền Nam', topic: 'Quê hương Dạ Cổ Hoài Lang · Giao lưu hát trữ tình' },
  { id: 'tinh-ca-mau', name: 'Phòng Cà Mau', shortName: 'Cà Mau', group: 'Miền Nam', topic: 'Đất mũi Cà Mau · Kết nối anh em toàn quốc' },
];

export const VIETNAM_CHAT_ROOM_MAP = new Map<string, VietnamChatRoomDef>(
  VIETNAM_CHAT_ROOMS.map((room) => [room.id, room])
);

export function getVietnamChatRoom(roomId: string): VietnamChatRoomDef {
  return VIETNAM_CHAT_ROOM_MAP.get(roomId) ?? VIETNAM_CHAT_ROOMS[0];
}
