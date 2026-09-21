"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  createAdminFamily,
  deleteAdminFamily,
  fetchAdminFamilies,
  fetchAdminUsers,
  updateAdminFamily,
  type AdminFamilyRow,
  type AdminUserRow,
} from "@/lib/admin-db";
import {
  AdminFamilyModal,
  type AdminFamilyFormData,
} from "@/components/admin/AdminFamilyModal";
import { AdminFamilyDeleteModal } from "@/components/admin/AdminFamilyDeleteModal";
import { Toast, useToast } from "@/components/ui/Toast";

const PAGE_SIZE = 10;

type RoleFilter = "all" | "admin" | "user";
type StatusFilter = "all" | "active" | "inactive";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pageNumbers(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set([1, total, current - 1, current, current + 1]);
  return [...set]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
}

export default function AdminFamiliesPage() {
  const [rows, setRows] = useState<AdminFamilyRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminFamilyRow | null>(null);
  const [deleting, setDeleting] = useState<AdminFamilyRow | null>(null);
  const { toast, showSuccess, showError, clear } = useToast();

  const usersByName = useMemo(() => {
    const map = new Map<string, AdminUserRow>();
    for (const user of users) {
      map.set(user.username.toLowerCase(), user);
    }
    return map;
  }, [users]);

  const load = useCallback(async () => {
    try {
      const [families, accounts] = await Promise.all([
        fetchAdminFamilies(),
        fetchAdminUsers(),
      ]);
      setRows(families);
      setUsers(accounts);
    } catch (err) {
      showError(err instanceof Error ? err.message : "โหลดครอบครัวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, role, status]);

  const ownerOptions = useMemo(
    () =>
      users
        .filter((user) => !user.familyId)
        .map((user) => ({
          username: user.username,
          displayName: user.displayName,
        })),
    [users],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const owner = usersByName.get(row.ownerUsername.toLowerCase());
      const matchQuery =
        !q ||
        `${row.name} ${row.familyId} ${row.ownerUsername} ${row.ownerDisplayName ?? ""}`
          .toLowerCase()
          .includes(q);
      const matchRole =
        role === "all" ||
        (role === "admin" ? Boolean(owner?.isAdmin) : !owner?.isAdmin);
      const matchStatus =
        status === "all" ||
        (status === "active" ? owner?.isActive !== false : owner?.isActive === false);
      return matchQuery && matchRole && matchStatus;
    });
  }, [rows, query, role, status, usersByName]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const pages = pageNumbers(currentPage, pageCount);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(row: AdminFamilyRow) {
    setEditing(row);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSave(data: AdminFamilyFormData) {
    setSaving(true);
    try {
      if (editing) {
        await updateAdminFamily(editing.familyId, data.name);
        showSuccess(`บันทึกครอบครัว ${data.name} แล้ว`);
      } else {
        await createAdminFamily(data.name, data.ownerUsername);
        showSuccess(`สร้างครอบครัว ${data.name} แล้ว`);
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "บันทึกครอบครัวไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteAdminFamily(deleting.familyId);
      showSuccess(`ลบครอบครัว ${deleting.name} แล้ว`);
      setDeleting(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "ลบครอบครัวไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Toast toast={toast} onClose={clear} />

      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            ครอบครัว
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            เพิ่ม แก้ไข ลบ และกรองครอบครัวที่ผูกกับบัญชี
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มครอบครัว
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อครอบครัว รหัส หรือเจ้าของบัญชี..."
              className="w-full rounded-xl border border-slate-200 py-2 pr-4 pl-9 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกสิทธิ์เจ้าของ</option>
            <option value="admin">เจ้าของเป็นผู้ดูแล</option>
            <option value="user">เจ้าของทั่วไป</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกสถานะเจ้าของ</option>
            <option value="active">เจ้าของใช้งาน</option>
            <option value="inactive">เจ้าของปิดอยู่</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-400">
              <tr>
                <th className="px-4 py-3">ครอบครัว</th>
                <th className="px-4 py-3">รหัส</th>
                <th className="px-4 py-3">เจ้าของบัญชี</th>
                <th className="px-4 py-3">สร้างเมื่อ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {!loading &&
                pageRows.map((row) => {
                  const owner = usersByName.get(row.ownerUsername.toLowerCase());
                  return (
                    <tr
                      key={row.familyId}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {row.familyId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">
                          {row.ownerUsername}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.ownerDisplayName || "—"}
                          {owner?.isAdmin ? " · ผู้ดูแล" : ""}
                          {owner && !owner.isActive ? " · ปิดอยู่" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="แก้ไข"
                            onClick={() => openEdit(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition hover:bg-sky-100 hover:text-sky-700"
                            aria-label={`แก้ไข ${row.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="ลบ"
                            onClick={() => setDeleting(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-600"
                            aria-label={`ลบ ${row.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            กำลังโหลด...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            ไม่พบครอบครัวตามตัวกรอง
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-50 bg-slate-50/50 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            แสดง {from}–{to} จาก {filtered.length} รายการ
            {filtered.length !== rows.length ? ` (ทั้งหมด ${rows.length})` : ""}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              aria-label="หน้าก่อน"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pages.map((n, i) => {
              const prev = pages[i - 1];
              return (
                <span key={n} className="flex items-center gap-1">
                  {prev != null && n - prev > 1 ? (
                    <span className="px-1 text-slate-300">…</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPage(n)}
                    className={`h-8 min-w-8 rounded-lg px-2 font-semibold ${
                      n === currentPage
                        ? "bg-orange-500 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              aria-label="หน้าถัดไป"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <AdminFamilyModal
        open={modalOpen}
        initialName={editing?.name}
        initialOwnerUsername={editing?.ownerUsername}
        ownerOptions={ownerOptions}
        saving={saving}
        onClose={closeModal}
        onSave={handleSave}
      />
      <AdminFamilyDeleteModal
        open={Boolean(deleting)}
        family={deleting}
        busy={saving}
        onClose={() => {
          if (!saving) setDeleting(null);
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </div>
  );
}
