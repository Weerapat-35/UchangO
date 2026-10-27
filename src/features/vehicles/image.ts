import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const BUCKET = "vehicle-images";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Client = SupabaseClient<Database>;

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function validateVehicleImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "รองรับเฉพาะ JPG, PNG หรือ WEBP";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "ขนาดรูปต้องไม่เกิน 2 MB";
  }
  return null;
}

export async function uploadVehicleImage(
  supabase: Client,
  customerId: string,
  vehicleId: string,
  file: File,
) {
  const validationError = validateVehicleImage(file);
  if (validationError) return { data: null, error: new Error(validationError) };

  const path = `${customerId}/${vehicleId}-${Date.now()}.${extensionFor(file)}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) return { data: null, error: upload.error };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { data: { path, publicUrl: data.publicUrl }, error: null };
}

export async function updateVehicleImageUrl(
  supabase: Client,
  customerId: string,
  vehicleId: string,
  imageUrl: string | null,
) {
  const result = await supabase.from("vehicles")
    .update({ image_url: imageUrl })
    .eq("id", vehicleId)
    .eq("customer_id", customerId)
    .select("*")
    .single();
  return result;
}

export async function deleteVehicleImageFile(
  supabase: Client,
  imageUrl: string | null | undefined,
) {
  if (!imageUrl) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = imageUrl.indexOf(marker);
  if (index === -1) return;
  const path = imageUrl.slice(index + marker.length);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
