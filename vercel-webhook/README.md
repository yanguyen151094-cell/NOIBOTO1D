# Facebook Webhook cho Vercel

Thư mục này chứa code để deploy Facebook Webhook lên Vercel (thay cho Supabase Edge Function).

## Cách sử dụng

1. Copy toàn bộ thư mục `vercel-webhook/` ra ngoài
2. Tạo repo GitHub mới, push code lên
3. Vào [vercel.com](https://vercel.com) → Import project từ GitHub
4. Thêm Environment Variables trong Vercel Dashboard:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://defffgyrdexrydrfnura.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Lấy từ Supabase Dashboard → Project Settings → API → service_role key)* |
| `FACEBOOK_APP_SECRET` | *(App Secret từ Facebook App Settings → Basic)* |

5. Sau khi deploy, URL sẽ là:
```
https://ten-project-cua-ban.vercel.app/api/facebook-webhook
```

6. Dán URL đó vào Facebook App → Webhooks → URL gọi lại
7. Xác minh mã: `T01D2026`

## Lưu ý
- Đây là Vercel Serverless Function, không liên quan đến React/Vite
- Không cần cold start, Facebook sẽ xác minh được ngay