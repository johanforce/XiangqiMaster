<div align="center">

# 象棋 XIANGQI MASTER

**Nền Tảng Cờ Tướng & Cờ Úp Trực Tuyến Chuẩn Quốc Tế (WXF) — Thời Gian Thực, AI Đa Luồng & Phòng Nghiên Cứu Kỳ Phổ**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8_Realtime-010101?style=flat-square&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Firebase](https://img.shields.io/badge/Firestore-NoSQL_%26_RBAC-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)

</div>

---

## 1. Tổng Quan Dự Án (Executive Summary)

**Xiangqi Master** là hệ thống thi đấu, luyện tập và phân tích **Cờ Tướng (Xiangqi)** cùng **Cờ Úp (Jieqi)** toàn diện, được thiết kế theo kiến trúc **Server-Authoritative Real-Time** kết hợp **Isomorphic Rule Engine** dùng chung giữa Client và Server.

Hệ thống giải quyết trọn vẹn các bài toán kỹ thuật cốt lõi của một nền tảng cờ trực tuyến hiện đại:
- **Đồng bộ trạng thái thời gian thực (Low-Latency State Sync)**: Xác thực nước đi chống gian lận phía máy chủ, đồng bộ đồng hồ thi đấu chính xác đến từng mili-giây và tự động khôi phục phiên đấu khi rớt mạng hoặc tải lại trang (`F5`).
- **Chuẩn hóa luật cờ quốc tế WXF (World Xiangqi Federation)**: Bắt lỗi *Lộ mặt tướng*, *Trường chiếu (Perpetual Check)*, *Trường tróc (Perpetual Chase)*, quy tắc *60 nước không ăn quân*, và cơ chế lật quân ngẫu nhiên bảo mật cho *Cờ Úp*.
- **AI Engine đa luồng (Web Worker Search Engine)**: Thuật toán tìm kiếm nước đi chạy độc lập trên luồng phụ (Worker Thread), đảm bảo giao diện luôn đạt 60 FPS ngay cả khi AI tính toán ở độ sâu lớn.
- **Bộ công cụ Nghiên cứu Kỳ phổ (Interactive Notation Studio)**: Hỗ trợ phân tích biến mới trực tiếp từ kỳ phổ đã nạp mà vẫn khóa bảo toàn dữ liệu gốc (`Immutable Base Notation`), cho phép *Roll back* từng nước nghiên cứu.

---

## 2. Kiến Trúc Hệ Thống (System Architecture)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER (SPA)                              │
│  ┌────────────────────┐   ┌──────────────────────┐   ┌────────────────────┐  │
│  │  React 19 + Vite   │   │  Shared Rule Engine  │   │  AI Search Worker  │  │
│  │  SVG Board & UI    │◄─►│  FEN / WXF / ICCS    │◄─►│  Alpha-Beta + TT   │  │
│  │  Web Audio Synth   │   │  Move Validation     │   │  (Non-blocking)    │  │
│  └─────────┬──────────┘   └──────────┬───────────┘   └────────────────────┘  │
└────────────┼─────────────────────────┼───────────────────────────────────────┘
             │ REST API (HTTPS)        │ WebSocket (Socket.IO Bidirectional)
             ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION SERVER (server.ts)                        │
│  ┌────────────────────────┐  ┌─────────────────────────┐  ┌───────────────┐  │
│  │ Auth & Session Guard   │  │ Room & Matchmaking Mgr  │  │ Rating Engine │  │
│  │ • Single-Device Lock   │  │ • Server-Side Clocks    │  │ • FIDE Elo    │  │
│  │ • Bcrypt Hashing       │  │ • Reconnect Grace Timer │  │ • Dynamic K   │  │
│  │ • _resetacc Recovery   │  │ • Anti-Cheat Validator  │  │ • Anti-Boost  │  │
│  └───────────┬────────────┘  └────────────┬────────────┘  └───────┬───────┘  │
└──────────────┼────────────────────────────┼───────────────────────┼──────────┘
               │                            │                       │
               ▼                            ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     PERSISTENCE LAYER (Cloud Firestore)                      │
│     [ users ]        [ games (PvP Only) ]        [ books / puzzles ]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Điểm Nhấn Kỹ Thuật (Core Engineering Highlights)

### 3.1. Isomorphic Game Engine & Luật WXF (`src/shared/xiangqi.ts`)
- **Biểu diễn trạng thái bất biến (Immutable Board & FEN)**: Toàn bộ bàn cờ, lượt đi, trạng thái úp/ngửa của quân cờ (Cờ Úp) được mã hóa và giải mã nhất quán qua chuẩn FEN mở rộng.
- **Xử lý Luật WXF Nâng Cao**:
  - Kiểm tra tự động **Lộ mặt tướng** (*Flying General*) và chiếu tướng trực tiếp/gián tiếp trước khi cho phép thực hiện nước đi.
  - Phát hiện lặp thế cờ 3 lần (*Threefold Repetition*) và phân định thắng/thua/hòa dựa trên lịch sử **Trường chiếu** (cấm chiếu liên tục — xử thua bên vi phạm) hoặc **Trường tróc** (bắt quân không có căn liên tục).
- **Trình biên dịch Kỳ phổ Đa chuẩn (`Multi-Format Notation Parser`)**: Chuyển đổi hai chiều giữa 3 chuẩn ký hiệu phổ biến nhất:
  1. **WXF Quốc tế** (`R2.5`, `C8+7`, `H2+3`)
  2. **Ký hiệu Việt ngữ truyền thống** (`X2-5`, `P8.7`, `M2.3`)
  3. **Tọa độ ICCS** (`H0E0`, `B2B9`)

### 3.2. AI Engine Đa Luồng (`src/workers/ai.worker.ts`)
Để tránh hiện tượng đóng băng luồng giao diện chính (*Main UI Thread Blocking*) khi tìm kiếm cây trò chơi có hệ số phân nhánh cao của Cờ tướng ($\approx 38$ nước hợp lệ mỗi lượt), bộ máy AI được tách hoàn toàn sang **Web Worker**:
- **Iterative Deepening + Alpha-Beta Pruning**: Tìm kiếm lặp sâu dần kết hợp cắt tỉa Alpha-Beta giúp kiểm soát chặt chẽ thời gian phản hồi.
- **Zobrist Hashing & Transposition Table**: Bảng băm 64-bit lưu trữ các thế cờ đã đánh giá (`EXACT`, `LOWERBOUND`, `UPPERBOUND`), giảm thiểu việc tính toán lại các nhánh trùng lặp.
- **Move Ordering & Quiescence Search**: Sắp xếp ưu tiên nước đi bằng *MVV-LVA (Most Valuable Victim - Least Valuable Attacker)*, *Killer Moves*, *History Heuristic* và tìm kiếm tĩnh ở nút lá để triệt tiêu hiệu ứng đường chân trời (*Horizon Effect*).
- **4 Cấp độ Huấn luyện**: Từ *Tập sự (1300)* đến *Đại sư (2000)* với hàm lượng giá vị trí (*Piece-Square Tables*) tinh chỉnh riêng cho từng giai đoạn Khai - Trung - Tàn cuộc.

### 3.3. Phòng Nghiên Cứu Kỳ Phổ (`src/components/NotationViewerView.tsx`)
Công cụ chuyên biệt dành cho kỳ thủ phân tích ván đấu:
- **Khóa bảo vệ Kỳ phổ gốc (`Immutable Base Moves`)**: Khi người dùng dán hoặc nạp một biên bản ván đấu, toàn bộ các nước đi gốc được đánh dấu khóa (`baseMoveCount`).
- **Đi tiếp & Phân tích biến (`Interactive Continuation`)**: Ngay tại cuối kỳ phổ gốc, bàn cờ tự động mở khóa tương tác cho cả 2 bên Đỏ/Đen để người dùng thử nghiệm các phương án tiếp theo.
- **Roll back An toàn (`Non-Destructive Rollback`)**: Cho phép hoàn tác từng nước nghiên cứu hoặc xóa toàn bộ nhánh nghiên cứu về đúng thời điểm cuối kỳ phổ gốc mà tuyệt đối không làm hỏng dữ liệu kỳ phổ đã dán.

### 3.4. Đồng Bộ Thời Gian Thực & Bảo Vệ Phiên Đăng Nhập (`server.ts`)
- **Quản lý Phiên Đơn Thiết Bị (`Single-Session Enforcement`)**: Mỗi tài khoản chỉ duy trì một phiên hoạt động (`activeSessionId`). Hỗ trợ khôi phục phiên mượt mà khi tải lại trang (`F5`) qua `localStorage` + xác thực socket `auth:bind`, đồng thời cung cấp cơ chế hậu tố `_resetacc` để thu hồi phiên khi bị kẹt thiết bị.
- **Đồng hồ Thi đấu Server-Authoritative**: Máy chủ quản lý bộ đếm thời gian với 3 chế độ chuẩn quốc tế:
  - **Increment (Fischer)**: Cộng thêm giây sau mỗi nước đi hợp lệ.
  - **Delay (Bronstein)**: Trì hoãn khấu trừ thời gian chính trong $N$ giây đầu mỗi lượt.
  - **Sudden Death**: Tổng thời gian cố định cho toàn ván đấu.
- **Tách biệt Dữ liệu Luyện tập & Thi đấu**: Các ván đấu luyện tập với Máy (AI) được xử lý cục bộ nhằm tối ưu hiệu năng và **không ghi vào cơ sở dữ liệu lịch sử thi đấu**, đảm bảo tính minh bạch cho hồ sơ kỳ thủ và bảng xếp hạng.

---

## 4. Hệ Thống Xếp Hạng & Tính Điểm FIDE Elo

Hệ thống áp dụng công thức **Elo chuẩn FIDE** cho các trận đấu Xếp hạng (Ranked PvP):

$$E_A = \frac{1}{1 + 10^{(R_B - R_A) / 400}}, \quad R'_A = R_A + K \cdot (S_A - E_A)$$

Trong đó hệ số $K$ tự động điều chỉnh theo trình độ và thâm niên thi đấu:
- **$K = 40$**: Kỳ thủ mới trong 30 ván đầu tiên (*Provisional Calibration*).
- **$K = 20$**: Kỳ thủ có mức điểm $\text{Elo} < 2000$.
- **$K = 10$**: Kỳ thủ đã từng đạt mốc $\text{Elo} \ge 2000$ (*Master Tier Stability*).

### Bảng Phân Cấp Danh Hiệu Kỳ Thủ

| Thứ Bậc | Danh Hiệu | Khoảng Điểm Elo | Mô Tả Cấp Độ |
| :---: | :--- | :---: | :--- |
| **1** | **Kỳ Tiên** | `> 2200` | Đỉnh cao kỳ đạo — Trình độ xuất thần nhập hóa |
| **2** | **Đại Sư** | `1901 – 2200` | Bậc thầy chiến thuật và điều quân đại cục |
| **3** | **Kỳ Thủ (Cao Cấp)** | `1801 – 1900` | Tư duy trung - tàn cuộc sắc bén, bản lĩnh thực chiến cao |
| **4** | **Cao Thủ** | `1701 – 1800` | Nắm vững khai cuộc và các đòn phối hợp công sát |
| **5** | **Kỳ Thủ** | `1601 – 1700` | Lối đánh bài bản, kiểm soát thế trận ổn định |
| **6** | **Ngỗng** | `1501 – 1600` | Đã thoát mác tân thủ, bắt đầu có chiều sâu tính toán |
| **7** | **Ngan** | `1421 – 1500` | Biết phối hợp quân cơ bản và phòng thủ phản công |
| **8** | **Vịt Chặt Chân** | `1351 – 1420` | Đang làm quen nhịp độ thực chiến thời gian thực |
| **9** | **Gián Đất** | `1301 – 1350` | Bước đầu tích lũy kinh nghiệm trên kỳ đài |
| **10** | **Unrank** | `≤ 1300` | Mức điểm khởi đầu tiêu chuẩn của kỳ thủ mới |

---

## 5. Cấu Trúc Mã Nguồn (Project Structure)

```text
.
├── server.ts                          # Express HTTP Server + Socket.IO Realtime Engine + Auth/Admin APIs
├── firestore.rules                    # Quy tắc bảo mật phân quyền dữ liệu (Firestore RBAC Rules)
├── firestore.rules.test.ts            # Bộ kiểm thử tự động cho quy tắc bảo mật
├── src/
│   ├── App.tsx                        # Quản lý trạng thái toàn cục, định tuyến SPA, đồng bộ Socket & AI
│   ├── firebase.ts                    # Khởi tạo kết nối Firebase Client SDK
│   ├── components/
│   │   ├── XiangqiBoard.tsx           # Bàn cờ SVG độ phân giải cao, hiệu ứng nước đi & chiếu tướng
│   │   ├── HomeView.tsx               # Sảnh chính: Thi đấu với máy, tạo phòng, tìm trận nhanh
│   │   ├── RankedRoomView.tsx         # Phòng chờ, ghép cặp Elo (Matchmaking) & danh sách bàn đấu
│   │   ├── NotationViewerView.tsx     # Công cụ Nghiên cứu Kỳ phổ (Khóa kỳ phổ gốc + Nhánh nghiên cứu)
│   │   ├── LeaderboardView.tsx        # Bảng xếp hạng trực tuyến & Hồ sơ thống kê kỳ thủ
│   │   ├── LibraryView.tsx            # Thư viện tàn cuộc, cờ thế & bài học kinh điển
│   │   ├── AdminDashboardView.tsx     # Bảng điều khiển Quản trị viên (Quản lý User, Khóa TK, Reset Elo)
│   │   └── AuthModal.tsx              # Giao diện Đăng nhập / Đăng ký / Thu hồi phiên (_resetacc)
│   ├── shared/
│   │   ├── xiangqi.ts                 # Core Engine: FEN, Luật WXF, Cờ Úp, Biên dịch Kỳ phổ
│   │   ├── xiangqi.test.ts            # Unit Tests cho luật cờ và trình đọc kỳ phổ
│   │   ├── elo.ts                     # Thuật toán FIDE Elo, phân hạng danh hiệu & K-factor
│   │   └── elo.test.ts                # Unit Tests cho công thức tính điểm Elo
│   ├── workers/
│   │   └── ai.worker.ts               # Web Worker chạy thuật toán AI Alpha-Beta + Zobrist TT
│   └── utils/
│       ├── sound.ts                   # Bộ tổng hợp âm thanh Web Audio API (Move, Capture, Check)
│       ├── themes.ts                  # Hệ thống giao diện bàn cờ (Gỗ cổ điển, Cẩm thạch, Hiện đại...)
│       └── navigation.ts              # Điều hướng URL chuẩn HTML5 History API
└── package.json                       # Cấu hình scripts, dependencies và công cụ build
```

---

## 6. Cài Đặt & Vận Hành (Getting Started)

### 6.1. Yêu cầu môi trường (Prerequisites)
- **Node.js**: `>= 20.x` (Khuyến nghị LTS)
- **Trình quản lý gói**: `npm` hoặc `bun`

### 6.2. Cài đặt Dependencies

```bash
npm install
```

### 6.3. Cấu hình Biến môi trường
Sao chép tệp `.env.example` sang `.env` (nếu cần ghi đè cấu hình mặc định):

```bash
cp .env.example .env
```

### 6.4. Chạy môi trường Phát triển (Development)
Khởi chạy đồng thời máy chủ Express, Socket.IO và Vite Middleware trên cổng `3000`:

```bash
npm run dev
```

### 6.5. Kiểm thử Mã nguồn & Kiểu dữ liệu (Typecheck & Testing)

```bash
# Kiểm tra tĩnh TypeScript (Zero-Error Policy)
npm run lint

# Chạy bộ Unit Tests cho Luật cờ & Hệ thống Elo
npx vitest run
```

### 6.6. Đóng gói & Triển khai Production (Production Build)

```bash
# Biên dịch tài nguyên Frontend tối ưu hóa vào thư mục dist/
npm run build

# Khởi chạy máy chủ Production
npm start
```

---

## 7. Tiêu Chuẩn Chất Lượng & Bảo Mật (Security & Engineering Standards)

- **Zero Inline Secrets**: Không lưu trữ khóa bí mật phía Client; mật khẩu người dùng được băm một chiều bằng `bcryptjs`.
- **Server-Side Validation**: Mọi yêu cầu di chuyển quân trong phòng đấu nhiều người chơi đều được kiểm tra tính hợp lệ (`getLegalMoves`, lượt đi, thời gian còn lại) trên máy chủ trước khi phát sóng (`broadcast`) tới đối thủ.
- **Graceful Reconnection**: Khi người chơi vô tình đóng tab hoặc mất kết nối tạm thời, hệ thống giữ trạng thái bàn cờ trong khoảng thời gian chờ (*Grace Period*) và tự động đồng bộ lại ngay khi kết nối khôi phục.
