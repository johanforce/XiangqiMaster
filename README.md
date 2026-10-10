# Xiangqi Master (Cờ Tướng & Cờ Úp Trực Tuyến)

Ứng dụng Cờ Tướng & Cờ Úp trực tuyến chuẩn quốc tế WXF, xây dựng với **React 19 + TypeScript + Vite + TailwindCSS**, **Node.js / Express + Socket.IO** và **Firebase Firestore**.

## 1. Cài đặt & Chạy ứng dụng

```bash
npm install
npm run dev      # Chạy server full-stack (Express + Socket.IO + Vite) tại cổng 3000
npm test         # Chạy bộ unit test (Luật cờ tướng, Cờ úp, FIDE Elo, Chống cày Elo, Security Rules)
npm run build    # Build production
```

## 2. Biến môi trường (`.env`)

| Biến | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `ADMIN_USERNAME` | `thangnc` | Tên đăng nhập Admin mặc định được seed khi khởi động |
| `ADMIN_PASSWORD` | `thangnc1` | Mật khẩu Admin mặc định |
| `CRON_SECRET` | `xiangqi_cron_secret_2026` | Khóa bảo mật header `x-cron-secret` cho Cloud Scheduler |

## 3. Luật Cờ Tướng & Cờ Úp đã chọn

- **Luật cơ bản**: Đầy đủ luật Tướng đối mặt (Flying General), cản Mã (chân mã), cản Tượng (mắt tượng, không qua sông ở cờ tiêu chuẩn), Pháo ăn qua đúng 1 ngòi, Tốt qua sông mới đi ngang, cấm tự để Tướng bị chiếu.
- **Hết nước đi hợp lệ (Stalemate / Checkmate)**: Xử **THUA** cho bên tới lượt mà không còn nước đi hợp lệ.
- **Luật lặp thế / Chiếu trường (Asian Rules)**:
  - Khi lặp lại cùng một thế cờ 3 lần: bên nào chiếu liên tục (chiếu trường một chiều) sẽ bị xử **THUA**.
  - Nếu cả hai bên cùng lặp hợp lệ mà không bên nào vi phạm chiếu trường một chiều thì xử **HÒA**.
- **Biến thể Cờ Úp (Dark Xiangqi Việt Nam)**:
  - 2 Tướng đặt ngửa đúng vị trí xuất phát; 30 quân còn lại xáo trộn úp.
  - Nước đầu tiên của quân úp đi theo luật của vị trí xuất phát đó và lật ngửa ngay sau khi đi; các nước tiếp theo đi theo đúng loại quân vừa lật. Server giữ bí mật hoàn toàn các quân chưa lật.

## 4. Triển khai Cloud Run & Cloud Scheduler (Giai đoạn 2)

- **Cloud Run**:
  - Đặt `--min-instances=1` và bật `--session-affinity` để duy trì kết nối WebSocket (Socket.IO) ổn định cho các phòng đấu thời gian thực.
- **Cloud Scheduler**:
  - **Dọn phòng 22:00 (`Asia/Ho_Chi_Minh`)**: Gọi `POST /api/cron/cleanup-rooms` kèm header `x-cron-secret: <CRON_SECRET>`.
  - **Trừ điểm/Reset không hoạt động 00:05 (`Asia/Ho_Chi_Minh`)**: Gọi `POST /api/cron/rating-decay` kèm header `x-cron-secret: <CRON_SECRET>`.
