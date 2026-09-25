"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export type LocationValue = {
  latitude: number;
  longitude: number;
  address: string;
};

export type ReverseAddressDetails = {
  houseNumber?: string;
  road?: string;
  soi?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
};

type Props = {
  value: LocationValue | null;
  onChange: (value: LocationValue) => void;
  onAddressDetails?: (details: ReverseAddressDetails) => void;
  searchQuery?: string;
};

const BANGKOK: [number, number] = [13.7563, 100.5018];

function MapController({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, Math.max(map.getZoom(), 14));
  }, [map, position]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function LocationMap({ value, onChange, onAddressDetails, searchQuery }: Props) {
  const [position, setPosition] = useState<[number, number]>(
    value ? [value.latitude, value.longitude] : BANGKOK,
  );
  const [search, setSearch] = useState(searchQuery ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (searchQuery?.trim()) setSearch(searchQuery);
  }, [searchQuery]);

  async function reverseGeocode(lat: number, lng: number) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=th`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("ไม่สามารถอ่านที่อยู่จากแผนที่ได้");
      const data = await response.json();
      const address = data.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const parts = data.address ?? {};
      setPosition([lat, lng]);
      onChange({ latitude: lat, longitude: lng, address });
      onAddressDetails?.({
        houseNumber: parts.house_number,
        road: parts.road,
        soi: parts.pedestrian ?? parts.path,
        subdistrict: parts.suburb ?? parts.quarter ?? parts.village,
        district: parts.city_district ?? parts.district ?? parts.town ?? parts.city,
        province: parts.state ?? parts.province,
        postalCode: parts.postcode,
      });
    } catch (error) {
      setPosition([lat, lng]);
      onChange({
        latitude: lat,
        longitude: lng,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
      setMessage(error instanceof Error ? error.message : "อ่านที่อยู่ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  type SearchResult = {
    lat: string;
    lon: string;
    display_name: string;
  };

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  function buildSearchQueries(query: string) {
    const cleaned = query
      .replace(/บ้านเลขที่\s*/gi, "")
      .replace(/รหัสไปรษณีย์\s*/gi, "")
      .replace(/\b\d{5}\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const noHouse = cleaned
      .replace(/^\d+[\/-]?\d*\s*/, "")
      .replace(/หมู่\s*\d+\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const subdistrictMatch = query.match(/(?:ตำบล|ต\.)\s*([^\s]+?)(?=\s+(?:อำเภอ|อ\.|จังหวัด|จ\.)|$)/i);
    const districtMatch = query.match(/(?:อำเภอ|อ\.)\s*([^\s]+?)(?=\s+(?:จังหวัด|จ\.)|$)/i);
    const provinceMatch = query.match(/(?:จังหวัด|จ\.)\s*([^\s]+?)(?=\s+\d{5}\b|$)/i);

    const localityOnly = [
      subdistrictMatch?.[1],
      districtMatch?.[1],
      provinceMatch?.[1],
    ].filter(Boolean).join(" ");

    return Array.from(new Set([
      query,
      cleaned,
      noHouse,
      localityOnly,
      [subdistrictMatch?.[1], districtMatch?.[1], provinceMatch?.[1]].filter(Boolean).join(" "),
      [districtMatch?.[1], provinceMatch?.[1]].filter(Boolean).join(" "),
      provinceMatch?.[1] ?? "",
    ].map((item) => item.trim()).filter(Boolean)));
  }

  async function searchNominatim(query: string) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=th&addressdetails=1&accept-language=th&q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return [] as SearchResult[];
    return (await response.json()) as SearchResult[];
  }

  async function searchPhoton(query: string) {
    const response = await fetch(
      `https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return [] as SearchResult[];

    const data = await response.json();
    return (data.features ?? [])
      .filter((item: any) => Array.isArray(item.geometry?.coordinates))
      .map((item: any) => ({
        lat: String(item.geometry.coordinates[1]),
        lon: String(item.geometry.coordinates[0]),
        display_name: [
          item.properties?.name,
          item.properties?.street,
          item.properties?.district,
          item.properties?.city,
          item.properties?.state,
          item.properties?.postcode,
        ].filter(Boolean).join(", "),
      })) as SearchResult[];
  }

  async function searchPlace() {
    const query = search.trim();
    if (!query) return;

    setLoading(true);
    setMessage("");
    setSearchResults([]);

    try {
      const queries = buildSearchQueries(query);
      let results: SearchResult[] = [];

      // Try the exact address first, then progressively broader Thai address queries.
      for (const candidate of queries) {
        try {
          results = await searchNominatim(candidate);
          if (results.length) break;
        } catch {
          // Try the next candidate / fallback provider.
        }
      }

      // Photon is useful when Nominatim has no match for Thai locality text.
      if (!results.length) {
        for (const candidate of queries) {
          try {
            results = await searchPhoton(candidate);
            if (results.length) break;
          } catch {
            // Continue to the next candidate.
          }
        }
      }

      if (!results.length) {
        throw new Error(
          "ยังค้นหาพิกัดไม่เจอ ลองตัดบ้านเลขที่ออกแล้วค้นหาเฉพาะ ตำบล + อำเภอ + จังหวัด หรือคลิกตำแหน่งบนแผนที่",
        );
      }

      const unique = Array.from(
        new Map(results.map((item) => [`${item.lat},${item.lon}`, item])).values(),
      ).slice(0, 5);

      setSearchResults(unique);

      // Select the first result immediately, but let the user choose another result.
      const first = unique[0];
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      setPosition([lat, lng]);
      await reverseGeocode(lat, lng);

      if (unique.length > 1) {
        setMessage(`พบ ${unique.length} ตำแหน่ง กรุณาเลือกผลการค้นหาที่ตรงกับที่อยู่ของคุณ`);
      } else if (!first.display_name.includes(query)) {
        setMessage("ระบบพบพิกัดของพื้นที่ใกล้เคียงแล้ว กรุณาตรวจสอบหมุดกับแผนที่ก่อนยืนยัน");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ค้นหาสถานที่ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (result) => reverseGeocode(result.coords.latitude, result.coords.longitude),
      () => {
        setLoading(false);
        setMessage("ไม่สามารถเข้าถึงตำแหน่งปัจจุบันได้ กรุณาเลือกบนแผนที่แทน");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="min-h-11 flex-1 rounded-xl border border-[var(--line)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)]"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              searchPlace();
            }
          }}
          placeholder="ค้นหาที่อยู่ เช่น ตลาดแม่กลอง"
        />
        <button
          type="button"
          onClick={searchPlace}
          disabled={loading}
          className="rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          ค้นหา
        </button>
      </div>

      {searchResults.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
            ผลการค้นหา
          </div>
          <div className="max-h-52 overflow-y-auto">
            {searchResults.map((item) => {
              const lat = Number(item.lat);
              const lng = Number(item.lon);
              const selected = value?.latitude === lat && value?.longitude === lng;
              return (
                <button
                  key={`${item.lat}-${item.lon}`}
                  type="button"
                  onClick={() => {
                    void reverseGeocode(lat, lng);
                    setMessage("");
                  }}
                  className={`block w-full border-b border-[var(--line)] px-4 py-3 text-left text-sm last:border-b-0 hover:bg-red-50 ${selected ? "bg-red-50" : "bg-white"}`}
                >
                  <span className="block font-medium text-[var(--foreground)]">📍 {item.display_name || "ตำแหน่งบนแผนที่"}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {lat.toFixed(6)}, {lng.toFixed(6)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={loading}
        className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--brand)]"
      >
        📍 ใช้ตำแหน่งปัจจุบัน
      </button>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] shadow-sm">
        <MapContainer center={position} zoom={13} scrollWheelZoom className="h-[390px] w-full">
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController position={position} />
          <ClickHandler onPick={reverseGeocode} />
          <Marker position={position} icon={markerIcon} />
        </MapContainer>
      </div>

      <div className="rounded-xl bg-[var(--color-concrete-2)] p-4 text-sm">
        <p className="font-semibold text-[var(--foreground)]">ตำแหน่งที่เลือก</p>
        <p className="mt-1 leading-6 text-[var(--muted)]">
          {loading ? "กำลังอ่านตำแหน่ง..." : value?.address ?? "คลิกบนแผนที่เพื่อเลือกตำแหน่ง"}
        </p>
        {value ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
          </p>
        ) : null}
        {message ? <p className="mt-2 text-xs text-red-600">{message}</p> : null}
      </div>
    </div>
  );
}
