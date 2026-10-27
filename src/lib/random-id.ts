/**
 * สร้างสตริงสุ่มฐาน 16 สำหรับใช้ทำชื่อไฟล์หรือชื่อช่องสัญญาณที่ต้องไม่ซ้ำกัน
 * ใช้ crypto.getRandomValues แทน Math.random (ใช้ได้ทั้งบน https, localhost และ http ในวงแลน)
 */
export function randomId(length = 8): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}
