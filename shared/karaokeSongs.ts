export interface SharedKaraokeSong {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  genre:
    | 'Bolero'
    | 'Nhạc Trẻ'
    | 'Remix'
    | 'Nhạc Trữ Tình';
  durationSeconds: number;
  lyrics: string[];
  tone?: string;
  viewCountText?: string;
  publishedTimeText?: string;
  isKaraoke?: boolean;
}

export const KARAOKE_SONGS: SharedKaraokeSong[] = [
  {
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
      'Thôi nhắc chi kỷ niệm, lòng thêm nhớ thêm sầu',
      'Đường xưa lối cũ giờ đành cách chia đôi bờ',
      'Người đi bên ấy có nhớ phút giây ban đầu',
      'Thiệp hồng trao tay nghe nhói tim đau',
      'Chúc em yên vui bên người thương mới...'
    ],
  },
  {
    id: 'song-2',
    youtubeId: 'CZO9CbtOEmg',
    title: 'Karaoke Duyên Phận (Tone Nữ)',
    artist: 'Như Quỳnh · Hiếu Organ',
    genre: 'Bolero',
    durationSeconds: 325,
    tone: 'Tone Nữ',
    isKaraoke: true,
    lyrics: [
      'Phận làm con gái, chưa một lần yêu ai',
      'Nhìn về tương lai mà thấy như sông rộng đường dài',
      'Cảnh nhà neo đơn, bầy em chưa lớn trĩu đôi vai gánh nhọc nhằn',
      'Thầy mẹ thương em nhờ tìm người se duyên...',
      'Lòng cầu mong em đậu bến cho yên một bóng thuyền',
      'Lứa đôi tình duyên còn chưa lưu luyến',
      'Sợ người ta đến em khóc sau bao lời khuyên',
      'Chưa yêu lần nào biết ra làm sao',
      'Biết trong tình yêu như thế nào',
      'Sông sâu còn có kẻ dò, nào ai lấy thước mà đo lòng người',
      'Thôi em đừng khóc nữa, chuyện đời hợp tan là duyên phận...'
    ],
  },
  {
    id: 'song-3',
    youtubeId: 'NfGfaliF640',
    title: 'Karaoke Đắp Mộ Cuộc Tình (Tone Nữ)',
    artist: 'Đan Nguyên · Beat Phối Dễ Hát',
    genre: 'Bolero',
    durationSeconds: 310,
    tone: 'Tone Nữ',
    isKaraoke: true,
    lyrics: [
      'Say giấc mộng ban đầu, yêu người thuở mới đôi mươi',
      'Em đang độ trăng tròn, từng ngày qua phố',
      'Áo em trắng bay hững hờ, lòng anh thầm ước mơ',
      'Rồi một hôm kia, em bước lên xe hoa...',
      'Hai mươi năm cuộc tình, ngỡ rằng đã phai phôi',
      'Nào ngờ hôm nay ta gặp lại nhau đây',
      'Em vẫn đẹp như ngày xưa, còn anh tóc đã điểm sương',
      'Đành chôn sâu kỷ niệm, đắp mộ cuộc tình đã qua',
      'Thôi nhé em đừng buồn, chuyện tình ta xem như giấc chiêm bao...'
    ],
  },
  {
    id: 'song-4',
    youtubeId: '6TvFRJixfM4',
    title: 'Karaoke Vùng Lá Me Bay (Tone Nữ)',
    artist: 'Như Quỳnh · Nhạc Sống',
    genre: 'Bolero',
    durationSeconds: 305,
    tone: 'Tone Nữ',
    isKaraoke: true,
    lyrics: [
      'Nhìn lá me bay nhớ kỷ niệm hai chúng mình',
      'Ngày đó quen nhau vương chút tình trên tóc mây',
      'Đôi mắt thơ ngây, hoa nắng ươm đầy',
      'Đẹp tựa như lá me bay nên tình anh trót vay',
      'Ngày đó yêu nhau chúng ta thường qua lối này',
      'Từng lá me rơi vương gót hài hoa bướm say',
      'Tơ nắng đơm bông trên má em hồng',
      'Đẹp tựa như lá me bay khung trời ươm ước mơ...',
      'Nhưng nay xa rồi còn đâu những chiều hẹn hò',
      'Lá me vẫn rơi mà người thương nay chốn nao...'
    ],
  },
  {
    id: 'song-5',
    youtubeId: '7f7GZnm4AN8',
    title: 'Karaoke Gõ Cửa Trái Tim (Tone Nữ)',
    artist: 'Nhạc Sống Rumba Dễ Hát',
    genre: 'Bolero',
    durationSeconds: 298,
    tone: 'Tone Nữ',
    isKaraoke: true,
    lyrics: [
      'Gõ cửa trái tim van em được vào',
      'Dù tình xót xa chung thân huyệt đào',
      'Ngủ vùi với nhau nghe tim nghẹn ngào',
      'Từ đó ta mất nhau trong niềm đau...',
      'Gõ cửa trái tim sao em hững hờ',
      'Ngõ hồn tái tê năm tháng mong chờ',
      'Đừng để giá băng trên đôi môi mềm',
      'Hãy mở cửa tim cho anh bước vào yêu thương...'
    ],
  },
  {
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
      'Ngắm em thật lâu con tim anh yếu mềm',
      'Đắm say từ phút đó, từng giây trôi yêu thêm',
      'Cầm tay anh, dựa vai anh, kề bên anh nơi này có anh',
      'Gió mang câu tình ca, ngàn ánh sao vụt qua, nhẹ ôm lấy em',
      'Cầm tay anh, dựa vai anh, kề bên anh nơi này có anh',
      'Khép đôi mi thật lâu, nguyện mãi bên cạnh nhau, yêu say đắm như ngày đầu',
      'Mùa xuân đến bình yên, cho anh những giấc mơ',
      'Hạ lưu giữ ngày mưa, ngọt ngào nên thơ...'
    ],
  },
  {
    id: 'song-7',
    youtubeId: 'iIsfYYw4b2A',
    title: 'Karaoke Cắt Đôi Nỗi Sầu (Official Beat)',
    artist: 'Tăng Duy Tân',
    genre: 'Nhạc Trẻ',
    durationSeconds: 185,
    tone: 'Tone Nam',
    isKaraoke: true,
    lyrics: [
      'Cắt đôi nỗi sầu, anh buông tay cắt đôi nỗi sầu',
      'Anh cắt đi cả bóng hình, anh mang theo bên mình bấy lâu',
      'Nỗi đau đã cạn, cơn mưa trong tim cũng đã tan',
      'Anh bán đi mọi nỗi buồn, để chẳng còn gì ngoài thanh thản',
      'Em ơi anh muốn, mỗi tối đến anh không phải thất tình',
      'Muốn quên một bóng hình, em để lại trong tim',
      'Anh không thể đếm đã có bấy nhiêu đêm phải kiếm tìm',
      'Kiếm tìm một lý do để cho lòng này bình yên...'
    ],
  },
  {
    id: 'song-8',
    youtubeId: '2MUfA2g87vo',
    title: 'Karaoke Bên Trên Tầng Lầu',
    artist: 'Tăng Duy Tân · Big Arts Karaoke',
    genre: 'Nhạc Trẻ',
    durationSeconds: 192,
    tone: 'Tone Nam',
    isKaraoke: true,
    lyrics: [
      'Em ơi đừng khóc bóng tối trước mắt sẽ bắt em đi',
      'Em ơi đừng lo em ơi đừng cho tương lai vụt tắt',
      'Sâu trong màu mắt có chút tiếc nuối phút cuối chỉ vì',
      'Em đâu hề sai em đâu thể mãi để trái tim đau',
      'Không còn tương lai em cũng chẳng còn thương ai',
      'Sau bao niềm đau em mong rằng con tim em dừng lại',
      'Nỗi nhớ này lâu phai nhốt em trong một lâu đài',
      'Lâu đài của những cơn đau bất tận...'
    ],
  },
  {
    id: 'song-9',
    youtubeId: 'Vv2mtx5ZWwE',
    title: 'Karaoke Ngày Mai Người Ta Lấy Chồng',
    artist: 'Thành Đạt · Beat Chuẩn',
    genre: 'Nhạc Trẻ',
    durationSeconds: 318,
    tone: 'Tone Nam',
    isKaraoke: true,
    lyrics: [
      'Còn gì đâu em ơi, câu hứa xưa giờ phai phôi',
      'Giọt nước mắt rơi trên mi khi nhìn em bước bên người',
      'Ngày mai người ta lấy chồng, bỏ lại anh với khoảng trống',
      'Một đời thương nhớ mong, mà giờ đây hóa hư không',
      'Chúc em hạnh phúc bên người ta, quên đi những ngày tháng đã qua',
      'Anh đứng từ xa nhìn pháo hoa, lòng đau thắt nghẹn ngào xót xa',
      'Duyên mình đành lỡ từ đây, thôi đành chôn kín nỗi niềm này...'
    ],
  },
  {
    id: 'song-10',
    youtubeId: 'ofUsAErzKKw',
    title: 'Karaoke E Là Không Thể (Tone Nam)',
    artist: 'Anh Quân Idol x Đông Thiên Đức',
    genre: 'Nhạc Trẻ',
    durationSeconds: 275,
    tone: 'Tone Nam',
    isKaraoke: true,
    lyrics: [
      'Anh biết rằng mình chẳng thể giữ em ở lại',
      'Nỗi nhớ em cứ thế kéo dài qua từng đêm tối',
      'E là không thể quên đi bóng hình người thương năm ấy',
      'Chúc em luôn mỉm cười bình yên trên con đường mới...'
    ],
  },
  {
    id: 'song-11',
    youtubeId: 'H8qhY7rfflY',
    title: 'Karaoke Cắt Đôi Nỗi Sầu (Tone Nữ)',
    artist: 'Nhạc Sống Duy Cường',
    genre: 'Nhạc Trẻ',
    durationSeconds: 195,
    tone: 'Tone Nữ',
    isKaraoke: true,
    lyrics: [
      'Cắt đôi nỗi sầu, em buông tay cắt đôi nỗi sầu',
      'Em cắt đi cả bóng hình, mang theo bên mình bấy lâu',
      'Nỗi đau đã cạn, cơn mưa trong tim cũng đã tan...'
    ],
  },
  {
    id: 'song-12',
    youtubeId: 'z6HE1dr4S84',
    title: 'Karaoke See Tình (Cukak Remix)',
    artist: 'Hoàng Thùy Linh · Beat Remix',
    genre: 'Remix',
    durationSeconds: 205,
    tone: 'Tone Nữ',
    isKaraoke: true,
    lyrics: [
      'Ước gì em đã không lỡ yêu anh từ cái nhìn đầu tiên',
      'Mà đời đâu biết trước chữ ngờ, trái tim cứ thế rung rinh',
      'Tình tình tang tang tính tang, tình tang tang tang tính tình',
      'Giây phút em gặp anh là em biết em see tình',
      'Tình tình tình tang tang tính, đừng làm tim em điêu đứng',
      'Lỡ yêu rồi thì nói một câu cho lòng em bớt vấn vương'
    ],
  },
  {
    id: 'song-13',
    youtubeId: '_TozaOg109U',
    title: 'Karaoke Để Mị Nói Cho Mà Nghe (Remix)',
    artist: 'Hoàng Thùy Linh · Beat Nữ',
    genre: 'Remix',
    durationSeconds: 215,
    tone: 'Tone Nữ',
    isKaraoke: true,
    lyrics: [
      'Để Mị nói cho mà nghe, tâm hồn này chẳng muốn sầu đâu',
      'Mị còn trẻ Mị còn muốn đi chơi, thanh xuân sao phải ở nhà',
      'Xuân này Mị chẳng thèm khóc, Mị đi tìm niềm vui mới',
      'Ngọn gió núi rừng Tây Bắc thổi bay mọi ưu phiền',
      'Hãy cùng hòa nhịp trống chiêng, nâng ly chúc mừng đêm vui'
    ],
  },
  {
    id: 'song-14',
    youtubeId: 'wfk1ncPXOsc',
    title: 'Karaoke Bống Bống Bang Bang',
    artist: '365daband · Beat Sôi Động',
    genre: 'Remix',
    durationSeconds: 220,
    tone: 'Song ca Nam / Nữ',
    isKaraoke: true,
    lyrics: [
      'Ngày xưa có cô Tấm nết na hiền lành',
      'Bống bống bang bang, lên ăn cơm vàng cơm bạc nhà ta',
      'Chớ ăn cơm hẩm cháo hoa nhà người',
      'Nhạc lên thật căng nào cả phòng ơi',
      'Bống bống bang bang, vỗ tay theo nhịp rộn ràng'
    ],
  },
  {
    id: 'song-15',
    youtubeId: 'NzYaBnmECIo',
    title: 'Karaoke Diễm Xưa (Guitar Tone Nữ)',
    artist: 'Trịnh Công Sơn · Karaoke NBC',
    genre: 'Nhạc Trữ Tình',
    durationSeconds: 280,
    tone: 'Tone Nữ',
    isKaraoke: true,
    lyrics: [
      'Mưa vẫn mưa bay trên tầng tháp cổ',
      'Dài tay em mấy thuở mắt xanh xao',
      'Nghe lá thu mưa reo mòn gót nhỏ',
      'Đường dài hun hút cho mắt thêm sâu',
      'Mưa vẫn hay mưa trên hàng lá nhỏ',
      'Buổi chiều ngồi ngóng những chuyến mưa qua',
      'Chiều nay còn mưa sao em không lại...'
    ],
  },
  {
    id: 'song-16',
    youtubeId: '9jUNqo_oMBw',
    title: 'Karaoke Diễm Xưa (Guitar Tone Nam)',
    artist: 'Trịnh Công Sơn · Karaoke NBC',
    genre: 'Nhạc Trữ Tình',
    durationSeconds: 280,
    tone: 'Tone Nam',
    isKaraoke: true,
    lyrics: [
      'Mưa vẫn mưa bay trên tầng tháp cổ',
      'Dài tay em mấy thuở mắt xanh xao',
      'Nghe lá thu mưa reo mòn gót nhỏ',
      'Đường dài hun hút cho mắt thêm sâu',
      'Chiều nay còn mưa sao em không lại...'
    ],
  },
  {
    id: 'song-17',
    youtubeId: '2SyqfT06Tk0',
    title: 'Karaoke Về Đâu Mái Tóc Người Thương',
    artist: 'Quang Lê Official · Beat Chuẩn',
    genre: 'Nhạc Trữ Tình',
    durationSeconds: 295,
    tone: 'Tone Nam',
    isKaraoke: true,
    lyrics: [
      'Hồn lỡ sa vào đôi mắt em',
      'Chiều nao xõa tóc ngồi bên rèm',
      'Thầm ước nhưng nào đâu dám nói',
      'Khép tâm tư lại thôi',
      'Đường hoa vẫn chưa mở lối',
      'Về đâu mái tóc người thương, ơi hỡi chim chiều...'
    ],
  },
  {
    id: 'song-18',
    youtubeId: 'dd6WCCL-2Kg',
    title: 'Karaoke Hạ Trắng & Diễm Xưa',
    artist: 'Hồng Ngọc & Quang Dũng',
    genre: 'Nhạc Trữ Tình',
    durationSeconds: 290,
    tone: 'Song ca Nam / Nữ',
    isKaraoke: true,
    lyrics: [
      'Gọi nắng trên vai em gầy đường xa áo bay',
      'Nắng qua mắt buồn lòng hoa bướm say',
      'Lối em đi về trời không có mây',
      'Đường đi suốt mùa nắng lên thắp đầy',
      'Gọi nắng cho cơn mê chiều nhiều hoa trắng bay...'
    ],
  },
];
