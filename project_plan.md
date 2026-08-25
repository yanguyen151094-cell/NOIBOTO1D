# TỔ 1D — Hệ thống chăm sóc khách hàng đa kênh

## 1. Mô tả dự án
- **Định vị**: Ứng dụng nội bộ (dashboard) cho quản trị viên và nhân viên TỔ 1D để gom toàn bộ hội thoại khách hàng từ nhiều kênh (Facebook Messenger, TikTok — chờ duyệt) vào một hộp thư chung, đọc và trả lời ngay trên web.
- **Người dùng mục tiêu**: Quản trị viên (toàn quyền) và nhân viên (chỉ trong phạm vi được phân quyền).
- **Giá trị cốt lõi**: Gộp mọi kênh về một nơi, phản hồi nhanh, phân quyền chặt chẽ, theo dõi thời gian phản hồi và báo cáo hiệu suất.
- **Giao diện**: Tiếng Việt, hiện đại, sáng sủa, thương hiệu TỔ 1D, responsive cho máy tính và điện thoại.

## 2. Cấu trúc trang
- `/login` — Đăng nhập (tài khoản + mật khẩu, ghi nhớ đăng nhập)
- `/` — Tổng quan (dashboard, admin)
- `/inbox` — Hộp thư chung (3 cột: kênh / danh sách hội thoại / chi tiết trò chuyện)
- `/customers` — Quản lý khách hàng
- `/customer-notes` — Ghi chú khách hàng (khách đăng ký, tên tài khoản, liên hệ, tổng nạp, tổng cược)
- `/accounts` — Kho tài khoản (FB/TikTok/Telegram: tài khoản, mật khẩu, Gmail, mã 2FA)
- `/evaluations` — Đánh giá nhân viên (admin chấm điểm, tổ viên nhận thông báo)
- `/rewards` — Danh sách nhận thưởng (admin thêm/sửa/xóa/xuất Excel; tổ viên chỉ xem ngày, tên công việc, nội dung, số tiền — không thấy STK, ngân hàng, họ tên)
- `/staff` — Quản lý nhân viên (chỉ admin)
- `/channels` — Kết nối kênh (chỉ admin)
- `/reports` — Báo cáo hiệu suất (chỉ admin)
- `/logs` — Nhật ký hoạt động (chỉ admin)
- `/settings` — Cài đặt (đổi mật khẩu, thông báo, âm thanh...)
- `/wall` — Tường cá nhân (đăng bài, bình luận, thả tim)
- `/announcements` — Thông báo nội bộ (chỉ admin đăng, tổ viên đọc + thả tim)
- `/plans` — Kế hoạch (admin giao việc, tổ viên đọc thực hiện)

## 3. Tính năng cốt lõi
- [x] Đăng nhập / đăng xuất / ghi nhớ đăng nhập / đổi mật khẩu (Supabase Auth thật)
- [x] Hộp thư chung 3 cột (kênh → hội thoại → trò chuyện) — nối Supabase + realtime
- [x] Realtime tin nhắn (không cần tải lại trang)
- [x] Nhãn trạng thái hội thoại: Chưa đọc / Chưa trả lời / Đang xử lý / Đã trả lời / Hoàn thành
- [x] Cảnh báo màu theo thời gian chờ
- [x] Tìm kiếm & bộ lọc hội thoại
- [x] Nhận/chuyển/mở lại hội thoại, ghi chú nội bộ
- [x] Thông tin khách hàng
- [x] Quản lý nhân viên (tạo/khóa/reset mật khẩu/thu hồi phiên/phân quyền kênh/chuyển dữ liệu)
- [x] Kết nối kênh (thêm/gỡ/thay page; Facebook OAuth + webhook; TikTok chờ duyệt)
- [x] Phòng trò chuyện nội bộ (team chat) — tạo phòng, thêm thành viên, gửi icon, realtime
- [x] Báo cáo (tổng quan, xếp hạng nhân viên, xuất CSV)
- [x] Nhật ký hoạt động (chỉ admin xem)
- [x] Ghi chú khách hàng (khách đăng ký, tên tài khoản, liên hệ, tổng nạp, tổng cược) — tổ viên thêm/sửa, admin quản lý tất cả
- [x] Kho tài khoản (FB/TikTok/Telegram: tài khoản, mật khẩu, Gmail, mã 2FA) — admin và tổ viên xem được
- [x] Đánh giá nhân viên (admin chấm điểm 1-5 sao + nhận xét, gửi thông báo realtime về tổ viên, tổng hợp theo nhân viên)
- [x] Danh sách nhận thưởng (admin thêm/sửa/xóa/xuất Excel; tổ viên chỉ xem ngày, tên công việc, nội dung, số tiền)
- [ ] Thông báo âm thanh / browser notification (đang có UI, chưa nối hành vi thật)

## 4. Mô hình dữ liệu (Supabase / Readdy Backend)
- `users` — tài khoản (tên, tên đăng nhập, vai trò, trạng thái khóa, trạng thái online, hoạt động cuối)
- `roles` — vai trò (admin / staff)
- `user_sessions` — phiên đăng nhập (để thu hồi phiên)
- `channels` — kênh (tên, nền tảng, avatar, trạng thái kết nối, đồng bộ cuối)
- `channel_access` — phân quyền kênh cho từng nhân viên
- `customers` — khách hàng (tên, avatar, nền tảng, username/ID, số điện thoại, nhãn, ghi chú)
- `conversations` — cuộc trò chuyện (kênh, khách, trạng thái, nhân viên phụ trách)
- `conversation_assignments` — lịch sử gán nhân viên cho hội thoại
- `messages` — tin nhắn (nội dung, người gửi, ID gốc từng nền tảng, trạng thái gửi)
- `internal_notes` — ghi chú nội bộ
- `customer_tags` — thẻ khách hàng
- `response_time_events` — sự kiện thời gian phản hồi
- `activity_logs` — nhật ký hoạt động (ai, làm gì, thời gian, IP, thiết bị)
- `attachments` — tệp đính kèm
- `customer_notes` — ghi chú khách hàng (khách đăng ký, tên tài khoản, liên hệ, tổng nạp, tổng cược, ghi chú)
- `account_vault` — kho tài khoản (nền tảng, nhãn, tên đăng nhập, mật khẩu, Gmail, mã 2FA, ghi chú)
- `staff_evaluations` — đánh giá nhân viên (nhân viên, người đánh giá, điểm 1-5, tiêu đề, nhận xét)
- `staff_rewards` — danh sách nhận thưởng (ngày, tên công việc, STK, ngân hàng, họ tên, nội dung thưởng, số tiền)
- `notifications` — thông báo nội bộ (người nhận, loại, tiêu đề, nội dung, trạng thái đã đọc)
- Quan hệ chính theo `user_id`, `channel_id`, `customer_id`, `conversation_id`.

## 5. Tích hợp Backend / bên thứ ba
- **Backend (Readdy Backend hoặc SaaS Supabase)**: xác thực, database, realtime, edge functions, storage. Bắt buộc cho mọi tính năng dữ liệu thật.
- **Facebook Messenger**: OAuth + webhook + API gửi/nhận. Không giới hạn số lượng Page.
- **TikTok**: chưa hỗ trợ API chính thức (hiển thị "Chờ API được phê duyệt"). Không giới hạn số lượng tài khoản lưu trong hệ thống.
- Token/Secret chỉ lưu ở server (edge function secrets / biến môi trường), không lộ ở trình duyệt.
- Logo TỔ 1D đã áp dụng khắp app (login, sidebar, topbar, dashboard).

## 6. Kế hoạch phát triển theo giai đoạn
### Giai đoạn 1: Khung giao diện + Đăng nhập + Hộp thư (demo data)
- Bố cục chính (sidebar + responsive), trang đăng nhập, hộp thư 3 cột với dữ liệu demo.
- Chưa nối backend thật (dùng mock data để xem giao diện).

### Giai đoạn 2: Kết nối Backend + Xác thực thật
- Kết nối Readdy Backend / Supabase, tạo bảng, đăng nhập/đăng xuất/ghi nhớ, phân quyền (RLS).

### Giai đoạn 3: Realtime + quản lý hội thoại
- Realtime tin nhắn, nhận/chuyển/ghi chú, thời gian phản hồi.

### Giai đoạn 4: Quản trị (nhân viên, kênh, nhật ký)
- Màn hình nhân viên, kết nối kênh, nhật ký hoạt động.

### Giai đoạn 5: Báo cáo + khách hàng + cài đặt + Team chat
- Dashboard, báo cáo, quản lý khách hàng, cài đặt, phòng trò chuyện nội bộ.

### Giai đoạn 6: Làm đẹp giao diện + đổi thương hiệu TỔ 1D
- Thay logo TỔ 1D khắp app, đổi tên từ "TRUNG TÂM CSKH" thành "TỔ 1D".
- Làm đẹp trang đăng nhập, sidebar, topbar.
- Viết lại trang Kết nối kênh: giải thích rõ cách FB/TikTok hoạt động, nhấn mạnh không giới hạn số Page.
- Thêm modal hướng dẫn từng bước kết nối Facebook/TikTok.
- Build hoàn chỉnh.