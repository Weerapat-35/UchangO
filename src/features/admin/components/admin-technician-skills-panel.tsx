"use client";

import {
  createAdminTechnicianSkill,
  getAdminTechnicianSkills,
  updateAdminTechnicianSkill,
  type AdminTechnicianSkill,
} from "@/features/admin";
import { AdminSimpleCatalogPanel, type CatalogConfig } from "./admin-simple-catalog-panel";

// ทักษะลบไม่ได้ เพราะผูกกับโปรไฟล์ช่างและประวัติงาน ใช้ปิดใช้งานแทน
const TECHNICIAN_SKILL_CONFIG: CatalogConfig<AdminTechnicianSkill> = {
  noun: "ทักษะ",
  intro: "ทักษะที่เปิดใช้งานจะเลือกได้ในโปรไฟล์ช่างและตอนมอบหมายงาน ทักษะที่ปิดไว้ยังอยู่ในประวัติเดิม",
  namePlaceholder: "เช่น ระบบเกียร์",
  descriptionPlaceholder: "คำอธิบายสั้น ๆ สำหรับแอดมินและช่าง",
  load: getAdminTechnicianSkills,
  create: createAdminTechnicianSkill,
  update: updateAdminTechnicianSkill,
};

export function AdminTechnicianSkillsPanel() {
  return <AdminSimpleCatalogPanel config={TECHNICIAN_SKILL_CONFIG} />;
}
