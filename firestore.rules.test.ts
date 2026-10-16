import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Firestore Security Rules Verification', () => {
  const rulesContent = fs.readFileSync(path.resolve(__dirname, 'firestore.rules'), 'utf-8');

  it('enforces rules_version = 2 and global default-deny catch-all', () => {
    expect(rulesContent).toContain("rules_version = '2';");
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
  });

  it('defines rules for core production collections', () => {
    expect(rulesContent).toContain('match /users/{userId}');
    expect(rulesContent).toContain('match /usernames/{username}');
    expect(rulesContent).toContain('match /admins/{adminId}');
    expect(rulesContent).toContain('match /loginRequests/{requestId}');
    expect(rulesContent).toContain('match /ratings/{ratingId}');
    expect(rulesContent).toContain('match /games/{gameId}');
    expect(rulesContent).toContain('match /moves/{moveId}');
    expect(rulesContent).toContain('match /rooms/{roomCode}');
    expect(rulesContent).toContain('match /articles/{articleId}');
  });

  it('defines independent rules for staging collections (100% isolation)', () => {
    expect(rulesContent).toContain('match /staging_users/{userId}');
    expect(rulesContent).toContain('match /staging_usernames/{username}');
    expect(rulesContent).toContain('match /staging_admins/{adminId}');
    expect(rulesContent).toContain('match /staging_loginRequests/{requestId}');
    expect(rulesContent).toContain('match /staging_ratings/{ratingId}');
    expect(rulesContent).toContain('match /staging_games/{gameId}');
    expect(rulesContent).toContain('match /staging_moves/{moveId}');
    expect(rulesContent).toContain('match /staging_ratingHistory/{historyId}');
    expect(rulesContent).toContain('match /staging_rooms/{roomCode}');
    expect(rulesContent).toContain('match /staging_adminConfig/{configId}');
    expect(rulesContent).toContain('match /staging_articles/{articleId}');
  });
});
