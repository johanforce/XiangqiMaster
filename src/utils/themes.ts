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
  boardBgGrad: [string, string];
  frameBgGrad: [string, string];
  frameBorder: string;
  gridLine: string;
  riverText: string;
  rivetColor: string;
  boardBorder: string;

  // Red piece styling
  pieceRedBg: string;
  pieceRedBgGrad: [string, string];
  pieceRedBorder: string;
  pieceRedRim: string;
  pieceRedText: string;

  // Black piece styling
  pieceBlackBg: string;
  pieceBlackBgGrad: [string, string];
  pieceBlackBorder: string;
  pieceBlackRim: string;
  pieceBlackText: string;

  swatchColors: [string, string, string];
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  // 1. Gỗ cổ điển (Matches the exact design in the uploaded image)
  classic_wood: {
    id: 'classic_wood',
    name: 'Gỗ cổ điển',
    boardBg: '#C99355',
    boardBgGrad: ['#D6A468', '#BA8448'],
    frameBgGrad: ['#562E12', '#331808'],
    frameBorder: '#231005',
    boardBorder: '#562E12',
    gridLine: '#4E2B10',
    riverText: '#593213',
    rivetColor: '#D4AF37',

    pieceRedBg: '#FAF5EA',
    pieceRedBgGrad: ['#FFFDF8', '#EDE2CD'],
    pieceRedBorder: '#D8C6A5',
    pieceRedRim: '#C52828',
    pieceRedText: '#C52828',

    pieceBlackBg: '#242220',
    pieceBlackBgGrad: ['#2F2C29', '#171615'],
    pieceBlackBorder: '#48433E',
    pieceBlackRim: '#D4AF37',
    pieceBlackText: '#F3CF68',

    swatchColors: ['#C99355', '#4E2B10', '#C52828'],
  },

  // 2. Ngọc bích (Polished green jade)
  jade: {
    id: 'jade',
    name: 'Ngọc bích',
    boardBg: '#A8CCC3',
    boardBgGrad: ['#B8DAD2', '#97BCB3'],
    frameBgGrad: ['#11463D', '#0A2D27'],
    frameBorder: '#061D19',
    boardBorder: '#11463D',
    gridLine: '#134E48',
    riverText: '#115E56',
    rivetColor: '#CCFBF1',

    pieceRedBg: '#F7FEFC',
    pieceRedBgGrad: ['#FFFFFF', '#E6F8F4'],
    pieceRedBorder: '#99F6E4',
    pieceRedRim: '#E11D48',
    pieceRedText: '#BE123C',

    pieceBlackBg: '#132E2B',
    pieceBlackBgGrad: ['#1C3D3A', '#0D2220'],
    pieceBlackBorder: '#2DD4BF',
    pieceBlackRim: '#2DD4BF',
    pieceBlackText: '#5EEAD4',

    swatchColors: ['#A8CCC3', '#11463D', '#BE123C'],
  },

  // 3. Mực tàu (Sumi Ink / Washi paper)
  sumi_ink: {
    id: 'sumi_ink',
    name: 'Mực tàu',
    boardBg: '#E4DFD5',
    boardBgGrad: ['#ECE7DD', '#DBD5CA'],
    frameBgGrad: ['#2E2A29', '#1A1817'],
    frameBorder: '#121110',
    boardBorder: '#2E2A29',
    gridLine: '#262322',
    riverText: '#44403C',
    rivetColor: '#A8A29E',

    pieceRedBg: '#FAF9F6',
    pieceRedBgGrad: ['#FFFFFF', '#EDEBE4'],
    pieceRedBorder: '#D6D3D1',
    pieceRedRim: '#991B1B',
    pieceRedText: '#991B1B',

    pieceBlackBg: '#23201F',
    pieceBlackBgGrad: ['#2F2C2B', '#141312'],
    pieceBlackBorder: '#57534E',
    pieceBlackRim: '#A8A29E',
    pieceBlackText: '#FAFAF9',

    swatchColors: ['#E4DFD5', '#262322', '#991B1B'],
  },

  // 4. Hoàng cung (Imperial vermilion & gold)
  imperial: {
    id: 'imperial',
    name: 'Hoàng cung',
    boardBg: '#6B1D1D',
    boardBgGrad: ['#7A2424', '#591616'],
    frameBgGrad: ['#3B0D0D', '#200505'],
    frameBorder: '#170303',
    boardBorder: '#3B0D0D',
    gridLine: '#D97706',
    riverText: '#FCD34D',
    rivetColor: '#F59E0B',

    pieceRedBg: '#FEF3C7',
    pieceRedBgGrad: ['#FFFBEB', '#FDE68A'],
    pieceRedBorder: '#F59E0B',
    pieceRedRim: '#DC2626',
    pieceRedText: '#B91C1C',

    pieceBlackBg: '#1C1917',
    pieceBlackBgGrad: ['#292524', '#0C0A09'],
    pieceBlackBorder: '#D97706',
    pieceBlackRim: '#F59E0B',
    pieceBlackText: '#FDE68A',

    swatchColors: ['#6B1D1D', '#F59E0B', '#FEF3C7'],
  },

  // 5. Đêm (Midnight Neon)
  midnight_neon: {
    id: 'midnight_neon',
    name: 'Đêm',
    boardBg: '#0F172A',
    boardBgGrad: ['#16213E', '#0A0E1A'],
    frameBgGrad: ['#0A0F1D', '#03050A'],
    frameBorder: '#020307',
    boardBorder: '#0A0F1D',
    gridLine: '#0284C7',
    riverText: '#38BDF8',
    rivetColor: '#38BDF8',

    pieceRedBg: '#1E293B',
    pieceRedBgGrad: ['#2A384F', '#131C29'],
    pieceRedBorder: '#475569',
    pieceRedRim: '#F43F5E',
    pieceRedText: '#FB7185',

    pieceBlackBg: '#0F172A',
    pieceBlackBgGrad: ['#17223B', '#080C17'],
    pieceBlackBorder: '#334155',
    pieceBlackRim: '#38BDF8',
    pieceBlackText: '#38BDF8',

    swatchColors: ['#0F172A', '#38BDF8', '#F43F5E'],
  },

  // 6. Tối giản sáng (Minimalist Light)
  minimal_light: {
    id: 'minimal_light',
    name: 'Tối giản sáng',
    boardBg: '#F8FAFC',
    boardBgGrad: ['#FFFFFF', '#EEF2F6'],
    frameBgGrad: ['#CBD5E1', '#94A3B8'],
    frameBorder: '#64748B',
    boardBorder: '#CBD5E1',
    gridLine: '#334155',
    riverText: '#475569',
    rivetColor: '#64748B',

    pieceRedBg: '#FFFFFF',
    pieceRedBgGrad: ['#FFFFFF', '#F1F5F9'],
    pieceRedBorder: '#CBD5E1',
    pieceRedRim: '#E11D48',
    pieceRedText: '#E11D48',

    pieceBlackBg: '#FFFFFF',
    pieceBlackBgGrad: ['#FFFFFF', '#F1F5F9'],
    pieceBlackBorder: '#CBD5E1',
    pieceBlackRim: '#0F172A',
    pieceBlackText: '#0F172A',

    swatchColors: ['#F8FAFC', '#334155', '#E11D48'],
  },
};

export const THEME_LIST: BoardTheme[] = Object.values(BOARD_THEMES);
