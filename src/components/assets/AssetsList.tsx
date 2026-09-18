"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { Asset, AssetStatus, Member } from "@/data/wealth-transfer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddAssetModal, type AssetFormPayload } from "@/components/assets/AddAssetModal";
import { DeleteAssetModal } from "@/components/assets/DeleteAssetModal";
import { WizardModal } from "@/components/wizard/WizardModal";
import { displayTypeLabel } from "@/data/asset-taxonomy";
import { assetDisplayAmount, money } from "@/lib/format";
import { createAsset, fetchAssets, softDeleteAsset, softDeleteAssets, updateAsset } from "@/lib/assets-db";
import { fetchMembers } from "@/lib/members-db";
import { exportAssetsToExcel } from "@/lib/export-assets-excel";
import { ImportExcelModal } from "@/components/assets/ImportExcelModal";
import { GroupPlanModal } from "@/components/assets/GroupPlanModal";
import { downloadAssetImportTemplate } from "@/lib/import/excel-template";

export function AssetsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Asset[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [duplicating, setDuplicating] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<Asset[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardAssetId, setWizardAssetId] = useState<string | undefined>();
  const [wizardToast, setWizardToast] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excelOpen, setExcelOpen] = useState(false);
  const excelMenuRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const [assets, memberList] = await Promise.all([
      fetchAssets(),
      fetchMembers(),
    ]);
    setItems(assets);
    setMembers(memberList);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [assets, memberList] = await Promise.all([
          fetchAssets(),
          fetchMembers(),
        ]);
        if (!cancelled) {
          setItems(assets);
          setMembers(memberList);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "โหลดข้อมูลทรัพย์สินจากฐานข้อมูลไม่สำเร็จ",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const asset = searchParams.get("asset");
    const wizard = searchParams.get("wizard");
    if (asset) {
      setWizardAssetId(asset);
      setWizardOpen(true);
      return;
    }
    if (wizard === "1") {
      setWizardAssetId(undefined);
      setWizardOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!excelOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!excelMenuRef.current?.contains(event.target as Node)) {
        setExcelOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [excelOpen]);

  function openWizard(assetId?: string) {
    setWizardAssetId(assetId);
    setWizardOpen(true);
    const params = new URLSearchParams();
    if (assetId) params.set("asset", assetId);
    else params.set("wizard", "1");
    router.replace(`/assets?${params.toString()}`, { scroll: false });
  }

  function closeWizard(reason?: "cancel" | "saved") {
    setWizardOpen(false);
    setWizardAssetId(undefined);
    router.replace("/assets", { scroll: false });
    // รีเฟรชสถานะเสมอ — คำนวณสถานการณ์แล้วถือว่ามีแผน
    void reload();
    if (reason === "saved") {
      setWizardToast("เพิ่มเข้าสู่แผนแล้ว");
      window.setTimeout(() => setWizardToast(""), 2800);
    }
  }

  const types = useMemo(
    () => [...new Set(items.map((a) => a.type))],
    [items],
  );
  const owners = useMemo(() => {
    const names = new Set<string>();
    for (const a of items) {
      if (a.owners && a.owners.length > 0) {
        for (const o of a.owners) names.add(o.owner);
      } else if (a.owner) {
        names.add(a.owner);
      }
    }
    return [...names];
  }, [items]);
  const statuses = useMemo(
    () => [...new Set(items.map((a) => a.status))],
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      const ownerNames =
        a.owners && a.owners.length > 0
          ? a.owners.map((o) => o.owner).join(" ")
          : a.owner;
      const matchQuery =
        !q ||
        `${a.name} ${ownerNames} ${a.type} ${a.subtype ?? ""} ${a.id} ${a.role} ${a.detail ?? ""}`
          .toLowerCase()
          .includes(q);
      const matchType = type === "all" || a.type === type;
      const matchOwner =
        owner === "all" ||
        a.owner === owner ||
        (a.owners?.some((o) => o.owner === owner) ?? false);
      const matchStatus = status === "all" || a.status === status;
      return matchQuery && matchType && matchOwner && matchStatus;
    });
  }, [items, query, type, owner, status]);

  async function handleSave(data: AssetFormPayload) {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const updated = await updateAsset(editing.id, data);
        setItems((prev) =>
          prev.map((a) => (a.id === editing.id ? updated : a)),
        );
        setEditing(null);
        setDuplicating(null);
        setModalOpen(false);
      } else {
        const asset = await createAsset(data);
        setItems((prev) => [...prev, asset]);
        setDuplicating(null);
        setModalOpen(false);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : editing
            ? "แก้ไขทรัพย์สินไม่สำเร็จ"
            : "บันทึกทรัพย์สินไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setDuplicating(null);
    setModalOpen(true);
  }

  function openEdit(asset: Asset) {
    setDuplicating(null);
    setEditing(asset);
    setModalOpen(true);
  }

  function openDuplicate(asset: Asset) {
    const baseName = asset.name.replace(/\s*\(สำเนา(?:\s*\d+)?\)\s*$/, "").trim();
    const copyCount = items.filter((a) => {
      const n = a.name.replace(/\s*\(สำเนา(?:\s*\d+)?\)\s*$/, "").trim();
      return n === baseName;
    }).length;
    setEditing(null);
    setDuplicating({
      ...asset,
      name: copyCount <= 1 ? `${baseName} (สำเนา)` : `${baseName} (สำเนา ${copyCount})`,
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setDuplicating(null);
  }

  function requestDelete(asset: Asset) {
    setDeleting([asset]);
  }

  function requestDeleteSelected() {
    const selected = items.filter((a) => selectedIds.includes(a.id));
    if (selected.length === 0) return;
    setDeleting(selected);
  }

  async function confirmDelete() {
    const targets = deleting;
    if (targets.length === 0) return;
    const ids = new Set(targets.map((a) => a.id));
    const rollback = items;
    setItems((prev) => prev.filter((a) => !ids.has(a.id)));
    setSelectedIds((prev) => prev.filter((id) => !ids.has(id)));
    setError(null);
    setSaving(true);
    try {
      if (targets.length === 1) {
        await softDeleteAsset(targets[0]!.id);
      } else {
        await softDeleteAssets(targets.map((a) => a.id));
      }
      setDeleting([]);
    } catch (e) {
      setItems(rollback);
      setError(e instanceof Error ? e.message : "ลบทรัพย์สินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
    if (editing && ids.has(editing.id)) {
      setEditing(null);
      setModalOpen(false);
    }
  }

  function handleExportExcel() {
    try {
      exportAssetsToExcel(filtered.length > 0 ? filtered : items);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "ส่งออก Excel ไม่สำเร็จ",
      );
    }
  }

  function toggleSelected(id: string, checked?: boolean) {
    setSelectedIds((ids) => {
      const has = ids.includes(id);
      const next = checked ?? !has;
      if (next) return has ? ids : [...ids, id];
      return ids.filter((x) => x !== id);
    });
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-slate-600"
          >
            <ArrowLeft className="h-3 w-3" />
            ภาพรวม
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            รายการทรัพย์สิน
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {items.length} รายการ
            {saving ? " · กำลังบันทึก..." : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative" ref={excelMenuRef}>
            <button
              type="button"
              onClick={() => setExcelOpen((open) => !open)}
              aria-expanded={excelOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
              <ChevronDown className={`h-3 w-3 text-slate-400 transition ${excelOpen ? "rotate-180" : ""}`} />
            </button>
            {excelOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg shadow-slate-200/80"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExcelOpen(false);
                    setImportOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-3.5 w-3.5 text-slate-400" />
                  นำเข้า
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={loading || items.length === 0}
                  onClick={() => {
                    setExcelOpen(false);
                    handleExportExcel();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  ส่งออก
                  {filtered.length > 0 && filtered.length < items.length
                    ? ` (${filtered.length})`
                    : null}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExcelOpen(false);
                    downloadAssetImportTemplate();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  แบบฟอร์มนำเข้า
                </button>
              </div>
            ) : null}
          </div>
          {selectedIds.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setGroupOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white"
              >
                เข้าแผน {selectedIds.length}
              </button>
              <button
                type="button"
                onClick={requestDeleteSelected}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {filtered.length > 0 &&
                filtered.every((a) => selectedIds.includes(a.id))
                  ? "ลบทั้งหมด"
                  : `ลบ ${selectedIds.length} รายการ`}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={openCreate}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg bg-mint-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่ม
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
          <button
            type="button"
            className="ml-3 font-semibold underline"
            onClick={() => {
              void (async () => {
                try {
                  setLoading(true);
                  await reload();
                  setError(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "โหลดข้อมูลไม่สำเร็จ",
                  );
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            ลองใหม่
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
          <div className="relative min-w-[220px] flex-grow">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาทรัพย์สิน..."
              className="w-full rounded-xl border border-slate-200 py-2 pr-4 pl-9 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
            />
          </div>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกประเภท</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกผู้ถือกรรมสิทธิ์</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AssetStatus | "all")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกสถานะ</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <th className="w-14 px-3 py-2.5">
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="check"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((a) => selectedIds.includes(a.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filtered.map((a) => a.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      aria-label="เลือกทั้งหมด"
                    />
                    <span>#</span>
                  </label>
                </th>
                <th className="px-3 py-2.5">ทรัพย์สิน</th>
                <th className="px-3 py-2.5">ผู้ถือกรรมสิทธิ์</th>
                <th className="px-3 py-2.5">ประเภท</th>
                <th className="px-3 py-2.5 text-right">มูลค่า</th>
                <th className="px-3 py-2.5 text-center">สถานะ</th>
                <th className="px-3 py-2.5 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {loading ? (
                <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    กำลังโหลดจากฐานข้อมูล...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    {items.length === 0
                      ? "ยังไม่มีทรัพย์สิน — กด “เพิ่มทรัพย์สิน” เพื่อเริ่มบันทึก"
                      : "ไม่พบทรัพย์สินที่ตรงกับเงื่อนไข"}
                  </td>
                </tr>
              ) : (
                filtered.map((a, index) => {
                  const selected = selectedIds.includes(a.id);
                  return (
                  <tr
                    key={a.id}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("button, a, input, label")) {
                        return;
                      }
                      toggleSelected(a.id);
                    }}
                    className={`cursor-pointer transition-colors duration-150 ${
                      selected ? "bg-mint-50/80" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="check"
                          checked={selected}
                          onChange={(e) => toggleSelected(a.id, e.target.checked)}
                          aria-label={`เลือก ${a.name}`}
                        />
                        <span className="w-4 text-[11px] tabular-nums text-slate-400">
                          {index + 1}
                        </span>
                      </label>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-800">{a.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {a.detail || a.role}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {a.owners && a.owners.length > 1 ? (
                        <>
                          <div className="font-medium text-slate-700">
                            กรรมสิทธิ์ร่วม
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {a.owners.map((o) => o.owner).join(", ")}
                          </div>
                        </>
                      ) : (
                        <>
                          <div>{a.owner}</div>
                          {a.ownerKind ? (
                            <div className="text-[10px] text-slate-400">
                              {a.ownerKind}
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <div>{a.type}</div>
                      {a.subtype ? (
                        <div className="text-[10px] text-slate-400">
                          {a.subtype}
                        </div>
                      ) : null}
                      <span className="sr-only">
                        {displayTypeLabel(a.type, a.subtype)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-800 tabular-nums">
                      {money(assetDisplayAmount(a))}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="แก้ไข"
                          onClick={() => openEdit(a)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-sky-50 text-sky-600 transition [outline:unset] hover:bg-sky-100 hover:text-sky-700"
                          aria-label={`แก้ไข ${a.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="ทำซ้ำ"
                          onClick={() => openDuplicate(a)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 text-violet-600 transition [outline:unset] hover:bg-violet-100 hover:text-violet-700"
                          aria-label={`ทำซ้ำ ${a.name}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="วางแผน"
                          onClick={() => openWizard(a.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-mint-brandLight text-mint-brand transition [outline:unset] hover:bg-mint-100 hover:text-mint-brandDark"
                          aria-label={`วางแผน ${a.name}`}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="ลบ"
                          onClick={() => requestDelete(a)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-500 transition [outline:unset] hover:bg-rose-100 hover:text-rose-600"
                          aria-label={`ลบ ${a.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-500">
          <span>
            แสดงผล {filtered.length} จากทั้งหมด {items.length} รายการ
          </span>
        </div>
      </div>

      <AddAssetModal
        open={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        members={members}
        saving={saving}
        initial={editing ?? duplicating}
        asDuplicate={Boolean(duplicating)}
      />
      <DeleteAssetModal
        open={deleting.length > 0}
        assets={deleting}
        busy={saving}
        onClose={() => {
          if (saving) return;
          setDeleting([]);
        }}
        onConfirm={() => void confirmDelete()}
      />
      <WizardModal
        open={wizardOpen}
        onClose={closeWizard}
        initialAssetId={wizardAssetId}
        assets={items}
        members={members}
      />
      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={reload}
      />
      <GroupPlanModal
        open={groupOpen}
        assets={items.filter((a) => selectedIds.includes(a.id))}
        members={members}
        onClose={() => setGroupOpen(false)}
        onSaved={async () => {
          setSelectedIds([]);
          await reload();
        }}
      />
      {wizardToast ? (
        <div className="fixed top-20 right-4 z-[60] rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg animate-[fadeUp_0.25s_ease]">
          {wizardToast}
        </div>
      ) : null}
    </>
  );
}
