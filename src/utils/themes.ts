export type BoardThemeId =
  | 'classic_wood'
  | 'jade'
  | 'sumi_ink'
  | 'imperial'
  | 'midnight_neon'
  | 'minimal_light';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  boardBg: string;
  boardBorder: string;
  gridLine: string;
  riverText: string;
  pieceRedBg: string;
  pieceRedBorder: string;
  pieceRedText: string;
  pieceBlackBg: string;
  pieceBlackBorder: string;
  pieceBlackText: string;
  swatchColors: [string, string, string];
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  classic_wood: {
    id: 'classic_wood',
    name: 'Gỗ cổ điển',
    boardBg: '#D8A467',
    boardBorder: '#7C4D25',
    gridLine: '#4A2C11',
    riverText: '#5C3615',
    pieceRedBg: '#FAF0CA',
    pieceRedBorder: '#B91C1C',
    pieceRedText: '#B91C1C',
    pieceBlackBg: '#F4E3B2',
    pieceBlackBorder: '#1C1917',
    pieceBlackText: '#1C1917',
    swatchColors: ['#D8A467', '#4A2C11', '#B91C1C'],
  },
  jade: {
    id: 'jade',
    name: 'Ngọc bích',
    boardBg: '#CBE4DE',
    boardBorder: '#0E4F46',
    gridLine: '#134E4A',
    riverText: '#115E59',
    pieceRedBg: '#FFFDF9',
    pieceRedBorder: '#BE123C',
    pieceRedText: '#BE123C',
    pieceBlackBg: '#F0FDFA',
    pieceBlackBorder: '#0F172A',
    pieceBlackText: '#0F172A',
    swatchColors: ['#CBE4DE', '#0E4F46', '#BE123C'],
  },
  sumi_ink: {
    id: 'sumi_ink',
    name: 'Mực tàu',
    boardBg: '#E7E5E4',
    boardBorder: '#292524',
    gridLine: '#1C1917',
    riverText: '#44403C',
    pieceRedBg: '#FAFAF9',
    pieceRedBorder: '#991B1B',
    pieceRedText: '#991B1B',
    pieceBlackBg: '#292524',
    pieceBlackBorder: '#D6D3D1',
    pieceBlackText: '#FAFAF9',
    swatchColors: ['#E7E5E4', '#1C1917', '#991B1B'],
  },
  imperial: {
    id: 'imperial',
    name: 'Hoàng cung',
    boardBg: '#5C1313',
    boardBorder: '#D97706',
    gridLine: '#F59E0B',
    riverText: '#FCD34D',
    pieceRedBg: '#FEF3C7',
    pieceRedBorder: '#DC2626',
    pieceRedText: '#B91C1C',
    pieceBlackBg: '#1C1917',
    pieceBlackBorder: '#F59E0B',
    pieceBlackText: '#FDE68A',
    swatchColors: ['#5C1313', '#F59E0B', '#FEF3C7'],
  },
  midnight_neon: {
    id: 'midnight_neon',
    name: 'Đêm',
    boardBg: '#0F172A',
    boardBorder: '#38BDF8',
    gridLine: '#38BDF8',
    riverText: '#7DD3FC',
    pieceRedBg: '#1E293B',
    pieceRedBorder: '#F43F5E',
    pieceRedText: '#FB7185',
    pieceBlackBg: '#0F172A',
    pieceBlackBorder: '#38BDF8',
    pieceBlackText: '#38BDF8',
    swatchColors: ['#0F172A', '#38BDF8', '#F43F5E'],
  },
  minimal_light: {
    id: 'minimal_light',
    name: 'Tối giản sáng',
    boardBg: '#F8FAFC',
    boardBorder: '#CBD5E1',
    gridLine: '#475569',
    riverText: '#64748B',
    pieceRedBg: '#FFFFFF',
    pieceRedBorder: '#E11D48',
    pieceRedText: '#E11D48',
    pieceBlackBg: '#FFFFFF',
    pieceBlackBorder: '#1E293B',
    pieceBlackText: '#1E293B',
    swatchColors: ['#F8FAFC', '#475569', '#E11D48'],
  },
};

export const THEME_LIST: BoardTheme[] = Object.values(BOARD_THEMES);
