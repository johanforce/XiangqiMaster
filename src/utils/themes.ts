import type React from 'react';

export type BoardThemeId =
    | 'classic_wood'
    | 'jade'
    | 'sumi_ink'
    | 'imperial'
    | 'midnight_neon'
    | 'minimal_light'
    | 'pure_light';

export interface ThemeImages {
  heroCover: string;
  arenaGate: string;
  masterDuel: string;
  championHall: string;
  leaderboardBg: string;
  lobbyPavilion: string;
}

export interface WebThemeStyles {
  tagline: string;
  isLight?: boolean;
  pageBgStyle: React.CSSProperties;
  headerBgStyle: React.CSSProperties;
  cardBgStyle: React.CSSProperties;
  cardBorderColor: string;
  accentColor: string;
  accentGradient: string;
  accentTextColor: string;
  accentBadgeBg: string;
  accentGlow: string;
  activeNavBg: string;

  // Semantic UI color tokens for buttons, cards, headers, badges
  primaryBtnClass: string;
  secondaryBtnClass: string;
  subtleBtnClass: string;
  accentBadgeClass: string;
  cardBorderClass: string;
  cardBgClass: string;
  bannerGradient: string;
  activeTabClass: string;
  textAccentClass: string;
  inputFocusClass: string;
  borderAccentClass: string;
  accentBgClass: string;
}

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  tagline?: string;
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

  // Theme-specific web styling & corresponding visual images
  images: ThemeImages;
  web: WebThemeStyles;
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  // 1. Gỗ cổ điển (Classic mahogany wood & warm golden amber)
  classic_wood: {
    id: 'classic_wood',
    name: 'Gỗ cổ điển',
    tagline: 'Bàn cờ gỗ cẩm lai trầm ấm, phong vị cổ truyền mộc mạc',
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

    images: {
      heroCover: '/images/hero_cover.jpg',
      arenaGate: '/images/ranked_arena_gate.jpg',
      masterDuel: '/images/master_duel.jpg',
      championHall: '/images/champion_hall.jpg',
      leaderboardBg: '/images/leaderboard_bg.jpg',
      lobbyPavilion: '/images/ranked_lobby_pavilion.jpg',
    },
    web: {
      tagline: 'Bàn cờ gỗ cẩm lai trầm ấm, phong vị cổ truyền mộc mạc',
      pageBgStyle: {
        background: 'radial-gradient(ellipse at 50% 0%, #1e140d 0%, #110c08 50%, #0a0705 100%)',
      },
      headerBgStyle: {
        backgroundColor: 'rgba(23, 16, 11, 0.90)',
        borderColor: 'rgba(92, 53, 26, 0.45)',
      },
      cardBgStyle: {
        backgroundColor: 'rgba(28, 20, 14, 0.75)',
        borderColor: 'rgba(100, 58, 28, 0.4)',
      },
      cardBorderColor: '#4a2b16',
      accentColor: '#f59e0b',
      accentGradient: 'from-amber-600 via-amber-500 to-amber-700',
      accentTextColor: '#fbbf24',
      accentBadgeBg: 'rgba(245, 158, 11, 0.16)',
      accentGlow: 'rgba(245, 158, 11, 0.35)',
      activeNavBg: '#2d1b0f',

      primaryBtnClass:
          'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 hover:from-amber-500 hover:to-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.35)]',
      secondaryBtnClass:
          'bg-stone-900/90 hover:bg-stone-800 border border-amber-900/60 text-amber-200',
      subtleBtnClass:
          'bg-stone-900/80 hover:bg-stone-800 text-stone-300 border border-stone-800',
      accentBadgeClass:
          'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      cardBorderClass:
          'border-amber-900/40 hover:border-amber-500/40',
      cardBgClass: 'bg-stone-900/90',
      bannerGradient: 'from-amber-950/60 via-stone-900/90 to-stone-950',
      activeTabClass: 'bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow-sm',
      textAccentClass: 'text-amber-400',
      inputFocusClass: 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50',
      borderAccentClass: 'border-amber-500/40',
      accentBgClass: 'bg-amber-500/15',
    },
  },

  // 2. Ngọc bích (Polished green jade & tranquil misty bamboo lake)
  jade: {
    id: 'jade',
    name: 'Ngọc bích',
    tagline: 'Đình đài ngọc bích ven hồ sen thanh tịnh, non xanh mây biếc',
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

    images: {
      heroCover: '/images/themes/xiangqi_jade_theme.jpg',
      arenaGate: '/images/themes/jade_arena_gate.jpg',
      masterDuel: '/images/themes/jade_master_duel.jpg',
      championHall: '/images/themes/jade_champion_hall.jpg',
      leaderboardBg: '/images/themes/jade_champion_hall.jpg',
      lobbyPavilion: '/images/themes/jade_arena_gate.jpg',
    },
    web: {
      tagline: 'Đình đài ngọc bích ven hồ sen thanh tịnh, non xanh mây biếc',
      pageBgStyle: {
        background: 'radial-gradient(ellipse at 50% 0%, #0d221f 0%, #071513 50%, #030a09 100%)',
      },
      headerBgStyle: {
        backgroundColor: 'rgba(11, 28, 25, 0.92)',
        borderColor: 'rgba(29, 79, 70, 0.55)',
      },
      cardBgStyle: {
        backgroundColor: 'rgba(13, 34, 30, 0.75)',
        borderColor: 'rgba(29, 79, 70, 0.45)',
      },
      cardBorderColor: '#1d4f46',
      accentColor: '#10b981',
      accentGradient: 'from-emerald-600 via-teal-500 to-emerald-700',
      accentTextColor: '#34d399',
      accentBadgeBg: 'rgba(16, 185, 129, 0.18)',
      accentGlow: 'rgba(16, 185, 129, 0.35)',
      activeNavBg: '#13352f',

      primaryBtnClass:
          'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]',
      secondaryBtnClass:
          'bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/50 text-emerald-200',
      subtleBtnClass:
          'bg-emerald-950/50 hover:bg-emerald-900/50 text-teal-200 border border-emerald-900/60',
      accentBadgeClass:
          'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
      cardBorderClass:
          'border-emerald-800/40 hover:border-emerald-400/50',
      cardBgClass: 'bg-[#0d221e]/90',
      bannerGradient: 'from-emerald-950/70 via-[#0a1e1a]/95 to-stone-950',
      activeTabClass: 'bg-emerald-950/80 text-emerald-300 border border-emerald-400/40 shadow-sm',
      textAccentClass: 'text-emerald-400',
      inputFocusClass: 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50',
      borderAccentClass: 'border-emerald-500/40',
      accentBgClass: 'bg-emerald-500/15',
    },
  },

  // 3. Mực tàu (Sumi Ink / Washi paper & zen scholar calligraphy)
  sumi_ink: {
    id: 'sumi_ink',
    name: 'Mực tàu',
    tagline: 'Bút pháp thủy mặc thiền tịnh, phong thái cao nhân ẩn sĩ',
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

    images: {
      heroCover: '/images/themes/xiangqi_sumi_ink_theme.jpg',
      arenaGate: '/images/themes/sumi_arena_gate.jpg',
      masterDuel: '/images/themes/sumi_master_duel.jpg',
      championHall: '/images/themes/sumi_champion_hall_1792743109855.jpg',
      leaderboardBg: '/images/themes/sumi_champion_hall_1792743109855.jpg',
      lobbyPavilion: '/images/themes/sumi_arena_gate.jpg',
    },
    web: {
      tagline: 'Bút pháp thủy mặc thiền tịnh, phong thái cao nhân ẩn sĩ',
      pageBgStyle: {
        background: 'radial-gradient(ellipse at 50% 0%, #1c1a18 0%, #121110 50%, #090808 100%)',
      },
      headerBgStyle: {
        backgroundColor: 'rgba(23, 21, 20, 0.94)',
        borderColor: 'rgba(68, 64, 60, 0.55)',
      },
      cardBgStyle: {
        backgroundColor: 'rgba(28, 26, 25, 0.78)',
        borderColor: 'rgba(68, 64, 60, 0.45)',
      },
      cardBorderColor: '#44403c',
      accentColor: '#dc2626',
      accentGradient: 'from-stone-700 via-red-700 to-stone-800',
      accentTextColor: '#f87171',
      accentBadgeBg: 'rgba(220, 38, 38, 0.18)',
      accentGlow: 'rgba(220, 38, 38, 0.35)',
      activeNavBg: '#2c2725',

      primaryBtnClass:
          'bg-gradient-to-r from-stone-700 via-red-800 to-stone-800 hover:from-red-700 hover:to-stone-700 text-stone-100 shadow-[0_0_20px_rgba(185,28,28,0.35)]',
      secondaryBtnClass:
          'bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-200',
      subtleBtnClass:
          'bg-stone-900/80 hover:bg-stone-800 text-stone-300 border border-stone-800',
      accentBadgeClass:
          'bg-red-500/15 text-red-300 border border-red-500/30',
      cardBorderClass:
          'border-stone-700/60 hover:border-red-500/40',
      cardBgClass: 'bg-[#181615]/90',
      bannerGradient: 'from-stone-900/70 via-[#161413]/95 to-stone-950',
      activeTabClass: 'bg-stone-800 text-red-400 border border-red-900/50 shadow-sm',
      textAccentClass: 'text-red-400',
      inputFocusClass: 'focus:border-red-600 focus:ring-1 focus:ring-red-600/50',
      borderAccentClass: 'border-red-700/50',
      accentBgClass: 'bg-red-950/40',
    },
  },

  // 4. Hoàng cung (Imperial vermilion red & forbidden city gold)
  imperial: {
    id: 'imperial',
    name: 'Hoàng cung',
    tagline: 'Điện son thếp vàng Tử Cấm Thành uy nghiêm, khí phách vương giả',
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

    images: {
      heroCover: '/images/themes/xiangqi_imperial_theme.jpg',
      arenaGate: '/images/themes/imperial_arena_gate.jpg',
      masterDuel: '/images/themes/imperial_master_duel.jpg',
      championHall: '/images/themes/imperial_champion_hall.jpg',
      leaderboardBg: '/images/themes/imperial_champion_hall.jpg',
      lobbyPavilion: '/images/themes/imperial_arena_gate.jpg',
    },
    web: {
      tagline: 'Điện son thếp vàng Tử Cấm Thành uy nghiêm, khí phách vương giả',
      pageBgStyle: {
        background: 'radial-gradient(ellipse at 50% 0%, #290a0a 0%, #170404 50%, #0b0202 100%)',
      },
      headerBgStyle: {
        backgroundColor: 'rgba(36, 10, 10, 0.94)',
        borderColor: 'rgba(120, 28, 28, 0.55)',
      },
      cardBgStyle: {
        backgroundColor: 'rgba(42, 12, 12, 0.76)',
        borderColor: 'rgba(120, 28, 28, 0.45)',
      },
      cardBorderColor: '#6b1d1d',
      accentColor: '#d97706',
      accentGradient: 'from-amber-600 via-yellow-500 to-red-600',
      accentTextColor: '#fbbf24',
      accentBadgeBg: 'rgba(217, 119, 6, 0.22)',
      accentGlow: 'rgba(217, 119, 6, 0.40)',
      activeNavBg: '#3d0f0f',

      primaryBtnClass:
          'bg-gradient-to-r from-red-700 via-amber-600 to-yellow-600 hover:from-red-600 hover:to-amber-500 text-amber-100 shadow-[0_0_25px_rgba(220,38,38,0.4)]',
      secondaryBtnClass:
          'bg-red-950/70 hover:bg-red-900/70 border border-yellow-500/50 text-amber-200',
      subtleBtnClass:
          'bg-red-950/50 hover:bg-red-900/50 text-amber-300 border border-red-900/60',
      accentBadgeClass:
          'bg-amber-500/20 text-yellow-300 border border-yellow-500/40',
      cardBorderClass:
          'border-red-900/60 hover:border-yellow-500/50',
      cardBgClass: 'bg-[#240a0a]/90',
      bannerGradient: 'from-red-950/70 via-[#210808]/95 to-stone-950',
      activeTabClass: 'bg-red-950/80 text-yellow-300 border border-yellow-500/50 shadow-sm',
      textAccentClass: 'text-yellow-400',
      inputFocusClass: 'focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50',
      borderAccentClass: 'border-yellow-500/40',
      accentBgClass: 'bg-yellow-500/20',
    },
  },

  // 5. Đêm (Midnight starry sky, floating lanterns & glowing sapphire board)
  midnight_neon: {
    id: 'midnight_neon',
    name: 'Dạ nguyệt',
    tagline: 'Đêm trăng lơ lửng ngàn thiên đăng, kỳ đài phát sáng lung linh',
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

    images: {
      heroCover: '/images/themes/xiangqi_midnight_theme.jpg',
      arenaGate: '/images/themes/midnight_arena_gate.jpg',
      masterDuel: '/images/themes/midnight_master_duel.jpg',
      championHall: '/images/themes/midnight_champion_hall.jpg',
      leaderboardBg: '/images/themes/midnight_champion_hall.jpg',
      lobbyPavilion: '/images/themes/midnight_arena_gate.jpg',
    },
    web: {
      tagline: 'Đêm trăng lơ lửng ngàn thiên đăng, kỳ đài phát sáng lung linh',
      pageBgStyle: {
        background: 'radial-gradient(ellipse at 50% 0%, #0d172a 0%, #070d18 50%, #03060c 100%)',
      },
      headerBgStyle: {
        backgroundColor: 'rgba(11, 20, 37, 0.94)',
        borderColor: 'rgba(42, 67, 101, 0.55)',
      },
      cardBgStyle: {
        backgroundColor: 'rgba(14, 25, 45, 0.76)',
        borderColor: 'rgba(42, 67, 101, 0.45)',
      },
      cardBorderColor: '#1a2436',
      accentColor: '#0284c7',
      accentGradient: 'from-sky-600 via-cyan-500 to-blue-700',
      accentTextColor: '#38bdf8',
      accentBadgeBg: 'rgba(2, 132, 199, 0.20)',
      accentGlow: 'rgba(56, 189, 248, 0.40)',
      activeNavBg: '#13213a',

      primaryBtnClass:
          'bg-gradient-to-r from-sky-600 via-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-sky-400 text-stone-950 font-bold shadow-[0_0_25px_rgba(56,189,248,0.45)]',
      secondaryBtnClass:
          'bg-sky-950/70 hover:bg-sky-900/70 border border-cyan-500/50 text-cyan-200',
      subtleBtnClass:
          'bg-sky-950/50 hover:bg-sky-900/50 text-sky-200 border border-cyan-900/60',
      accentBadgeClass:
          'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
      cardBorderClass:
          'border-sky-900/60 hover:border-cyan-400/50',
      cardBgClass: 'bg-[#0b172b]/90',
      bannerGradient: 'from-sky-950/60 via-[#0a1527]/95 to-stone-950',
      activeTabClass: 'bg-sky-950/80 text-cyan-300 border border-cyan-400/50 shadow-sm',
      textAccentClass: 'text-cyan-400',
      inputFocusClass: 'focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50',
      borderAccentClass: 'border-cyan-500/40',
      accentBgClass: 'bg-cyan-500/15',
    },
  },

  // 6. Tối giản sáng (Google Warm Sand / Travertine Minimalist)
  minimal_light: {
    id: 'minimal_light',
    name: 'Tối giản sáng (Google Warm)',
    tagline: 'Phong cách Google Material tối giản tông giấy ấm, thanh nhã và dễ chịu',
    boardBg: '#FBF9F4',
    boardBgGrad: ['#FDFCF9', '#F4EFE4'],
    frameBgGrad: ['#E7DFD2', '#D2C7B4'],
    frameBorder: '#B7A994',
    boardBorder: '#D2C7B4',
    gridLine: '#453A30',
    riverText: '#685A4E',
    rivetColor: '#D97706',

    pieceRedBg: '#FFFFFF',
    pieceRedBgGrad: ['#FFFFFF', '#FDF5F2'],
    pieceRedBorder: '#EED9D2',
    pieceRedRim: '#C52828',
    pieceRedText: '#C52828',

    pieceBlackBg: '#2D2926',
    pieceBlackBgGrad: ['#3A3532', '#221F1C'],
    pieceBlackBorder: '#5C544E',
    pieceBlackRim: '#D4AF37',
    pieceBlackText: '#FDE68A',

    moveFromBg: 'rgba(69, 58, 48, 0.12)',
    moveFromRing: '#C52828',
    moveFromInner: '#FFFFFF',
    moveFromDot: '#C52828',
    moveToBorder: '#0D9488',
    moveToBg: 'rgba(13, 148, 136, 0.14)',

    swatchColors: ['#FBF9F4', '#D97706', '#C52828'],

    images: {
      heroCover: '/images/themes/xiangqi_minimal_theme.jpg',
      arenaGate: '/images/themes/minimal_arena_gate.jpg',
      masterDuel: '/images/themes/minimal_master_duel.jpg',
      championHall: '/images/themes/minimal_champion_hall.jpg',
      leaderboardBg: '/images/themes/minimal_champion_hall.jpg',
      lobbyPavilion: '/images/themes/minimal_arena_gate.jpg',
    },
    web: {
      tagline: 'Phong cách Google Material tối giản tông giấy ấm, thanh nhã và dễ chịu',
      isLight: true,
      pageBgStyle: {
        background: '#FAF9F6',
        color: '#292524',
      },
      headerBgStyle: {
        backgroundColor: 'rgba(255, 253, 250, 0.98)',
        borderColor: '#E8E2D8',
        boxShadow: '0 1px 3px 0 rgba(60, 50, 40, 0.06)',
      },
      cardBgStyle: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2DBD0',
        boxShadow: '0 1px 3px 0 rgba(60, 50, 40, 0.08), 0 2px 6px 0 rgba(60, 50, 40, 0.04)',
      },
      cardBorderColor: '#E2DBD0',
      accentColor: '#B45309',
      accentGradient: 'from-amber-600 via-amber-700 to-amber-800',
      accentTextColor: '#B45309',
      accentBadgeBg: 'rgba(180, 83, 9, 0.10)',
      accentGlow: 'rgba(180, 83, 9, 0.20)',
      activeNavBg: '#F5F1E9',

      primaryBtnClass:
          'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold shadow-sm hover:shadow active:scale-98 transition-all',
      secondaryBtnClass:
          'bg-white hover:bg-[#F9F7F2] border border-[#DDD5C7] text-[#44403C] font-medium shadow-xs transition-colors',
      subtleBtnClass:
          'bg-[#F5F1E9] hover:bg-[#EBE5DB] border border-[#DDD5C7] text-[#57534E]',
      accentBadgeClass:
          'bg-amber-50 text-amber-800 border border-amber-200',
      cardBorderClass:
          'border-[#E2DBD0] hover:border-amber-500/60 shadow-[0_1px_3px_rgba(60,50,40,0.06)]',
      cardBgClass: 'bg-white',
      bannerGradient: 'from-amber-50/80 via-white to-stone-50',
      activeTabClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold shadow-xs',
      textAccentClass: 'text-amber-800 font-semibold',
      inputFocusClass: 'focus:border-amber-600 focus:ring-1 focus:ring-amber-500/50',
      borderAccentClass: 'border-amber-300',
      accentBgClass: 'bg-amber-50',
    },
  },

  // 7. Bạch Ngọc Sáng (Google Material Design 3 Clean Light)
  pure_light: {
    id: 'pure_light',
    name: 'Bạch Ngọc (Google Light)',
    tagline: 'Thiết kế chuẩn Google Material thanh lịch, phong cách sáng tinh gọn và chuẩn mực',
    boardBg: '#FFFFFF',
    boardBgGrad: ['#FFFFFF', '#F5F7F8'],
    frameBgGrad: ['#ECEFF1', '#CFD8DC'],
    frameBorder: '#B0BEC5',
    boardBorder: '#CFD8DC',
    gridLine: '#263238',
    riverText: '#37474F',
    rivetColor: '#1A73E8',

    pieceRedBg: '#FFFFFF',
    pieceRedBgGrad: ['#FFFFFF', '#FDEDEC'],
    pieceRedBorder: '#FADBD8',
    pieceRedRim: '#D93025',
    pieceRedText: '#D93025',

    pieceBlackBg: '#202124',
    pieceBlackBgGrad: ['#303134', '#202124'],
    pieceBlackBorder: '#5F6368',
    pieceBlackRim: '#FBBC04',
    pieceBlackText: '#FFFFFF',

    moveFromBg: 'rgba(26, 115, 232, 0.12)',
    moveFromRing: '#1A73E8',
    moveFromInner: '#FFFFFF',
    moveFromDot: '#1A73E8',
    moveToBorder: '#1E8E3E',
    moveToBg: 'rgba(30, 142, 62, 0.14)',

    swatchColors: ['#FFFFFF', '#1A73E8', '#D93025'],

    images: {
      heroCover: '/images/themes/xiangqi_minimal_theme.jpg',
      arenaGate: '/images/themes/minimal_arena_gate.jpg',
      masterDuel: '/images/themes/minimal_master_duel.jpg',
      championHall: '/images/themes/minimal_champion_hall.jpg',
      leaderboardBg: '/images/themes/minimal_champion_hall.jpg',
      lobbyPavilion: '/images/themes/minimal_arena_gate.jpg',
    },
    web: {
      tagline: 'Thiết kế chuẩn Google Material thanh lịch, phong cách sáng tinh gọn và chuẩn mực',
      isLight: true,
      pageBgStyle: {
        background: '#F8F9FA',
        color: '#202124',
      },
      headerBgStyle: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E8EAED',
        boxShadow: '0 1px 2px 0 rgba(60,64,67,0.08), 0 1px 3px 1px rgba(60,64,67,0.04)',
      },
      cardBgStyle: {
        backgroundColor: '#FFFFFF',
        borderColor: '#DADCE0',
        boxShadow: '0 1px 2px 0 rgba(60,64,67,0.12), 0 1px 3px 1px rgba(60,64,67,0.08)',
      },
      cardBorderColor: '#DADCE0',
      accentColor: '#1A73E8',
      accentGradient: 'from-[#1A73E8] via-[#1967D2] to-[#185ABC]',
      accentTextColor: '#1A73E8',
      accentBadgeBg: '#E8F0FE',
      accentGlow: 'rgba(26, 115, 232, 0.20)',
      activeNavBg: '#E8F0FE',

      primaryBtnClass:
          'bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold shadow-sm hover:shadow active:scale-98 transition-all',
      secondaryBtnClass:
          'bg-white hover:bg-[#F1F3F4] border border-[#DADCE0] text-[#3C4043] font-medium shadow-xs transition-colors',
      subtleBtnClass:
          'bg-[#F1F3F4] hover:bg-[#E8EAED] border border-[#DADCE0] text-[#3C4043]',
      accentBadgeClass:
          'bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] font-medium',
      cardBorderClass:
          'border-[#DADCE0] hover:border-[#1A73E8]/60 shadow-[0_1px_3px_rgba(60,64,67,0.12)]',
      cardBgClass: 'bg-white',
      bannerGradient: 'from-[#E8F0FE] via-white to-[#F8F9FA]',
      activeTabClass: 'bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] font-semibold shadow-xs',
      textAccentClass: 'text-[#1A73E8] font-semibold',
      inputFocusClass: 'focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]/50',
      borderAccentClass: 'border-[#1A73E8]',
      accentBgClass: 'bg-[#E8F0FE]',
    },
  },
};

export const THEME_LIST: BoardTheme[] = Object.values(BOARD_THEMES);
