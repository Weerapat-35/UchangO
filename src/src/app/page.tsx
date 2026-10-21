import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServicesListing } from "@/features/services/components/services-listing";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // admin และช่างมีหน้าแรกของตัวเอง ไม่ต้องเห็นหน้าลูกค้า (hero/จองคิว)
    if (profile?.role === "admin") {
      redirect("/admin");
    }

    if (profile?.role === "technician") {
      redirect("/technician/work-orders");
    }
  }

  // ไม่ได้ login หรือเป็น customer -> เห็นหน้าลูกค้าตามปกติ
  return <ServicesListing />;
}
