"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type AutocompleteOption = {
  value: string;
  label: string;
  hint?: string;
};

type AutocompleteProps = {
  id?: string;
  value: string;
  options: AutocompleteOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  /** อนุญาตพิมพ์ชื่อที่ไม่อยู่ในรายการ (เช่น คนนอก) */
  allowFreeform?: boolean;
  /** คำอธิบายตอนเลือกชื่อที่พิมพ์เอง */
  freeformHint?: string;
  className?: string;
};

type MenuCoords = {
  top: number;
  left: number;
  width: number;
};

export function Autocomplete({
  id,
  value,
  options,
  onChange,
  placeholder = "พิมพ์เพื่อค้นหา...",
  emptyText = "ไม่พบรายการ",
  allowFreeform = false,
  freeformHint = "คนนอก · พิมพ์เอง",
  className = "",
}: AutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  function setQueryBoth(next: string) {
    queryRef.current = next;
    setQuery(next);
  }

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value || "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const trimmedQuery = query.trim();
  const exactMatch = options.some(
    (o) =>
      o.value.toLowerCase() === trimmedQuery.toLowerCase() ||
      o.label.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCreate =
    allowFreeform && trimmedQuery.length > 0 && !exactMatch;

  const menuItems = useMemo(() => {
    if (!showCreate) return filtered;
    return [
      ...filtered,
      {
        value: trimmedQuery,
        label: trimmedQuery,
        hint: freeformHint,
        create: true as const,
      },
    ];
  }, [filtered, showCreate, trimmedQuery, freeformHint]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    function updateCoords() {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({
        top: r.bottom + 6,
        left: r.left,
        width: r.width,
      });
    }

    updateCoords();
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords, true);
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open, menuItems.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      if (allowFreeform) {
        const q = queryRef.current.trim();
        if (q) onChange(q);
      }
      setOpen(false);
      setQueryBoth("");
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, allowFreeform, onChange]);

  function openMenu() {
    setOpen(true);
    setQueryBoth(value && !selected ? value : "");
    setHighlight(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQueryBoth("");
    setHighlight(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) =>
        Math.min(h + 1, Math.max(0, menuItems.length - 1)),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = menuItems[highlight];
      if (item) {
        pick(item.value);
      } else if (allowFreeform && trimmedQuery) {
        pick(trimmedQuery);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQueryBoth("");
      setHighlight(0);
    }
  }

  const menu =
    open && coords && mounted
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
            className="z-[80] max-h-56 overflow-auto rounded-xl border border-slate-100 bg-white py-1.5 shadow-lg shadow-slate-200/60 animate-[fadeUp_0.15s_ease]"
          >
            {menuItems.length === 0 ? (
              <li className="px-3.5 py-3 text-xs text-slate-400">
                {allowFreeform
                  ? "พิมพ์ชื่อแล้วกด Enter เพื่อใช้ชื่อนี้"
                  : emptyText}
              </li>
            ) : (
              menuItems.map((o, i) => {
                const active = o.value === value;
                const focused = i === highlight;
                const isCreate = "create" in o && o.create;
                return (
                  <li key={`${o.value}-${isCreate ? "new" : "opt"}`} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs transition ${
                        focused ? "bg-mint-brandLight" : "hover:bg-slate-50"
                      }`}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pick(o.value)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-800">
                          {isCreate ? `ใช้ “${o.label}”` : o.label}
                        </span>
                        {o.hint ? (
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            {o.hint}
                          </span>
                        ) : null}
                      </span>
                      {active && !isCreate ? (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-mint-brand"
                          strokeWidth={3}
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {!open ? (
        <button
          type="button"
          id={id}
          onClick={openMenu}
          className="flex w-full items-center gap-2 rounded-xl border border-mint-200/80 bg-white px-3.5 py-2.5 text-left text-xs text-slate-700 shadow-sm transition hover:border-mint-brand focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          aria-haspopup="listbox"
          aria-expanded={false}
        >
          <span
            className={`min-w-0 flex-1 truncate font-medium ${
              displayLabel ? "text-slate-700" : "text-slate-400"
            }`}
          >
            {displayLabel || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-mint-brand bg-white px-3 py-1.5 shadow-sm ring-2 ring-mint-200">
          <Search className="h-3.5 w-3.5 shrink-0 text-mint-brand" />
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400"
            value={query}
            placeholder={displayLabel || placeholder}
            onChange={(e) => {
              setQueryBoth(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
          />
          {query ? (
            <button
              type="button"
              aria-label="ล้าง"
              className="rounded-md p-0.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={() => setQueryBoth("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="ปิด"
              className="rounded-md p-0.5 text-slate-400 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                setQueryBoth("");
              }}
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>
      )}

      {menu}
    </div>
  );
}
