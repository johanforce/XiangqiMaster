import { describe, it, expect } from 'vitest';
import { BOARD_THEMES, THEME_LIST, BoardThemeId } from './themes';

describe('Xiangqi Board & Web Themes Suite', () => {
  it('contains exactly 7 distinct, cohesive themes including light mode', () => {
    expect(THEME_LIST.length).toBe(7);
    const expectedThemes: BoardThemeId[] = [
      'classic_wood',
      'jade',
      'sumi_ink',
      'imperial',
      'midnight_neon',
      'minimal_light',
      'pure_light',
    ];

    expectedThemes.forEach((id) => {
      expect(BOARD_THEMES[id]).toBeDefined();
      expect(BOARD_THEMES[id].id).toBe(id);
    });
  });

  it('validates the pure_light Google Material Design Light Mode theme', () => {
    const pureLight = BOARD_THEMES.pure_light;
    expect(pureLight).toBeDefined();
    expect(pureLight.name).toContain('Bạch Ngọc');
    expect(pureLight.name).toContain('Google Light');
    expect(pureLight.web.isLight).toBe(true);

    // Google Material Design surface & accents
    expect(pureLight.web.accentColor).toBe('#1A73E8'); // Google Blue 600
    expect(pureLight.web.pageBgStyle.background).toBe('#F8F9FA'); // Google Grey 50
    expect(pureLight.web.pageBgStyle.color).toBe('#202124'); // Google Grey 900
    expect(pureLight.boardBg).toBe('#FFFFFF');
    expect(pureLight.gridLine).toBe('#263238'); // Google Blue Grey 900

    // Google Red & Charcoal piece styles
    expect(pureLight.pieceRedRim).toBe('#D93025');
    expect(pureLight.pieceRedText).toBe('#D93025');
    expect(pureLight.pieceBlackBg).toBe('#202124');
    expect(pureLight.pieceBlackText).toBe('#FFFFFF');

    // Move traces (Google Blue from, Google Green to)
    expect(pureLight.moveFromRing).toBe('#1A73E8');
    expect(pureLight.moveToBorder).toBe('#1E8E3E');

    expect(pureLight.swatchColors).toHaveLength(3);
  });

  it('validates the minimal_light Google Warm Sand theme', () => {
    const minLight = BOARD_THEMES.minimal_light;
    expect(minLight).toBeDefined();
    expect(minLight.name).toContain('Google Warm');
    expect(minLight.web.isLight).toBe(true);
    expect(minLight.web.pageBgStyle.background).toBe('#FAF9F6');
    expect(minLight.boardBg).toBe('#FBF9F4');
    expect(minLight.web.cardBgClass).toContain('bg-white');
  });

  it('verifies all themes have complete image assets mapped', () => {
    THEME_LIST.forEach((t) => {
      expect(t.images).toBeDefined();
      expect(t.images.heroCover).toMatch(/^\/images\//);
      expect(t.images.arenaGate).toMatch(/^\/images\//);
      expect(t.images.masterDuel).toMatch(/^\/images\//);
      expect(t.images.championHall).toMatch(/^\/images\//);
      expect(t.images.leaderboardBg).toMatch(/^\/images\//);
      expect(t.images.lobbyPavilion).toMatch(/^\/images\//);
    });
  });

  it('verifies all themes have web semantic UI tokens populated', () => {
    THEME_LIST.forEach((t) => {
      const { web } = t;
      expect(web.tagline).toBeTruthy();
      expect(web.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(web.accentTextColor).toBeTruthy();
      expect(web.primaryBtnClass).toBeTruthy();
      expect(web.secondaryBtnClass).toBeTruthy();
      expect(web.activeTabClass).toBeTruthy();
      expect(web.cardBorderClass).toBeTruthy();
      expect(web.headerBgStyle).toBeDefined();
      expect(web.pageBgStyle).toBeDefined();
    });
  });

  it('verifies move indicator styling provides distinct visibility on every board', () => {
    THEME_LIST.forEach((t) => {
      expect(t.moveFromBg).toBeTruthy();
      expect(t.moveFromRing).toBeTruthy();
      expect(t.moveToBorder).toBeTruthy();
      expect(t.moveToBg).toBeTruthy();
    });
  });
});
