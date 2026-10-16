import { describe, it, expect } from 'vitest';
import { io, Socket } from 'socket.io-client';
import {
  parseFen,
  INITIAL_FEN,
  getLegalMovesForSquare,
  applyMove,
  formatMoveNotation,
  evaluateGameStatus,
  boardToFen,
} from './xiangqi';
import { calculateMatchElo } from './elo';

const SERVER_URL = 'http://localhost:3000';

describe('Xiangqi Live Match & Staging Verification', () => {
  describe('Game Engine & Move Invariants', () => {
    it('initializes standard board with Red turn and 32 pieces', () => {
      const { board, turn } = parseFen(INITIAL_FEN);
      expect(turn).toBe('r');
      let count = 0;
      for (const row of board) {
        for (const cell of row) {
          if (cell) count++;
        }
      }
      expect(count).toBe(32);
    });

    it('generates strictly legal moves for Red central pawn and horses', () => {
      const { board } = parseFen(INITIAL_FEN);
      // Red central pawn at row 6, col 4 can only advance to (5, 4)
      const pawnMoves = getLegalMovesForSquare(board, { row: 6, col: 4 });
      expect(pawnMoves).toEqual([{ row: 5, col: 4 }]);

      // Red left horse at row 9, col 1 can move to (7, 0) and (7, 2)
      const horseMoves = getLegalMovesForSquare(board, { row: 9, col: 1 });
      expect(horseMoves).toEqual(
        expect.arrayContaining([
          { row: 7, col: 0 },
          { row: 7, col: 2 },
        ])
      );
    });

    it('applies move cleanly, produces valid notation, and alternates turn', () => {
      const { board } = parseFen(INITIAL_FEN);
      const from = { row: 6, col: 4 };
      const to = { row: 5, col: 4 };
      const notation = formatMoveNotation(board, from, to);
      expect(notation.wxf).toBe('P5+1');
      expect(notation.viet).toBe('Binh 5 tấn 1');

      const { nextBoard } = applyMove(board, from, to);
      expect(nextBoard[6][4]).toBeNull();
      expect(nextBoard[5][4]?.type).toBe('p');
      expect(nextBoard[5][4]?.color).toBe('r');

      const nextFen = boardToFen(nextBoard, 'b', false);
      const { turn: nextTurn } = parseFen(nextFen);
      expect(nextTurn).toBe('b');

      const status = evaluateGameStatus(nextBoard, 'b', [INITIAL_FEN, nextFen], []);
      expect(status.isOver).toBe(false);
      expect(status.winner).toBe('ongoing');
    });

    it('calculates Elo properly for Staging test match', () => {
      const res = calculateMatchElo({
        redElo: 1500,
        redGames: 10,
        redProvisional: true,
        redEloDebt: 0,
        blackElo: 1500,
        blackGames: 10,
        blackProvisional: true,
        blackEloDebt: 0,
        outcome: 'red',
        redUid: 'u_test_kythu_test1',
        blackUid: 'u_test_kythu_test2',
        redRecentOpponents: [],
        blackRecentOpponents: [],
      });

      expect(res.redAfter).toBeGreaterThan(1500);
      expect(res.blackAfter).toBeLessThan(1500);
      expect(res.redDelta).toBeGreaterThan(0);
      expect(res.blackDelta).toBeLessThan(0);
    });
  });

  describe('Staging Realtime Match End-to-End Flow', () => {
    it('completes 2-player match on Staging with zero freeze and seamless recovery', async () => {
      // 1. Authenticate both test players on Staging
      const [loginRes1, loginRes2] = await Promise.all([
        fetch(`${SERVER_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Server-Env': 'staging' },
          body: JSON.stringify({ username: 'kythu_test1', password: '123' }),
        }).then((r) => r.json()),
        fetch(`${SERVER_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Server-Env': 'staging' },
          body: JSON.stringify({ username: 'kythu_test2', password: '123' }),
        }).then((r) => r.json()),
      ]);

      const user1 = loginRes1.user;
      const user2 = loginRes2.user;
      expect(user1).toBeDefined();
      expect(user2).toBeDefined();
      expect(user1.username).toBe('kythu_test1');
      expect(user2.username).toBe('kythu_test2');

      // 2. Connect both Socket.IO clients to Staging
      const s1: Socket = io(SERVER_URL, {
        auth: { env: 'staging' },
        query: { env: 'staging' },
        transports: ['polling', 'websocket'],
        reconnection: false,
      });

      const s2: Socket = io(SERVER_URL, {
        auth: { env: 'staging' },
        query: { env: 'staging' },
        transports: ['polling', 'websocket'],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        let connected = 0;
        const onConn = () => {
          connected++;
          if (connected === 2) resolve();
        };
        s1.on('connect', onConn);
        s2.on('connect', onConn);
      });

      // 3. Bind users to their socket connections
      s1.emit('auth:bind', { uid: user1.uid, username: user1.username });
      s2.emit('auth:bind', { uid: user2.uid, username: user2.username });

      // 4. Player 1 creates a Blitz room
      let roomCode = '';
      await new Promise<void>((resolve) => {
        s1.emit(
          'room:create',
          { uid: user1.uid, username: user1.username, mode: 'blitz' },
          (res: any) => {
            expect(res.room).toBeDefined();
            expect(res.room.code).toHaveLength(6);
            expect(res.room.redPlayer?.username).toBe('kythu_test1');
            roomCode = res.room.code;
            resolve();
          }
        );
      });

      // 5. Player 2 joins room as Black
      await new Promise<void>((resolve) => {
        s2.emit(
          'room:join',
          { code: roomCode, uid: user2.uid, username: user2.username },
          (res: any) => {
            expect(res.room).toBeDefined();
            expect(res.room.blackPlayer?.username).toBe('kythu_test2');
            resolve();
          }
        );
      });

      let latestRoomState1: any = null;
      let latestRoomState2: any = null;
      s1.on('room:state', (st) => {
        latestRoomState1 = st;
      });
      s2.on('room:state', (st) => {
        latestRoomState2 = st;
      });

      // 6. Host starts the match
      await new Promise<void>((resolve) => {
        s1.emit('room:start', { code: roomCode, uid: user1.uid }, (res: any) => {
          expect(res.room?.status).toBe('playing');
          resolve();
        });
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(latestRoomState1?.status).toBe('playing');
      expect(latestRoomState1?.turn).toBe('r');
      expect(latestRoomState2?.status).toBe('playing');

      // 7. Red (Player 1) makes Move 1: Pawn (6,4) -> (5,4)
      const move1Result = await new Promise<any>((resolve) => {
        s1.emit(
          'game:move',
          {
            code: roomCode,
            uid: user1.uid,
            username: user1.username,
            from: { row: 6, col: 4 },
            to: { row: 5, col: 4 },
          },
          resolve
        );
      });
      expect(move1Result.ok).toBe(true);

      await new Promise((r) => setTimeout(r, 100));
      expect(latestRoomState2?.turn).toBe('b');
      expect(latestRoomState2?.moves).toHaveLength(1);
      expect(latestRoomState2?.moves[0].wxf).toBe('P5+1');

      // 8. Black (Player 2) makes Move 2: Horse (0,1) -> (2,2)
      const move2Result = await new Promise<any>((resolve) => {
        s2.emit(
          'game:move',
          {
            code: roomCode,
            uid: user2.uid,
            username: user2.username,
            from: { row: 0, col: 1 },
            to: { row: 2, col: 2 },
          },
          resolve
        );
      });
      expect(move2Result.ok).toBe(true);

      await new Promise((r) => setTimeout(r, 100));
      expect(latestRoomState1?.turn).toBe('r');
      expect(latestRoomState1?.moves).toHaveLength(2);

      // 9. Simulate Player 1 socket disconnect & reconnect mid-game
      s1.disconnect();

      const s1Reconnected: Socket = io(SERVER_URL, {
        auth: { env: 'staging' },
        query: { env: 'staging' },
        transports: ['polling', 'websocket'],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        s1Reconnected.on('connect', () => {
          s1Reconnected.emit('auth:bind', {
            uid: user1.uid,
            username: user1.username,
            roomCode,
          });
          s1Reconnected.emit(
            'room:rejoin',
            {
              code: roomCode,
              uid: user1.uid,
              username: user1.username,
            },
            (res: any) => {
              expect(res?.room).toBeDefined();
              expect(res.room.status).toBe('playing');
              expect(res.room.redPlayer?.username).toBe('kythu_test1');
              resolve();
            }
          );
        });
      });

      s1Reconnected.on('room:state', (st) => {
        latestRoomState1 = st;
      });

      // 10. Reconnected Player 1 makes Move 3: Cannon (7,1) -> (7,4) (Trung Phao)
      const move3Result = await new Promise<any>((resolve) => {
        s1Reconnected.emit(
          'game:move',
          {
            code: roomCode,
            uid: user1.uid,
            username: user1.username,
            from: { row: 7, col: 1 },
            to: { row: 7, col: 4 },
          },
          resolve
        );
      });
      expect(move3Result.ok).toBe(true);

      await new Promise((r) => setTimeout(r, 100));
      expect(latestRoomState2?.turn).toBe('b');
      expect(latestRoomState2?.moves).toHaveLength(3);
      expect(latestRoomState2?.moves[2].wxf).toBe('C8.5');

      // 11. Cleanup test sockets
      s1Reconnected.disconnect();
      s2.disconnect();
    });
  });
});
