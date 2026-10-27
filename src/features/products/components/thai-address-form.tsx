"use client";

import { useEffect, useMemo, useState } from "react";

// ข้อมูลจาก kongvut/thai-province-data: v3 เก็บชื่อเป็น name: { th, en } ส่วน v2 เก็บเป็น name_th
// รองรับทั้งสองแบบ เพื่อไม่ให้ตัวเลือกว่างเปล่าเมื่อเจ้าของข้อมูลเปลี่ยนโครงสร้าง
type LocalizedName = { th?: string; en?: string };
type Named = { name?: LocalizedName | string; name_th?: string };
type Province = Named & { id: number };
type District = Named & { id: number; province_id: number };
type Subdistrict = Named & { id: number; district_id: number; zip_code?: number | string; postal_code?: number | string };

function nameOf(item: Named): string {
  if (item.name_th) return item.name_th;
  if (typeof item.name === "string") return item.name;
  return item.name?.th ?? "";
}

// เรียงตามพจนานุกรมไทย ก-ฮ (สระนำหน้า เช่น เ แ โ ใ ไ ไม่นับในการเรียง)
function byThaiLabel(a: { label: string }, b: { label: string }) {
  return a.label.localeCompare(b.label, "th");
}

function zipOf(item: Subdistrict): string {
  return String(item.zip_code ?? item.postal_code ?? "");
}

export type ThaiAddressValue = {
  houseNumber: string;
  moo: string;
  soi: string;
  road: string;
  provinceId: string;
  province: string;
  districtId: string;
  district: string;
  subdistrictId: string;
  subdistrict: string;
  postalCode: string;
};

type Props = {
  value: ThaiAddressValue;
  onChange: (value: ThaiAddressValue) => void;
};

const BASE = "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest";

// เก็บผลที่โหลดแล้วไว้ใช้ซ้ำ (ไฟล์ตำบลใหญ่ ไม่ต้องโหลดใหม่ทุกครั้งที่เปลี่ยนอำเภอ)
const jsonCache = new Map<string, Promise<unknown>>();

function loadJson<T>(file: string, errorMessage: string): Promise<T> {
  let request = jsonCache.get(file) as Promise<T> | undefined;
  if (!request) {
    request = fetch(`${BASE}/${file}`).then((response) => {
      if (!response.ok) throw new Error(errorMessage);
      return response.json() as Promise<T>;
    });
    request.catch(() => jsonCache.delete(file));
    jsonCache.set(file, request);
  }
  return request;
}

const emptyValue: ThaiAddressValue = {
  houseNumber: "",
  moo: "",
  soi: "",
  road: "",
  provinceId: "",
  province: "",
  districtId: "",
  district: "",
  subdistrictId: "",
  subdistrict: "",
  postalCode: "",
};

export function emptyThaiAddress(): ThaiAddressValue {
  return { ...emptyValue };
}

function Field({ label, value, onChange, placeholder, required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
      {label}{required ? " *" : ""}
      <input
        className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange, disabled, loading, required = false }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
      {label}{required ? " *" : ""}
      <select
        className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)] disabled:bg-gray-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      >
        <option value="">{loading ? "กำลังโหลด..." : `เลือก${label}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function ThaiAddressForm({ value, onChange }: Props) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  // Each list remembers which parent it was loaded for, so stale lists are never shown.
  const [districtData, setDistrictData] = useState<{ provinceId: string; items: District[] }>({ provinceId: "", items: [] });
  const [subdistrictData, setSubdistrictData] = useState<{ districtId: string; items: Subdistrict[] }>({ districtId: "", items: [] });
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    loadJson<Province[]>("province.json", "โหลดรายชื่อจังหวัดไม่สำเร็จ")
      .then((data) => {
        if (active) setProvinces(data);
      })
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลที่อยู่ไม่สำเร็จ"))
      .finally(() => active && setLoadingProvinces(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const provinceId = value.provinceId;
    if (!provinceId) return;
    let active = true;
    loadJson<District[]>("district.json", "โหลดรายชื่ออำเภอไม่สำเร็จ")
      .then((data) => {
        if (active) setDistrictData({ provinceId, items: data.filter((item) => String(item.province_id) === provinceId) });
      })
      .catch((e) => {
        if (!active) return;
        setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลอำเภอไม่สำเร็จ");
        setDistrictData({ provinceId, items: [] });
      });
    return () => { active = false; };
  }, [value.provinceId]);

  useEffect(() => {
    const districtId = value.districtId;
    if (!districtId) return;
    let active = true;
    loadJson<Subdistrict[]>("sub_district.json", "โหลดรายชื่อตำบลไม่สำเร็จ")
      .then((data) => {
        if (active) setSubdistrictData({ districtId, items: data.filter((item) => String(item.district_id) === districtId) });
      })
      .catch((e) => {
        if (!active) return;
        setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลตำบลไม่สำเร็จ");
        setSubdistrictData({ districtId, items: [] });
      });
    return () => { active = false; };
  }, [value.districtId]);

  const districts = useMemo(
    () => (value.provinceId && districtData.provinceId === value.provinceId ? districtData.items : []),
    [districtData, value.provinceId],
  );
  const subdistricts = useMemo(
    () => (value.districtId && subdistrictData.districtId === value.districtId ? subdistrictData.items : []),
    [subdistrictData, value.districtId],
  );
  const loadingDistricts = Boolean(value.provinceId) && districtData.provinceId !== value.provinceId;
  const loadingSubdistricts = Boolean(value.districtId) && subdistrictData.districtId !== value.districtId;

  const provinceOptions = useMemo(() => provinces.map((p) => ({ value: String(p.id), label: nameOf(p) })).sort(byThaiLabel), [provinces]);
  const districtOptions = useMemo(() => districts.map((d) => ({ value: String(d.id), label: nameOf(d) })).sort(byThaiLabel), [districts]);
  const subdistrictOptions = useMemo(() => subdistricts.map((s) => ({ value: String(s.id), label: nameOf(s) })).sort(byThaiLabel), [subdistricts]);

  function set(partial: Partial<ThaiAddressValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="บ้านเลขที่" value={value.houseNumber} onChange={(houseNumber) => set({ houseNumber })} placeholder="เช่น 99/9" required />
        <Field label="หมู่ที่" value={value.moo} onChange={(moo) => set({ moo })} placeholder="เช่น 4" />
        <Field label="ซอย" value={value.soi} onChange={(soi) => set({ soi })} placeholder="เช่น สุขุมวิท 21" />
        <Field label="ถนน" value={value.road} onChange={(road) => set({ road })} placeholder="เช่น ถนนพระราม 2" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="จังหวัด"
          value={value.provinceId}
          options={provinceOptions}
          loading={loadingProvinces}
          onChange={(provinceId) => {
            const province = provinces.find((p) => String(p.id) === provinceId);
            set({ provinceId, province: province ? nameOf(province) : "", districtId: "", district: "", subdistrictId: "", subdistrict: "", postalCode: "" });
          }}
          required
        />
        <SelectField
          label="อำเภอ"
          value={value.districtId}
          options={districtOptions}
          loading={loadingDistricts}
          disabled={!value.provinceId}
          onChange={(districtId) => {
            const district = districts.find((d) => String(d.id) === districtId);
            set({ districtId, district: district ? nameOf(district) : "", subdistrictId: "", subdistrict: "", postalCode: "" });
          }}
          required
        />
        <SelectField
          label="ตำบล"
          value={value.subdistrictId}
          options={subdistrictOptions}
          loading={loadingSubdistricts}
          disabled={!value.districtId}
          onChange={(subdistrictId) => {
            const sub = subdistricts.find((s) => String(s.id) === subdistrictId);
            set({ subdistrictId, subdistrict: sub ? nameOf(sub) : "", postalCode: sub ? zipOf(sub) : "" });
          }}
          required
        />
      </div>

      <Field label="รหัสไปรษณีย์" value={value.postalCode} onChange={() => {}} placeholder="ระบบเติมให้อัตโนมัติ" required />

      <div className="rounded-xl bg-white px-4 py-3 text-xs leading-6 text-[var(--muted)]">
        <span className="font-semibold text-[var(--foreground)]">ตัวอย่าง:</span>{" "}
        {value.houseNumber || "99/9"} {value.moo ? `หมู่ ${value.moo} ` : ""}{value.soi ? `ซอย${value.soi} ` : ""}{value.road ? `ถนน${value.road} ` : ""}
        {value.subdistrict ? `ต.${value.subdistrict} ` : ""}{value.district ? `อ.${value.district} ` : ""}{value.province ? `จ.${value.province} ` : ""}{value.postalCode}
      </div>

      {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
    </div>
  );
}

// ใช้ร่วมกับหน้าชำระเงิน (เติมที่อยู่จากหมุดบนแผนที่)
export { loadJson as loadThaiAddressJson, nameOf as thaiNameOf, zipOf as thaiZipOf };
export type { District as ThaiDistrict, Province as ThaiProvince, Subdistrict as ThaiSubdistrict };
