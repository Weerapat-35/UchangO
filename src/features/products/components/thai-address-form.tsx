"use client";

import { useEffect, useMemo, useState } from "react";

type Province = { id: number; name_th: string; name_en: string };
type District = { id: number; province_id: number; name_th: string; name_en: string };
type Subdistrict = { id: number; district_id: number; zip_code: number | string; name_th: string; name_en: string };

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
  const [districts, setDistricts] = useState<District[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${BASE}/province.json`)
      .then((r) => {
        if (!r.ok) throw new Error("โหลดรายชื่อจังหวัดไม่สำเร็จ");
        return r.json();
      })
      .then((data: Province[]) => {
        if (active) setProvinces(data);
      })
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลที่อยู่ไม่สำเร็จ"))
      .finally(() => active && setLoadingProvinces(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!value.provinceId) {
      setDistricts([]);
      return;
    }
    let active = true;
    setLoadingDistricts(true);
    fetch(`${BASE}/district.json`)
      .then((r) => {
        if (!r.ok) throw new Error("โหลดรายชื่ออำเภอไม่สำเร็จ");
        return r.json();
      })
      .then((data: District[]) => {
        if (active) setDistricts(data.filter((item) => String(item.province_id) === value.provinceId));
      })
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลอำเภอไม่สำเร็จ"))
      .finally(() => active && setLoadingDistricts(false));
    return () => { active = false; };
  }, [value.provinceId]);

  useEffect(() => {
    if (!value.districtId) {
      setSubdistricts([]);
      return;
    }
    let active = true;
    setLoadingSubdistricts(true);
    fetch(`${BASE}/sub_district.json`)
      .then((r) => {
        if (!r.ok) throw new Error("โหลดรายชื่อตำบลไม่สำเร็จ");
        return r.json();
      })
      .then((data: Subdistrict[]) => {
        if (active) setSubdistricts(data.filter((item) => String(item.district_id) === value.districtId));
      })
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลตำบลไม่สำเร็จ"))
      .finally(() => active && setLoadingSubdistricts(false));
    return () => { active = false; };
  }, [value.districtId]);

  const provinceOptions = useMemo(() => provinces.map((p) => ({ value: String(p.id), label: p.name_th })), [provinces]);
  const districtOptions = useMemo(() => districts.map((d) => ({ value: String(d.id), label: d.name_th })), [districts]);
  const subdistrictOptions = useMemo(() => subdistricts.map((s) => ({ value: String(s.id), label: s.name_th })), [subdistricts]);

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
            set({ provinceId, province: province?.name_th ?? "", districtId: "", district: "", subdistrictId: "", subdistrict: "", postalCode: "" });
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
            set({ districtId, district: district?.name_th ?? "", subdistrictId: "", subdistrict: "", postalCode: "" });
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
            set({ subdistrictId, subdistrict: sub?.name_th ?? "", postalCode: sub ? String(sub.zip_code) : "" });
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
