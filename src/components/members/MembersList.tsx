"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Pencil, Plus, Search, Table2, Trash2 } from "lucide-react";
import type { Member } from "@/data/wealth-transfer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddMemberModal } from "@/components/members/AddMemberModal";
import { DeleteMemberModal } from "@/components/members/DeleteMemberModal";
import { FamilyTree } from "@/components/members/FamilyTree";
import { MemberAvatar } from "@/components/members/MemberAvatar";
import {
  fetchMembers,
  nextMemberId,
  persistMembers,
  softDeleteMember,
} from "@/lib/members-db";
import { getStoredFamilyName } from "@/lib/auth";

type MembersListProps = {
  initialMembers?: Member[];
};

type ViewTab = "canvas" | "table";

function genNumber(gen: string) {
  const m = /(\d+)/.exec(gen);
  return m ? Number(m[1]) : 0;
}

export function MembersList({ initialMembers = [] }: MembersListProps) {
  const [items, setItems] = useState<Member[]>(initialMembers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [view, setView] = useState<ViewTab>("canvas");
  const [query, setQuery] = useState("");
  const [gen, setGen] = useState("all");
  const [relation, setRelation] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const list = await fetchMembers();
    setItems(list);
  }, []);

  useEffect(() => {
    setFamilyName(getStoredFamilyName());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const list = await fetchMembers();
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "โหลดข้อมูลสมาชิกจากฐานข้อมูลไม่สำเร็จ",
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

  const gens = useMemo(
    () => [...new Set(items.map((m) => m.gen))],
    [items],
  );
  const relations = useMemo(
    () => [...new Set(items.map((m) => m.relation))],
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => {
      const matchQuery =
        !q ||
        `${m.name} ${m.id} ${m.gen} ${m.relation} ${m.status}`
          .toLowerCase()
          .includes(q);
      const matchGen = gen === "all" || m.gen === gen;
      const matchRelation = relation === "all" || m.relation === relation;
      return matchQuery && matchGen && matchRelation;
    });
  }, [items, query, gen, relation]);

  const treeByGen = useMemo(() => {
    const order = [...new Set(items.map((m) => m.gen))];
    return order.map((g) => ({
      gen: g,
      people: items.filter((m) => m.gen === g),
    }));
  }, [items]);

  async function commit(next: Member[], rollback: Member[]) {
    setItems(next);
    setError(null);
    setSaving(true);
    try {
      await persistMembers(next);
      return true;
    } catch (e) {
      setItems(rollback);
      setError(
        e instanceof Error ? e.message : "บันทึกข้อมูลสมาชิกไม่สำเร็จ",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(data: Omit<Member, "id">) {
    const rollback = items;
    if (editing) {
      let next = items.map((m) =>
        m.id === editing.id ? { ...m, ...data } : m,
      );
      if (data.partnerId) {
        next = next.map((m) => {
          if (m.id === data.partnerId) return { ...m, partnerId: editing.id };
          if (m.partnerId === editing.id && m.id !== data.partnerId) {
            return { ...m, partnerId: undefined };
          }
          return m;
        });
      } else {
        next = next.map((m) =>
          m.partnerId === editing.id ? { ...m, partnerId: undefined } : m,
        );
      }
      const ok = await commit(next, rollback);
      if (!ok) throw new Error("บันทึกข้อมูลสมาชิกไม่สำเร็จ");
      setEditing(null);
      return;
    }

    let id: string;
    try {
      id = await nextMemberId();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "สร้างรหัสสมาชิกไม่สำเร็จ";
      setError(message);
      throw new Error(message);
    }
    const member: Member = {
      id,
      ...data,
    };
    let next = [...items, member];
    if (data.partnerId) {
      next = next.map((m) =>
        m.id === data.partnerId ? { ...m, partnerId: member.id } : m,
      );
    }
    const ok = await commit(next, rollback);
    if (!ok) throw new Error("บันทึกข้อมูลสมาชิกไม่สำเร็จ");
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(member: Member) {
    setEditing(member);
    setModalOpen(true);
  }

  function handleSwap(aId: string, bId: string) {
    const rollback = items;
    const i = items.findIndex((m) => m.id === aId);
    const j = items.findIndex((m) => m.id === bId);
    if (i < 0 || j < 0) return;
    if (items[i].gen !== items[j].gen) return;
    const next = [...items];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    void commit(next, rollback);
  }

  function handleLink(fromId: string, toId: string) {
    const rollback = items;
    const from = items.find((m) => m.id === fromId);
    const to = items.find((m) => m.id === toId);
    if (!from || !to) return;

    const fromGen = genNumber(from.gen);
    const toGen = genNumber(to.gen);
    let next: Member[];

    if (fromGen === toGen) {
      next = items.map((m) => {
        if (m.id === fromId) return { ...m, partnerId: toId };
        if (m.id === toId) return { ...m, partnerId: fromId };
        return m;
      });
    } else {
      const child = fromGen > toGen ? from : to;
      const parentId = fromGen > toGen ? toId : fromId;
      next = items.map((m) => {
        if (m.id !== child.id) return m;
        const existing = m.parentIds ?? [];
        if (existing.includes(parentId)) return m;
        return { ...m, parentIds: [...existing, parentId].slice(-2) };
      });
    }

    void commit(next, rollback);
  }

  function requestDelete(member: Member) {
    setDeleting(member);
  }

  async function confirmDelete() {
    const member = deleting;
    if (!member) return;
    const rollback = items;
    const next = items
      .filter((m) => m.id !== member.id)
      .map((m) => ({
        ...m,
        partnerId: m.partnerId === member.id ? undefined : m.partnerId,
        parentIds: m.parentIds?.filter((id) => id !== member.id),
      }));
    setItems(next);
    setError(null);
    setSaving(true);
    try {
      await softDeleteMember(member.id);
      await persistMembers(next);
      setDeleting(null);
    } catch (e) {
      setItems(rollback);
      setError(e instanceof Error ? e.message : "ลบสมาชิกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
    if (editing?.id === member.id) {
      setEditing(null);
      setModalOpen(false);
    }
  }

  return (
    <div
      className={`flex min-h-0 flex-col ${
        view === "canvas" ? "flex-1" : ""
      }`}
    >
      <div className="mb-5 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {familyName
              ? familyName
              : "สมาชิกครอบครัวและความสัมพันธ์"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            ข้อมูลสมาชิกใช้สำหรับระบุผู้โอน ผู้รับ รุ่น และความสัมพันธ์ทางภาษี
            {saving ? (
              <span className="ml-2 text-mint-brand">กำลังบันทึก...</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มสมาชิก
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700"
        >
          <span>{error}</span>
          <button
            type="button"
            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 font-semibold text-rose-700 transition hover:bg-rose-50"
            onClick={() => {
              setLoading(true);
              reload()
                .catch((e) =>
                  setError(
                    e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ",
                  ),
                )
                .finally(() => setLoading(false));
            }}
          >
            ลองใหม่
          </button>
        </div>
      ) : null}

      <div
        className="mb-4 inline-flex shrink-0 self-start rounded-xl border border-slate-200 bg-slate-50 p-1"
        role="tablist"
        aria-label="มุมมองสมาชิก"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "canvas"}
          onClick={() => setView("canvas")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            view === "canvas"
              ? "bg-white text-mint-brandDark shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          แผนผัง
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "table"}
          onClick={() => setView("table")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            view === "table"
              ? "bg-white text-mint-brandDark shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Table2 className="h-3.5 w-3.5" />
          ตาราง
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-16 text-center text-sm text-slate-400">
          กำลังโหลดสมาชิกจากฐานข้อมูล...
        </div>
      ) : view === "canvas" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <FamilyTree
            groups={treeByGen}
            onSelect={openEdit}
            onSwap={handleSwap}
            onLink={handleLink}
            onDelete={requestDelete}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
            <div className="relative min-w-[220px] flex-grow">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาสมาชิก..."
                className="w-full rounded-xl border border-slate-200 py-2 pr-4 pl-9 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
              />
            </div>

            <select
              value={gen}
              onChange={(e) => setGen(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
            >
              <option value="all">ทุกรุ่น</option>
              {gens.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
            >
              <option value="all">ทุกความสัมพันธ์</option>
              {relations.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  <th className="px-6 py-3">สมาชิก</th>
                  <th className="px-6 py-3">รุ่น</th>
                  <th className="px-6 py-3 text-center">อายุ</th>
                  <th className="px-6 py-3">ความสัมพันธ์</th>
                  <th className="px-6 py-3 text-center">สถานะ</th>
                  <th className="px-6 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      ไม่พบสมาชิกที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <tr
                      key={m.id}
                      className="transition-colors duration-150 hover:bg-slate-50/50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <MemberAvatar
                            seed={m.id}
                            name={m.name}
                            size={32}
                          />
                          <div>
                            <div className="font-semibold text-slate-800">
                              {m.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{m.gen}</td>
                      <td className="px-6 py-4 text-center tabular-nums text-slate-600">
                        {m.age}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{m.relation}</td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="แก้ไข"
                            onClick={() => openEdit(m)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition [outline:unset] hover:bg-sky-100 hover:text-sky-700"
                            aria-label={`แก้ไข ${m.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="ลบ"
                            onClick={() => requestDelete(m)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition [outline:unset] hover:bg-rose-100 hover:text-rose-600"
                            aria-label={`ลบ ${m.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-50 bg-slate-50/50 px-6 py-3 text-xs text-slate-500">
            <span>
              แสดงผล {filtered.length} จากทั้งหมด {items.length} คน
            </span>
          </div>
        </div>
      )}

      <AddMemberModal
        open={modalOpen}
        initial={editing}
        allMembers={items}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
      <DeleteMemberModal
        open={Boolean(deleting)}
        member={deleting}
        busy={saving}
        onClose={() => {
          if (!saving) setDeleting(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
}
