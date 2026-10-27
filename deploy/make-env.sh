#!/bin/sh
# สร้างไฟล์ .env สำหรับ production บน VPS
#
# วิธีใช้ (ในโฟลเดอร์ ~/uchango บน VPS):
#   sh make-env.sh ghcr.io/weerapat-35/uchango
#
# - แอปนี้ไม่มีฐานข้อมูลของตัวเอง (ใช้ Supabase Cloud) จึงไม่มีรหัสผ่านให้สุ่ม
# - ความลับ (service role key, SlipOK) ให้วางเองตอนสคริปต์ถาม — ตัวอักษรจะไม่แสดงบนจอ
#   และไม่ถูกเก็บใน shell history
# - bind แอปที่ 127.0.0.1:3301 → เข้าได้ผ่าน Nginx เท่านั้น
# - ไม่เขียนทับ .env เดิม
set -e

if [ -z "$1" ]; then
  echo "วิธีใช้: sh make-env.sh ghcr.io/<username>/<repo>"
  exit 1
fi

if [ -f .env ]; then
  echo "มีไฟล์ .env อยู่แล้ว — ไม่เขียนทับ (ถ้าต้องการสร้างใหม่ ให้ลบ .env ก่อน)"
  exit 1
fi

# ชื่อ image บน GHCR ต้องเป็นตัวพิมพ์เล็ก
IMAGE=$(echo "$1" | tr '[:upper:]' '[:lower:]')

# อ่านค่าโดยไม่แสดงบนจอ
ask_secret() {
  printf '%s: ' "$1" >&2
  stty -echo
  read -r value
  stty echo
  printf '\n' >&2
  printf '%s' "$value"
}

SERVICE_ROLE_KEY=$(ask_secret "SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API Keys)")
SLIPOK_API_KEY=$(ask_secret "SLIPOK_API_KEY (เว้นว่างได้ถ้ายังไม่ใช้)")
SLIPOK_BRANCH_ID=$(ask_secret "SLIPOK_BRANCH_ID (เว้นว่างได้ถ้ายังไม่ใช้)")

# สร้างไฟล์แบบอ่านได้เฉพาะเจ้าของตั้งแต่แรก
umask 077
cat > .env <<EOF
# bind เฉพาะ 127.0.0.1 → เข้าได้ผ่าน Nginx เท่านั้น
APP_PORT=127.0.0.1:3301
APP_IMAGE=$IMAGE:latest
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SLIPOK_API_KEY=$SLIPOK_API_KEY
SLIPOK_BRANCH_ID=$SLIPOK_BRANCH_ID
EOF

chmod 600 .env
echo "สร้าง .env แล้ว (image: $IMAGE)"
