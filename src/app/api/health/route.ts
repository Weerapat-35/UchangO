import { NextResponse } from "next/server";
import { checkSupabaseHealth } from "@/lib/supabase/health";

// health check สำหรับ Docker HEALTHCHECK และ workflow deploy
// ตอบ 200 เมื่อเชื่อมต่อ Supabase ได้ และ 503 เมื่อเชื่อมต่อไม่ได้ (แอปไม่ crash)
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkSupabaseHealth();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
  });
}
