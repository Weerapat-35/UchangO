// ชื่อสถานะภาษาไทยสำหรับแสดงผล (ค่าในฐานข้อมูลยังเป็นภาษาอังกฤษเหมือนเดิม)
// ถ้าเจอค่าที่ไม่รู้จัก จะแสดงค่าเดิมกลับไป เพื่อไม่ให้ข้อมูลหายจากหน้าจอ

const BOOKING_STATUS: Record<string, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const REPAIR_JOB_STATUS: Record<string, string> = {
  pending: "รอมอบหมายช่าง",
  assigned: "มอบหมายช่างแล้ว",
  in_progress: "กำลังซ่อม",
  completed: "ซ่อมเสร็จแล้ว",
  cancelled: "ยกเลิก",
};

const RECORD_STATUS: Record<string, string> = {
  active: "เปิดใช้งาน",
  inactive: "ปิดใช้งาน",
  draft: "ฉบับร่าง",
  archived: "เก็บถาวร",
};

export function bookingStatusLabel(status: string | null | undefined) {
  return status ? BOOKING_STATUS[status] ?? status : "-";
}

export function repairJobStatusLabel(status: string | null | undefined) {
  return status ? REPAIR_JOB_STATUS[status] ?? status : "-";
}

/** สถานะเปิด/ปิดของสินค้า บริการ หมวดหมู่ และทักษะช่าง */
export function recordStatusLabel(status: string | null | undefined) {
  return status ? RECORD_STATUS[status] ?? status : "-";
}
