"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkAdminAccess,
  getAdminCustomers,
  setAdminUserRole,
  type AdminCustomerSummary,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import { bookingStatusLabel } from "@/lib/status-labels";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminLoadMessage,
  AdminModal,
  AdminPageIntro,
  AdminPill,
  AdminStatCard,
  AdminToast,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  type AdminPillTone,
} from "./admin-list-ui";

type LoadState =
  | { status: "loading" | "signed-out"; message: null; users: null }
  | { status: "access-denied" | "error"; message: string; users: null }
  | { status: "ready"; message: null; users: AdminCustomerSummary[] };

type UserRole = "customer" | "technician" | "admin";
type RoleFilter = "all" | UserRole;
type SortKey = "newest" | "latest-booking" | "most-bookings" | "name";

const pageSize = 10;

const ROLE: Record<string, { label: string; tone: AdminPillTone }> = {
  customer: { label: "ลูกค้า", tone: "danger" },
  technician: { label: "ช่าง", tone: "dark" },
  admin: { label: "ผู้ดูแล", tone: "brand" },
};

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: "customer", label: "ลูกค้า", description: "จองคิว ดูงานซ่อม และซื้อสินค้าของตัวเอง" },
  { value: "technician", label: "ช่าง", description: "เข้าหน้าช่าง รับใบงาน อัปเดตสถานะ และเบิกอะไหล่" },
  { value: "admin", label: "ผู้ดูแล", description: "เข้าหน้าแอดมินได้ทุกเมนู รวมถึงการเงินและสิทธิ์ผู้ใช้" },
];

function RoleDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminCustomerSummary;
  onClose: () => void;
  onSaved: (user: AdminCustomerSummary) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role as UserRole);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    const { data, error: saveError } = await setAdminUserRole(createClient(), user.id, role);
    if (saveError || !data) {
      setStatus("idle");
      setError(saveError?.message ?? "เปลี่ยนบทบาทไม่สำเร็จ");
      return;
    }
    onSaved({ ...user, role: data.role });
  }

  return (
    <AdminModal
      description={user.full_name || user.email || undefined}
      footer={
        <>
          <button className={adminSecondaryButtonClass} disabled={status === "saving"} onClick={onClose} type="button">ยกเลิก</button>
          <button className={adminPrimaryButtonClass} disabled={status === "saving" || role === user.role} onClick={() => void handleSave()} type="button">
            {status === "saving" ? "กำลังบันทึก..." : "บันทึกบทบาท"}
          </button>
        </>
      }
      onClose={onClose}
      open
      title="เปลี่ยนบทบาทผู้ใช้"
    >
      <fieldset className="space-y-2.5">
        <legend className="sr-only">บทบาท</legend>
        {ROLE_OPTIONS.map((option) => (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${role === option.value ? "border-[var(--color-safety)] bg-red-50/60" : "border-[var(--line)] hover:bg-[var(--color-concrete)]"}`}
            key={option.value}
          >
            <input
              checked={role === option.value}
              className="mt-1 h-4 w-4 accent-[var(--color-safety)]"
              name="user-role"
              onChange={() => setRole(option.value)}
              type="radio"
              value={option.value}
            />
            <span>
              <span className="block font-semibold text-[var(--foreground)]">
                {option.label}
                {option.value === user.role ? <span className="ml-2 text-xs font-normal text-[var(--muted)]">(ปัจจุบัน)</span> : null}
              </span>
              <span className="mt-0.5 block text-sm text-[var(--muted)]">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {role === "admin" && user.role !== "admin" ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">ผู้ดูแลจะเห็นข้อมูลทั้งหมดของร้าน และเปลี่ยนบทบาทของคนอื่นได้</p>
      ) : null}
      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
    </AdminModal>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function UserAvatar({ user }: { user: AdminCustomerSummary }) {
  if (user.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element -- รูปโปรไฟล์จาก Supabase storage
    return <img alt="" className="h-10 w-10 shrink-0 rounded-full border border-[var(--line)] object-cover" src={user.avatar_url} />;
  }
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${user.role === "customer" ? "bg-red-50 text-[var(--color-safety)]" : "bg-[var(--color-asphalt)] text-white"}`}>
      {(user.full_name || user.email || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

function pageNumbers(current: number, total: number) {
  // แสดงหน้าแรก หน้าสุดท้าย และรอบหน้าปัจจุบัน ที่เหลือเป็น …
  const pages = new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, index) => (index > 0 && page - sorted[index - 1] > 1 ? ["…", page] : [page])) as (number | "…")[];
}

export function AdminCustomersPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, users: null });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminCustomerSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadUsers() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, users: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, users: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, users: null });
      setCurrentUserId(session.user.id);

      const { data, error } = await getAdminCustomers(supabase);
      if (!isMounted) return;
      if (error) return setLoadState({ status: "error", message: error.message, users: null });
      setLoadState({ status: "ready", message: null, users: data ?? [] });
    }

    void loadUsers();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadUsers(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const users = useMemo(() => (loadState.status === "ready" ? loadState.users : []), [loadState]);
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { customer: 0, technician: 0, admin: 0 };
    for (const user of users) counts[user.role] = (counts[user.role] ?? 0) + 1;
    return counts;
  }, [users]);
  const newThisMonth = useMemo(() => {
    const now = new Date();
    return users.filter((user) => {
      const created = new Date(user.created_at);
      return user.role === "customer" && created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }).length;
  }, [users]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = users.filter((user) =>
      (roleFilter === "all" || user.role === roleFilter) &&
      (!keyword ||
        user.full_name.toLowerCase().includes(keyword) ||
        user.phone_number.toLowerCase().includes(keyword) ||
        (user.email ?? "").toLowerCase().includes(keyword)),
    );
    const latestKey = (user: AdminCustomerSummary) => (user.latestBooking ? `${user.latestBooking.booking_date} ${user.latestBooking.booking_time}` : "");
    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.full_name.localeCompare(b.full_name, "th");
      if (sortKey === "most-bookings") return b.bookingCount - a.bookingCount;
      if (sortKey === "latest-booking") return latestKey(b).localeCompare(latestKey(a));
      return b.created_at.localeCompare(a.created_at);
    });
  }, [users, search, roleFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleRoleSaved(updated: AdminCustomerSummary) {
    setLoadState((state) =>
      state.status === "ready"
        ? { ...state, users: state.users.map((user) => (user.id === updated.id ? updated : user)) }
        : state,
    );
    setEditingUser(null);
    setToast(`เปลี่ยนบทบาทเป็น "${ROLE[updated.role]?.label ?? updated.role}" แล้ว`);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดรายชื่อผู้ใช้..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro description="ตรวจสอบโปรไฟล์ผู้ใช้ จำนวนรถ ประวัติการจอง และสิทธิ์ลูกค้า / ช่าง / ผู้ดูแล" />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AdminStatCard highlight label="ผู้ใช้ทั้งหมด" value={users.length} />
            <AdminStatCard label="ลูกค้า" value={roleCounts.customer ?? 0} />
            <AdminStatCard label="ช่าง / ผู้ดูแล" value={`${roleCounts.technician ?? 0} / ${roleCounts.admin ?? 0}`} />
            <AdminStatCard label="ลูกค้าใหม่เดือนนี้" value={newThisMonth} />
          </div>

          <AdminFilterBar
            filter={roleFilter}
            filters={[
              { value: "all" as RoleFilter, label: "ทั้งหมด", count: users.length },
              { value: "customer" as RoleFilter, label: "ลูกค้า", count: roleCounts.customer ?? 0 },
              { value: "technician" as RoleFilter, label: "ช่าง", count: roleCounts.technician ?? 0 },
              { value: "admin" as RoleFilter, label: "ผู้ดูแล", count: roleCounts.admin ?? 0 },
            ]}
            onFilterChange={(value) => { setRoleFilter(value); setPage(1); }}
            onSearchChange={(value) => { setSearch(value); setPage(1); }}
            search={search}
            searchPlaceholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
            trailing={
              <select aria-label="เรียงลำดับ" className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--foreground)] lg:w-48" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}>
                <option value="newest">สมัครล่าสุดก่อน</option>
                <option value="latest-booking">จองล่าสุดก่อน</option>
                <option value="most-bookings">จองบ่อยที่สุดก่อน</option>
                <option value="name">เรียงตามชื่อ</option>
              </select>
            }
          />

          {filtered.length === 0 ? (
            <AdminEmptyState description="ลองเปลี่ยนคำค้นหาหรือตัวกรองสิทธิ์" title="ไม่พบผู้ใช้" />
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead className="bg-[var(--color-asphalt)] text-xs font-semibold text-white">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold" scope="col">ผู้ใช้</th>
                        <th className="px-3 py-3.5 font-semibold" scope="col">สิทธิ์</th>
                        <th className="px-3 py-3.5 text-right font-semibold" scope="col">รถ</th>
                        <th className="px-3 py-3.5 text-right font-semibold" scope="col">การจอง</th>
                        <th className="px-3 py-3.5 font-semibold" scope="col">การจองล่าสุด</th>
                        <th className="px-3 py-3.5 font-semibold" scope="col">วันที่สร้างบัญชี</th>
                        <th className="px-5 py-3.5" scope="col"><span className="sr-only">ดูข้อมูล</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageUsers.map((user) => {
                        const role = ROLE[user.role] ?? { label: user.role, tone: "muted" as AdminPillTone };
                        return (
                          <tr className="border-t border-[var(--line)] transition hover:bg-[var(--color-concrete)]" key={user.id}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <UserAvatar user={user} />
                                <div className="min-w-0">
                                  <p className="font-semibold text-[var(--foreground)]">{user.full_name || "ไม่ระบุชื่อ"}</p>
                                  <p className="text-xs text-[var(--muted)]">
                                    {user.phone_number ? <a className="hover:text-[var(--color-safety)]" href={`tel:${user.phone_number}`}>{user.phone_number}</a> : "ไม่มีเบอร์โทร"}
                                    {user.email ? <span className="hidden xl:inline"> · {user.email}</span> : null}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3.5">
                              <div className="flex items-center gap-2">
                                <AdminPill tone={role.tone}>{role.label}</AdminPill>
                                {user.id === currentUserId ? (
                                  <span className="text-xs text-[var(--muted)]">(คุณ)</span>
                                ) : (
                                  <button
                                    aria-label={`เปลี่ยนบทบาทของ ${user.full_name || user.email || "ผู้ใช้"}`}
                                    className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--muted)] underline-offset-2 hover:bg-[var(--color-concrete-2)] hover:text-[var(--color-safety)] hover:underline"
                                    onClick={() => setEditingUser(user)}
                                    type="button"
                                  >
                                    เปลี่ยน
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3.5 text-right font-semibold text-[var(--foreground)]">{user.vehicleCount}</td>
                            <td className="px-3 py-3.5 text-right font-semibold text-[var(--foreground)]">{user.bookingCount}</td>
                            <td className="whitespace-nowrap px-3 py-3.5">
                              {user.latestBooking ? (
                                <>
                                  <p className="text-[var(--foreground)]">{formatDate(`${user.latestBooking.booking_date}T00:00:00`)}</p>
                                  <p className="text-xs text-[var(--muted)]">{bookingStatusLabel(user.latestBooking.status)}</p>
                                </>
                              ) : <span className="text-[var(--muted)]">ยังไม่เคยจอง</span>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3.5 text-[var(--muted)]">{formatDate(user.created_at)}</td>
                            <td className="px-5 py-3.5 text-right">
                              <Link className="inline-flex min-h-9 items-center whitespace-nowrap rounded-xl bg-[var(--color-safety)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-safety-dim)]" href={`/admin/customers/${user.id}`}>
                                ดูข้อมูลผู้ใช้
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <nav aria-label="เปลี่ยนหน้า" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-[var(--muted)]">
                  แสดง {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} จาก {filtered.length} บัญชี
                </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-1.5">
                    <button className={`${adminSecondaryButtonClass} min-h-10 px-4`} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} type="button">ก่อนหน้า</button>
                    {pageNumbers(currentPage, totalPages).map((value, index) =>
                      value === "…" ? (
                        <span className="px-1 text-[var(--muted)]" key={`gap-${index}`}>…</span>
                      ) : (
                        <button
                          aria-current={value === currentPage ? "page" : undefined}
                          className={`grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-semibold ${value === currentPage ? "bg-[var(--color-safety)] text-white" : "bg-[var(--color-asphalt)] text-white hover:bg-[var(--color-asphalt-2)]"}`}
                          key={value}
                          onClick={() => setPage(value)}
                          type="button"
                        >
                          {value}
                        </button>
                      ),
                    )}
                    <button className={`${adminSecondaryButtonClass} min-h-10 px-4`} disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} type="button">ถัดไป</button>
                  </div>
                ) : null}
              </nav>
            </>
          )}
        </>
      )}
      {editingUser ? <RoleDialog onClose={() => setEditingUser(null)} onSaved={handleRoleSaved} user={editingUser} /> : null}
      <AdminToast message={toast} onDone={clearToast} />
    </main>
  );
}
