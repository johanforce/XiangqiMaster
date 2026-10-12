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

  // Move trace styling (tailored per theme to contrast with boardBg & gridLine)
  moveFromBg: string;
  moveFromRing: string;
  moveFromInner: string;
  moveFromDot: string;
  moveToBorder: string;
  moveToBg: string;

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

    moveFromBg: 'rgba(51, 24, 8, 0.24)',
    moveFromRing: '#B91C1C',
    moveFromInner: '#FFFDF8',
    moveFromDot: '#C52828',
    moveToBorder: '#C52828',
    moveToBg: 'rgba(197, 40, 40, 0.16)',

    swatchColors: ['#C99355', '#4E2B10', '#C52828'],
  },

  // 2. Ngọc bích (Polished green jade - Google Material pastel tone balance)
  jade: {
    id: 'jade',
    name: 'Ngọc bích',
    boardBg: '#D6EAE3',
    boardBgGrad: ['#DFEFEA', '#CEE4DC'],
    frameBgGrad: ['#183B34', '#0F2722'],
    frameBorder: '#091A16',
    boardBorder: '#1D4F46',
    gridLine: '#1D4F46',
    riverText: '#18473F',
    rivetColor: '#A7F3D0',

    pieceRedBg: '#FAFDFB',
    pieceRedBgGrad: ['#FFFFFF', '#F0FDF8'],
    pieceRedBorder: '#A7F3D0',
    pieceRedRim: '#C52838',
    pieceRedText: '#B91C2C',

    pieceBlackBg: '#1E3833',
    pieceBlackBgGrad: ['#284942', '#142925'],
    pieceBlackBorder: '#2DD4BF',
    pieceBlackRim: '#2DD4BF',
    pieceBlackText: '#5EEAD4',

    moveFromBg: 'rgba(15, 39, 34, 0.18)',
    moveFromRing: '#0F766E',
    moveFromInner: '#FFFFFF',
    moveFromDot: '#C52838',
    moveToBorder: '#0D9488',
    moveToBg: 'rgba(13, 148, 136, 0.18)',

    swatchColors: ['#D6EAE3', '#183B34', '#C52838'],
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

    moveFromBg: 'rgba(38, 35, 34, 0.14)',
    moveFromRing: '#991B1B',
    moveFromInner: '#FAF9F6',
    moveFromDot: '#991B1B',
    moveToBorder: '#991B1B',
    moveToBg: 'rgba(153, 27, 27, 0.15)',

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

    moveFromBg: 'rgba(254, 243, 199, 0.20)',
    moveFromRing: '#FEF3C7',
    moveFromInner: '#F59E0B',
    moveFromDot: '#FDE68A',
    moveToBorder: '#FDE68A',
    moveToBg: 'rgba(253, 230, 138, 0.18)',

    swatchColors: ['#6B1D1D', '#F59E0B', '#FEF3C7'],
  },

  // 5. Đêm (Midnight - Google Material Dark Theme anti-glare balance)
  midnight_neon: {
    id: 'midnight_neon',
    name: 'Đêm',
    boardBg: '#121722',
    boardBgGrad: ['#171E2C', '#0E121C'],
    frameBgGrad: ['#0C0F17', '#06080D'],
    frameBorder: '#030407',
    boardBorder: '#1A2436',
    gridLine: '#2A4365',
    riverText: '#64B5F6',
    rivetColor: '#60A5FA',

    pieceRedBg: '#242028',
    pieceRedBgGrad: ['#2E2733', '#1A161E'],
    pieceRedBorder: '#4A3539',
    pieceRedRim: '#D9534F',
    pieceRedText: '#EF837B',

    pieceBlackBg: '#1C2433',
    pieceBlackBgGrad: ['#232F42', '#141A25'],
    pieceBlackBorder: '#2B3B52',
    pieceBlackRim: '#4EA8DE',
    pieceBlackText: '#7EC8F2',

    moveFromBg: 'rgba(56, 189, 248, 0.18)',
    moveFromRing: '#38BDF8',
    moveFromInner: '#E0F2FE',
    moveFromDot: '#38BDF8',
    moveToBorder: '#38BDF8',
    moveToBg: 'rgba(56, 189, 248, 0.18)',

    swatchColors: ['#121722', '#4EA8DE', '#D9534F'],
  },

  // 6. Tối giản sáng (Minimalist Light - Google Material 3 Warm Neutral anti-glare)
  minimal_light: {
    id: 'minimal_light',
    name: 'Tối giản sáng',
    boardBg: '#EFECE6',
    boardBgGrad: ['#F4F1EC', '#EAE6DF'],
    frameBgGrad: ['#8A8275', '#6E675B'],
    frameBorder: '#524C41',
    boardBorder: '#7A7265',
    gridLine: '#5C554B',
    riverText: '#6E6659',
    rivetColor: '#C8C2B7',

    pieceRedBg: '#FAF8F5',
    pieceRedBgGrad: ['#FFFFFF', '#EDE8E1'],
    pieceRedBorder: '#DDD7CE',
    pieceRedRim: '#B3261E',
    pieceRedText: '#B3261E',

    pieceBlackBg: '#FAF8F5',
    pieceBlackBgGrad: ['#FFFFFF', '#EDE8E1'],
    pieceBlackBorder: '#DDD7CE',
    pieceBlackRim: '#2D2A26',
    pieceBlackText: '#1C1A17',

    moveFromBg: 'rgba(45, 42, 38, 0.14)',
    moveFromRing: '#B3261E',
    moveFromInner: '#FFFFFF',
    moveFromDot: '#B3261E',
    moveToBorder: '#B3261E',
    moveToBg: 'rgba(179, 38, 30, 0.15)',

    swatchColors: ['#EFECE6', '#5C554B', '#B3261E'],
  },
};

export const THEME_LIST: BoardTheme[] = Object.values(BOARD_THEMES);
