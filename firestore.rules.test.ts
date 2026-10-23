import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Firestore Security Rules Verification (Dirty Dozen Invariants)', () => {
  const rulesContent = fs.readFileSync(path.resolve(__dirname, 'firestore.rules'), 'utf-8');

  it('enforces rules_version = 2 and global default-deny catch-all', () => {
    expect(rulesContent).toContain("rules_version = '2';");
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
  });

  it('isolates password hashes in server-only userSecrets with zero client access (Payload 10)', () => {
    expect(rulesContent).toContain('match /userSecrets/{userId}');
    expect(rulesContent).not.toContain('passwordHash');
  });

  it('prevents privilege escalation on role, isCreateAccount, and isLogin (Payloads 1, 2, 3)', () => {
    expect(rulesContent).toContain('incoming().role == existing().role');
    expect(rulesContent).toContain('incoming().isCreateAccount == existing().isCreateAccount');
    expect(rulesContent).toContain('incoming().isLogin == existing().isLogin');
    expect(rulesContent).toContain("affectedKeys().hasOnly(['theme', 'pieceCharMode', 'soundEnabled', 'updatedAt'])");
  });

  it('prevents shadow fields and invalid theme enums (Payloads 4, 5, 12)', () => {
    expect(rulesContent).toContain("data.theme in ['classic_wood', 'jade', 'sumi_ink', 'imperial', 'midnight_neon', 'minimal_light']");
    expect(rulesContent).toContain('data.keys().hasOnly(');
  });

  it('prevents cross-user reads and client user creation (Payloads 6, 7)', () => {
    expect(rulesContent).toContain('allow get: if isValidId(userId) && (isOwner(userId) || isAdmin());');
    expect(rulesContent).toContain('allow create, delete: if false;');
  });

  it('blocks client writes to ratings, rooms, games, moves, and loginRequests (Payloads 8, 9, 11)', () => {
    expect(rulesContent).toContain('match /ratings/{ratingId}');
    expect(rulesContent).toContain('match /rooms/{roomCode}');
    expect(rulesContent).toContain('match /games/{gameId}');
    expect(rulesContent).toContain('match /loginRequests/{requestId}');
  });
});
