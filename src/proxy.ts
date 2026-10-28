import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// หน้าทดสอบ/ตรวจ schema ใช้ตอนพัฒนาเท่านั้น — บนเว็บจริงให้ตอบ 404
// เปิดชั่วคราวได้ด้วย ENABLE_DEBUG_PAGES=true
const debugPagesEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_DEBUG_PAGES === "true";

export function proxy(request: NextRequest) {
  if (debugPagesEnabled) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL("/_debug-disabled", request.url));
}

export const config = {
  matcher: [
    "/auth-rls-check/:path*",
    "/product-inventory-schema-check/:path*",
    "/product-sales-schema-check/:path*",
    "/schedule-capacity-schema-check/:path*",
    "/services-data-check/:path*",
    "/slipok-readiness-check/:path*",
    "/supabase-check/:path*",
    "/supabase-data-check/:path*",
    "/supabase-insert-check/:path*",
    "/supabase-schema-check/:path*",
    "/supabase-table-access-check/:path*",
    "/work-order-schema-check/:path*",
    "/api/supabase/health/:path*",
  ],
};
