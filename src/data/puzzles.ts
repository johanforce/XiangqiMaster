export interface PuzzleItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'tactics' | 'endgame' | 'classic';
  categoryLabel: string;
  difficulty: 'Cơ bản' | 'Trung cấp' | 'Cao cấp' | 'Kỳ tiên';
  turn: 'r' | 'b';
  fen: string;
  goal: string;
  description: string;
  hint: string;
  solutionHint?: string;
}

export const CLASSIC_PUZZLES: PuzzleItem[] = [
  {
    id: 'khau-dan-hoa-long',
    title: 'Khâu Dẫn Hóa Long (蚯蚓化龍)',
    subtitle: 'Tứ đại danh cục giang hồ lừng danh',
    category: 'classic',
    categoryLabel: 'Danh cục giang hồ',
    difficulty: 'Kỳ tiên',
    turn: 'r',
    fen: '3akab2/9/4b4/9/9/9/9/4B4/4A4/3K5 w - - 0 1',
    goal: 'Đỏ đi trước giành thắng thế hoặc phá vỡ thế vây hãm',
    description: 'Thế cờ giang hồ tuyệt đỉnh ví như loài giun đất uốn lượn biến thành Rồng thần, các nước biến kỳ ảo đòi hỏi tính toán sâu sắc.',
    hint: 'Tập trung phối hợp các quân cơ động, ép Tướng Đen vào thế hiểm hóc.',
    solutionHint: 'Kiểm soát lộ tướng và tránh cạm bẫy của Đen.',
  },
  {
    id: 'da-ma-thao-dien',
    title: 'Dã Mã Thao Điền (野馬操田)',
    subtitle: 'Ngựa hoang chạy giữa đồng xanh',
    category: 'classic',
    categoryLabel: 'Danh cục giang hồ',
    difficulty: 'Cao cấp',
    turn: 'r',
    fen: '2b1kab2/9/3a5/9/9/9/9/9/4A4/3K1A3 w - - 0 1',
    goal: 'Đỏ đi trước khéo léo thủ hòa hoặc phản công',
    description: 'Thế trận cổ xưa kinh điển mô tả sự dũng mãnh, biến hóa khôn lường của quân Mã kết hợp Tốt xông pha trận địa.',
    hint: 'Mã nhảy các vị trí then chốt, không cho tướng Đen thoát ra lộ thông.',
  },
  {
    id: 'that-tinh-tu-hoi',
    title: 'Thất Tinh Tụ Hội (七星聚會)',
    subtitle: 'Bảy ngôi sao hội tụ - Tuyệt tác cờ tàn',
    category: 'classic',
    categoryLabel: 'Danh cục giang hồ',
    difficulty: 'Kỳ tiên',
    turn: 'r',
    fen: '3k1ab2/9/4ba3/9/9/9/9/4B4/4A4/2BAK4 w - - 0 1',
    goal: 'Đỏ đi trước công thủ tinh tế giữ vững cục diện',
    description: 'Một trong những thế cờ nổi tiếng nhất trong lịch sử kỳ đạo Trung Hoa và Việt Nam với nhiều cạm bẫy trùng điệp.',
    hint: 'Tính toán từng nước chặn đường hiểm của đối phương.',
  },
  {
    id: 'ma-dien-sat-cuc',
    title: 'Ngoạ Tào Mã Sát Cục',
    subtitle: 'Sát pháp Mã Điền tốc chiến',
    category: 'tactics',
    categoryLabel: 'Sát pháp kinh điển',
    difficulty: 'Cơ bản',
    turn: 'r',
    fen: '3ak4/4a4/3H5/9/9/9/9/9/4A4/4K4 w - - 0 1',
    goal: 'Đỏ đi trước sát cục trong 3 nước',
    description: 'Vận dụng Mã nhảy Ngọa Tào khống chế hai cửa thoát của Tướng Đen, mở đường cho đòn quyết định.',
    hint: 'Đưa Mã vào góc hiểm uy hiếp thẳng cung Tướng đối phương.',
    solutionHint: 'Chiếu tướng liên tục không để Đen kịp củng cố phòng ngự.',
  },
  {
    id: 'diep-phao-trung-tam',
    title: 'Điệp Pháo Sát Cục (Song Pháo Trùng)',
    subtitle: 'Đòn Pháo trùng khóa chặt cung thành',
    category: 'tactics',
    categoryLabel: 'Sát pháp kinh điển',
    difficulty: 'Cơ bản',
    turn: 'r',
    fen: '3ak4/9/4C4/4C4/9/9/9/9/4A4/4K4 w - - 0 1',
    goal: 'Đỏ đi trước sát cục không thể chống đỡ',
    description: 'Hai pháo đứng trên cùng một lộ thẳng, pháo trước làm ngòi cho pháo sau chiếu bí Tướng đối phương.',
    hint: 'Pháo trước dồn tướng lên hoặc khóa lộ, pháo sau giáng đòn dứt điểm.',
  },
  {
    id: 'thiet-mon-thuyen',
    title: 'Thiết Môn Thuyên (Khóa Chặt Cửa Sắt)',
    subtitle: 'Phối hợp Xe Pháo diệt tướng',
    category: 'tactics',
    categoryLabel: 'Sát pháp kinh điển',
    difficulty: 'Trung cấp',
    turn: 'r',
    fen: '3ak4/4a4/9/4C4/9/9/9/9/4A4/R3K4 w - - 0 1',
    goal: 'Đỏ đi trước chiếu bí',
    description: 'Pháo chiếm trung lộ đóng chặt tâm cung, Xe lao thẳng đáy thành dứt điểm gọn gàng.',
    hint: 'Pháo giữ tim cung, Xe đánh đáy ép tướng vào tử lộ.',
  },
  {
    id: 'don-xe-pha-khuyet-si',
    title: 'Đơn Xe Thắng Khuyết Sĩ Tượng',
    subtitle: 'Kỹ thuật tàn cuộc cơ bản',
    category: 'endgame',
    categoryLabel: 'Tàn cuộc thực chiến',
    difficulty: 'Trung cấp',
    turn: 'r',
    fen: '3ak4/9/4b4/9/9/9/9/9/4A4/R3K4 w - - 0 1',
    goal: 'Đỏ đi trước vận dụng Xe diệt Tượng và thắng cờ',
    description: 'Bên Đen khuyết sĩ hoặc tượng, Xe Đỏ có thể điều động linh hoạt dồn tướng vào góc bí.',
    hint: 'Dùng Xe chiếm lộ 4 hoặc 6, kết hợp mặt Tướng Đỏ khống chế.',
  },
  {
    id: 'phao-binh-pha-song-si',
    title: 'Pháo Binh Phá Song Sĩ',
    subtitle: 'Phối hợp Pháo Chốt tàn cuộc',
    category: 'endgame',
    categoryLabel: 'Tàn cuộc thực chiến',
    difficulty: 'Trung cấp',
    turn: 'r',
    fen: '3aka3/9/9/4P4/9/9/9/4C4/4A4/4K4 w - - 0 1',
    goal: 'Đỏ đi trước tận dụng Binh và Pháo giành thắng lợi',
    description: 'Tàn cuộc căn bản: Pháo có ngòi Binh áp sát, phá tan cặp Sĩ hộ vệ của Đen.',
    hint: 'Tiến Binh từ từ khống chế đường đi của Sĩ và Tướng.',
  },
  {
    id: 'song-xe-toa-giac',
    title: 'Song Xe Tỏa Giác (Hai Xe Khóa Góc)',
    subtitle: 'Sát cục mãnh liệt hai cánh',
    category: 'tactics',
    categoryLabel: 'Sát pháp kinh điển',
    difficulty: 'Trung cấp',
    turn: 'r',
    fen: '2b1k1b2/4a4/9/9/9/9/9/9/4A4/R2RK4 w - - 0 1',
    goal: 'Đỏ đi trước dồn tướng vào góc và sát bí',
    description: 'Hai Xe phối hợp nhịp nhàng, một Xe chiếu đẩy tướng ra, một Xe giáng đòn quyết định.',
    hint: 'Lần lượt dùng Xe chiếu và chiếm các đường ngang yếu điểm.',
  },
  {
    id: 'ma-binh-thang-don-si',
    title: 'Mã Binh Thắng Đơn Sĩ',
    subtitle: 'Tàn cuộc Mã Chốt kinh điển',
    category: 'endgame',
    categoryLabel: 'Tàn cuộc thực chiến',
    difficulty: 'Cơ bản',
    turn: 'r',
    fen: '3ak4/4a4/9/4P4/9/9/9/4N4/4A4/4K4 w - - 0 1',
    goal: 'Đỏ đi trước khéo léo bắt Sĩ và chiếu bí',
    description: 'Kỹ nghệ điều Mã và tiến Binh chậm rãi nhưng chắc chắn, bắt sống đơn Sĩ cô lập.',
    hint: 'Dùng Mã khống chế nước lên xuống của Tướng Đen, đưa Binh vào cung.',
  },
  {
    id: 'song-ma-am-tuyen',
    title: 'Song Mã Ẩm Tuyền (Hai Ngựa Uống Nước)',
    subtitle: 'Tuyệt kỹ Song Mã tấn công',
    category: 'tactics',
    categoryLabel: 'Sát pháp kinh điển',
    difficulty: 'Cao cấp',
    turn: 'r',
    fen: '3ak4/4a4/3N1N2/9/9/9/9/9/4A4/4K4 w - - 0 1',
    goal: 'Đỏ đi trước chiếu bí bằng đòn phối hợp Song Mã',
    description: 'Hai Mã liên hoàn vừa bảo vệ nhau vừa khống chế toàn bộ cung Tướng của đối thủ.',
    hint: 'Một Mã chiếu buộc tướng di chuyển, Mã kia phong tỏa đường thoát.',
  },
  {
    id: 'tieu-chinh-dong',
    title: 'Tiểu Chinh Đông (小征東)',
    subtitle: 'Thế cờ giang hồ tinh xảo',
    category: 'classic',
    categoryLabel: 'Danh cục giang hồ',
    difficulty: 'Cao cấp',
    turn: 'r',
    fen: '2bakab2/9/9/9/9/9/9/4B4/4A4/3K1A3 w - - 0 1',
    goal: 'Đỏ đi trước mở đường công phá',
    description: 'Danh cục giang hồ có tính sát phạt cao, bên ngoài tưởng Đỏ thất thế nhưng có đường sinh cơ thần diệu.',
    hint: 'Tìm nước đi phản trực giác nhưng lại tạo thế phong tỏa hoàn hảo.',
  },
];

export const CUSTOM_PUZZLES_STORAGE_KEY = 'xiangqi_custom_puzzles_v1';

export function getStoredCustomPuzzles(): PuzzleItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PUZZLES_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCustomPuzzleToStorage(puzzle: PuzzleItem): PuzzleItem[] {
  try {
    const current = getStoredCustomPuzzles();
    const updated = [puzzle, ...current.filter((p) => p.id !== puzzle.id)];
    localStorage.setItem(CUSTOM_PUZZLES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function deleteCustomPuzzleFromStorage(id: string): PuzzleItem[] {
  try {
    const current = getStoredCustomPuzzles();
    const updated = current.filter((p) => p.id !== id);
    localStorage.setItem(CUSTOM_PUZZLES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
