# Security Specification (Payload-First Security TDD)

## 1. Data Invariants
1. **Zero Client Privilege Escalation**: Clients can NEVER write `role`, `isCreateAccount`, `isLogin`, `passwordHash`, `elo`, `rooms`, `ratings`, `ratingHistory`, `loginRequests`, `usernames`, or `adminConfig`. All sensitive mutations happen exclusively on the server via the Firebase Admin SDK.
2. **PII & Credential Isolation**: Password hashes (`passwordHash`) are stored exclusively in server-only `userSecrets/{userId}` where `allow read, write: if false;`. They never exist in `users/{userId}`.
3. **Preference-Only Client Updates on `users/{userId}`**: An authenticated user may only update their own visual preferences (`theme`, `pieceCharMode`, `soundEnabled`, `updatedAt`) on `/users/{userId}` if `request.auth.uid == userId` and `isValidUser(incoming())` holds.
4. **Master Gate & Query Enforcer**:
   - `/users/{userId}`: Only the owner (`request.auth.uid == userId`) or an Admin (`isAdmin()`) can `get`. Only `isAdmin()` can `list`.
   - `/loginRequests/{requestId}`: Only `isAdmin()` or the owner (`resource.data.uid == request.auth.uid`) can `get` or `list`.
   - `/games/{gameId}`: Authenticated users can `get` games or `list` games where `resource.data.redUid == request.auth.uid || resource.data.blackUid == request.auth.uid || isAdmin()`.
   - `/games/{gameId}/moves/{moveId}`: Master gate verifies parent `/games/$(gameId)` exists before allowing read.

## 2. The "Dirty Dozen" Payloads (Designed to Break Identity, Integrity, and State)
1. **Payload 1 (Self-Approval Escalation)**: User updates `/users/u1` with `{ "isCreateAccount": true }` -> `PERMISSION_DENIED`.
2. **Payload 2 (Admin Role Escalation)**: User updates `/users/u1` with `{ "role": "admin" }` -> `PERMISSION_DENIED`.
3. **Payload 3 (Session Hijack)**: User updates `/users/u1` with `{ "isLogin": false, "activeSessionId": "hack" }` -> `PERMISSION_DENIED`.
4. **Payload 4 (Shadow Field Injection)**: User updates `/users/u1` with `{ "theme": "jade", "isVerified": true }` -> `PERMISSION_DENIED`.
5. **Payload 5 (Invalid Theme Enum)**: User updates `/users/u1` with `{ "theme": "hacker_theme" }` -> `PERMISSION_DENIED`.
6. **Payload 6 (Cross-User Read)**: User `u1` reads `/users/u2` -> `PERMISSION_DENIED`.
7. **Payload 7 (Direct User Creation from Client)**: Client attempts `create` on `/users/u1` -> `PERMISSION_DENIED`.
8. **Payload 8 (Direct Elo Manipulation)**: Client attempts `update` on `/ratings/u1_blitz` with `{ "elo": 2800 }` -> `PERMISSION_DENIED`.
9. **Payload 9 (LoginRequest Self-Approval)**: Client attempts `update` on `/loginRequests/req1` with `{ "status": "approved" }` -> `PERMISSION_DENIED`.
10. **Payload 10 (Secret Credential Read)**: Client attempts `get` on `/userSecrets/u1` -> `PERMISSION_DENIED`.
11. **Payload 11 (Direct Room State Tampering)**: Client attempts `update` on `/rooms/ABC123` with `{ "winner": "red" }` -> `PERMISSION_DENIED`.
12. **Payload 12 (Unbounded String Poisoning)**: User updates `/users/u1` with a 5,000-character string in `displayName` -> `PERMISSION_DENIED`.
