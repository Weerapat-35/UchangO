# syntax=docker/dockerfile:1
#
# Multi-stage Dockerfile สำหรับแอป Next.js (ฐานข้อมูลอยู่บน Supabase Cloud)
# ---------------------------------------------------------------
#   base     → image ตั้งต้นที่ทุก stage ใช้ร่วมกัน
#   deps     → ติดตั้ง dependency ทั้งหมด (npm ci)
#   builder  → next build (output: "standalone")
#   runner   → image ที่ใช้รันแอปจริง มีเฉพาะไฟล์ที่จำเป็น
#
# ไม่มี stage migrate เพราะ schema อยู่ใน Supabase และรันผ่าน SQL Editor (โฟลเดอร์ supabase/)
#
# build:  docker build --target runner -t uchango-app:local .

# ---------- base ----------
FROM node:22-alpine AS base
WORKDIR /app
# ปิดการส่งข้อมูลการใช้งานของ Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- deps ----------
FROM base AS deps
# copy เฉพาะไฟล์ dependency ก่อน เพื่อใช้ layer cache (source เปลี่ยนก็ไม่ต้อง npm ci ใหม่)
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* ถูกฝังลงใน JavaScript ตอน next build จึงต้องส่งมาเป็น build-arg
# ทั้งสองค่าเป็นค่าสาธารณะ (browser เห็นอยู่แล้ว) ไม่ใช่ความลับ
# ถ้าไม่ส่งมา build ยังผ่าน แต่หน้าเว็บจะเชื่อมต่อ Supabase ไม่ได้
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
RUN npm run build

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production
# server.js ของ standalone ฟังที่ HOSTNAME:PORT — ต้องเป็น 0.0.0.0 เพื่อรับ request จากนอก container
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# copy เฉพาะผลลัพธ์จาก next build (ไม่มี source code, devDependencies และ .env)
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# รันด้วย user ที่ไม่ใช่ root (user "node" มีมาใน image node อยู่แล้ว)
USER node

EXPOSE 3000

# เรียก /api/health เป็นระยะ ถ้าล้มเหลวติดกันจะขึ้นสถานะ unhealthy (wget มีมาใน Alpine)
HEALTHCHECK --interval=15s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
