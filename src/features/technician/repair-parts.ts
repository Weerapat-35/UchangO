import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Product } from "@/features/products";

type Client = SupabaseClient<Database>;
type RepairJobPart = Database["public"]["Tables"]["repair_job_parts"]["Row"];

export type TechnicianRepairPart = RepairJobPart & {
  product: Product | null;
};

export async function getTechnicianRepairParts(
  supabase: Client,
  userId: string,
  repairJobId: string,
) {
  const jobResult = await supabase
    .from("repair_jobs")
    .select("mechanic_id, status")
    .eq("id", repairJobId)
    .maybeSingle();

  if (jobResult.error) return { data: null, error: jobResult.error };
  if (!jobResult.data || jobResult.data.mechanic_id !== userId) {
    return { data: null, error: new Error("คุณไม่ได้รับมอบหมายงานนี้") };
  }

  const [partsResult, productsResult] = await Promise.all([
    supabase
      .from("repair_job_parts")
      .select("*")
      .eq("repair_job_id", repairJobId)
      .order("created_at", { ascending: true }),
    supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true }),
  ]);

  if (partsResult.error) return { data: null, error: partsResult.error };
  if (productsResult.error) return { data: null, error: productsResult.error };

  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product]),
  );

  return {
    data: {
      parts: (partsResult.data ?? []).map((part) => ({
        ...part,
        product: productsById.get(part.product_id) ?? null,
      })),
      products: productsResult.data ?? [],
      status: jobResult.data.status,
    },
    error: null,
  };
}

export async function addTechnicianRepairPart(
  supabase: Client,
  userId: string,
  repairJobId: string,
  productId: string,
  quantity: number,
) {
  const { data, error } = await supabase.rpc("add_repair_job_part", {
    p_product_id: productId,
    p_quantity: quantity,
    p_repair_job_id: repairJobId,
  });

  if (error) return { data: null, error };

  return getTechnicianRepairParts(supabase, userId, repairJobId);
}

export async function removeTechnicianRepairPart(
  supabase: Client,
  userId: string,
  repairJobId: string,
  partId: string,
) {
  const { error } = await supabase.rpc("remove_repair_job_part", {
    p_part_id: partId,
  });

  if (error) return { data: null, error };

  return getTechnicianRepairParts(supabase, userId, repairJobId);
}
