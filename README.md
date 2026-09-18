# Wealth Transfer

แอปวางแผนส่งต่อความมั่งคั่ง (Next.js) สำหรับบันทึกทรัพย์สิน ครอบครัว วิธีโอน และประมาณการภาษี/ค่าธรรมเนียม

## รันบนเครื่อง

คัดลอกค่าสภาพแวดล้อมแล้วติดตั้งแพ็กเกจ:

```bash
cp .env.example .env.local   # หรือใส่ค่าเอง
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

ตัวแปรที่ต้องมี:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## สคริปต์

```bash
npm run dev    # development
npm run build  # production build
npm test       # vitest
```
