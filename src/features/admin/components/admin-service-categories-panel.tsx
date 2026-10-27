"use client";

import {
  createAdminServiceCategory,
  deleteAdminServiceCategory,
  getAdminDeleteErrorMessage,
  getAdminServiceCategories,
  updateAdminServiceCategory,
  type AdminDeleteError,
  type AdminServiceCategory,
} from "@/features/admin";
import { AdminSimpleCatalogPanel, type CatalogConfig } from "./admin-simple-catalog-panel";

const SERVICE_CATEGORY_CONFIG: CatalogConfig<AdminServiceCategory, AdminDeleteError> = {
  noun: "หมวดหมู่",
  intro: "หมวดหมู่ใช้จัดกลุ่มบริการ หมวดที่ปิดใช้งานจะไม่แสดงในหน้าจองของลูกค้า",
  namePlaceholder: "เช่น ระบบแอร์",
  descriptionPlaceholder: "คำอธิบายสั้น ๆ ที่แสดงในหน้าจองของลูกค้า",
  load: getAdminServiceCategories,
  create: createAdminServiceCategory,
  update: updateAdminServiceCategory,
  remove: deleteAdminServiceCategory,
  removeWarning: (category) => `"${category.name}" จะถูกลบถาวร รวมถึงบริการทั้งหมดในหมวดนี้และการจองที่เกี่ยวข้อง และไม่สามารถกู้คืนได้ ถ้าแค่ไม่อยากให้ลูกค้าเห็น ให้ปิดใช้งานแทน`,
  removeErrorMessage: (error) => getAdminDeleteErrorMessage(error, "หมวดหมู่บริการ"),
};

export function AdminServiceCategoriesPanel() {
  return <AdminSimpleCatalogPanel config={SERVICE_CATEGORY_CONFIG} />;
}
