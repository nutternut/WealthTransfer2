"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Focus, Minus, Plus, Move, X } from "lucide-react";
import type { Member } from "@/data/wealth-transfer";
import { MemberAvatar } from "@/components/members/MemberAvatar";

type FamilyTreeProps = {
  groups: { gen: string; people: Member[] }[];
  onSelect: (member: Member) => void;
  onSwap: (aId: string, bId: string) => void;
  onLink: (fromId: string, toId: string) => void;
  onDelete: (member: Member) => void;
};

type TreePath = { d: string; color: string; dashed?: boolean };

function genNumber(gen: string) {
  const m = /(\d+)/.exec(gen);
  return m ? Number(m[1]) : 0;
}

type NodePos = {
  member: Member;
  x: number;
  y: number;
  genIndex: number;
};

const NODE_W = 136;
const NODE_H = 124;
const GAP_X = 28;
const GAP_Y = 88;
const PAD = 72;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.85;
const DRAG_THRESHOLD = 6;
const MINIMAP_W = 148;
const MINIMAP_H = 100;

const genPalette = [
  {
    badge: "bg-mint-brandLight text-mint-brandDark",
    line: "#1b3a5c",
    chip: "bg-mint-brand",
  },
  {
    badge: "bg-sky-50 text-sky-700",
    line: "#0ea5e9",
    chip: "bg-sky-500",
  },
  {
    badge: "bg-teal-50 text-teal-700",
    line: "#14b8a6",
    chip: "bg-teal-500",
  },
  {
    badge: "bg-slate-50 text-slate-600",
    line: "#64748b",
    chip: "bg-slate-500",
  },
];

function layoutNodes(groups: FamilyTreeProps["groups"]) {
  const nodes: NodePos[] = [];
  let maxW = 0;

  groups.forEach((group) => {
    const rowW =
      group.people.length * NODE_W +
      Math.max(0, group.people.length - 1) * GAP_X;
    maxW = Math.max(maxW, rowW);
  });

  const contentW = Math.max(maxW, 420);

  groups.forEach((group, gi) => {
    const rowW =
      group.people.length * NODE_W +
      Math.max(0, group.people.length - 1) * GAP_X;
    const startX = PAD + (contentW - rowW) / 2;
    const y = PAD + gi * (NODE_H + GAP_Y);

    group.people.forEach((member, mi) => {
      nodes.push({
        member,
        x: startX + mi * (NODE_W + GAP_X),
        y,
        genIndex: gi,
      });
    });
  });

  const contentH =
    PAD * 2 +
    groups.length * NODE_H +
    Math.max(0, groups.length - 1) * GAP_Y;

  return {
    nodes,
    width: contentW + PAD * 2,
    height: contentH,
  };
}

function connectorPaths(nodes: NodePos[]) {
  const nodeById = new Map(nodes.map((n) => [n.member.id, n]));
  const paths: TreePath[] = [];
  const drawnPartners = new Set<string>();

  for (const n of nodes) {
    const pid = n.member.partnerId;
    if (!pid || drawnPartners.has(n.member.id)) continue;
    const partner = nodeById.get(pid);
    if (!partner || partner.genIndex !== n.genIndex) continue;
    drawnPartners.add(n.member.id);
    drawnPartners.add(pid);
    const y = n.y + NODE_H / 2;
    paths.push({
      d: `M ${n.x + NODE_W / 2} ${y} H ${partner.x + NODE_W / 2}`,
      color: "#94a3b8",
      dashed: true,
    });
  }

  for (const n of nodes) {
    const parentNodes = (n.member.parentIds ?? [])
      .map((id) => nodeById.get(id))
      .filter((p): p is NodePos => Boolean(p));
    if (parentNodes.length === 0) continue;

    const parentMidX =
      parentNodes.reduce((s, p) => s + p.x + NODE_W / 2, 0) /
      parentNodes.length;
    const parentBottom = Math.max(...parentNodes.map((p) => p.y + NODE_H));
    const childTop = n.y;
    const childMidX = n.x + NODE_W / 2;
    const midY = (parentBottom + childTop) / 2;
    const color = genPalette[n.genIndex]?.line ?? "#94a3b8";

    paths.push({
      d: `M ${parentMidX} ${parentBottom} V ${midY} H ${childMidX} V ${childTop}`,
      color,
    });
  }

  return paths;
}

export function FamilyTree({
  groups,
  onSelect,
  onSwap,
  onLink,
  onDelete,
}: FamilyTreeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const { nodes, width, height } = useMemo(
    () => layoutNodes(groups),
    [groups],
  );
  const paths = useMemo(() => connectorPaths(nodes), [nodes]);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [viewSize, setViewSize] = useState({ w: 800, h: 500 });
  const [panning, setPanning] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [linkTargetId, setLinkTargetId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [linkPreview, setLinkPreview] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [nodeDrag, setNodeDrag] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const nodeDragRef = useRef<{
    pointerId: number;
    id: string;
    genIndex: number;
    startClientX: number;
    startClientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    originX: number;
    originY: number;
    active: boolean;
  } | null>(null);

  const linkDragRef = useRef<{
    pointerId: number;
    fromId: string;
  } | null>(null);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const p = panRef.current;
    const z = zoomRef.current;
    return {
      x: (clientX - rect.left - p.x) / z,
      y: (clientY - rect.top - p.y) / z,
    };
  }, []);

  const findSwapTarget = useCallback(
    (worldX: number, worldY: number, dragId: string, genIndex: number) => {
      const cx = worldX;
      const cy = worldY;
      for (const n of nodes) {
        if (n.member.id === dragId) continue;
        if (n.genIndex !== genIndex) continue;
        if (
          cx >= n.x &&
          cx <= n.x + NODE_W &&
          cy >= n.y &&
          cy <= n.y + NODE_H
        ) {
          return n.member.id;
        }
      }
      return null;
    },
    [nodes],
  );

  const findLinkTarget = useCallback(
    (fromId: string, worldX: number, worldY: number) => {
      const from = nodes.find((n) => n.member.id === fromId);
      if (!from) return null;
      const fromGen = genNumber(from.member.gen);

      for (const n of nodes) {
        if (n.member.id === fromId) continue;
        if (
          worldX < n.x ||
          worldX > n.x + NODE_W ||
          worldY < n.y ||
          worldY > n.y + NODE_H
        ) {
          continue;
        }
        const toGen = genNumber(n.member.gen);
        if (fromGen === toGen) return n.member.id;
        if (Math.abs(fromGen - toGen) === 1) return n.member.id;
      }
      return null;
    },
    [nodes],
  );

  const fitView = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    setViewSize({ w: vw, h: vh });
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((vw - 48) / width, (vh - 32) / height) * 0.92),
    );
    setZoom(nextZoom);
    setPan({
      x: (vw - width * nextZoom) / 2,
      y: (vh - height * nextZoom) / 2,
    });
  }, [width, height]);

  useEffect(() => {
    fitView();
  }, [fitView]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setViewSize({ w: el.clientWidth, h: el.clientHeight });
    });
    setViewSize({ w: el.clientWidth, h: el.clientHeight });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setZoom((z) => {
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta));
        setPan((p) => {
          const wx = (mx - p.x) / z;
          const wy = (my - p.y) / z;
          return { x: mx - wx * next, y: my - wy * next };
        });
        return next;
      });
    };
    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", onNativeWheel);
  }, []);

  function onViewportPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-node]") || target.closest("[data-minimap]")) return;

    panDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
  }

  function onViewportPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const panDrag = panDragRef.current;
    if (panDrag && panDrag.pointerId === e.pointerId) {
      setPan({
        x: panDrag.originX + (e.clientX - panDrag.startX),
        y: panDrag.originY + (e.clientY - panDrag.startY),
      });
      return;
    }

    const linkDrag = linkDragRef.current;
    if (linkDrag && linkDrag.pointerId === e.pointerId) {
      const world = clientToWorld(e.clientX, e.clientY);
      setLinkPreview({ x: world.x, y: world.y });
      setLinkTargetId(findLinkTarget(linkDrag.fromId, world.x, world.y));
      return;
    }

    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.active && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.active = true;
    }
    if (!drag.active) return;

    const world = clientToWorld(e.clientX, e.clientY);
    const x = world.x - drag.grabOffsetX;
    const y = world.y - drag.grabOffsetY;
    setNodeDrag({ id: drag.id, x, y });

    const target = findSwapTarget(
      world.x,
      world.y,
      drag.id,
      drag.genIndex,
    );
    setDropTargetId(target);
  }

  function endNodeDrag(e: { pointerId: number; clientX: number; clientY: number }) {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const wasActive = drag.active;
    const member = nodes.find((n) => n.member.id === drag.id)?.member;
    let targetId: string | null = null;

    if (wasActive) {
      const world = clientToWorld(e.clientX, e.clientY);
      targetId = findSwapTarget(world.x, world.y, drag.id, drag.genIndex);
    }

    nodeDragRef.current = null;
    setNodeDrag(null);
    setDropTargetId(null);

    if (wasActive && targetId) {
      onSwap(drag.id, targetId);
      return;
    }
    if (!wasActive && member) {
      onSelect(member);
    }
  }

  function endLinkDrag(e: { pointerId: number; clientX: number; clientY: number }) {
    const linkDrag = linkDragRef.current;
    if (!linkDrag || linkDrag.pointerId !== e.pointerId) return;
    const world = clientToWorld(e.clientX, e.clientY);
    const targetId = findLinkTarget(linkDrag.fromId, world.x, world.y);
    linkDragRef.current = null;
    setLinkFrom(null);
    setLinkPreview(null);
    setLinkTargetId(null);
    if (targetId) onLink(linkDrag.fromId, targetId);
  }

  function onViewportPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const panDrag = panDragRef.current;
    if (panDrag && panDrag.pointerId === e.pointerId) {
      panDragRef.current = null;
      setPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    endLinkDrag(e);
    endNodeDrag(e);
  }

  function onNodePointerDown(
    e: ReactPointerEvent<HTMLButtonElement>,
    node: NodePos,
  ) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-node-action]")) return;
    e.stopPropagation();

    if (e.shiftKey) {
      linkDragRef.current = {
        pointerId: e.pointerId,
        fromId: node.member.id,
      };
      setLinkFrom({
        id: node.member.id,
        x: node.x + NODE_W / 2,
        y: node.y + NODE_H / 2,
      });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const world = clientToWorld(e.clientX, e.clientY);
    nodeDragRef.current = {
      pointerId: e.pointerId,
      id: node.member.id,
      genIndex: node.genIndex,
      startClientX: e.clientX,
      startClientY: e.clientY,
      grabOffsetX: world.x - node.x,
      grabOffsetY: world.y - node.y,
      originX: node.x,
      originY: node.y,
      active: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onNodePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    onViewportPointerMove(e as unknown as ReactPointerEvent<HTMLDivElement>);
  }

  function onNodePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    endLinkDrag(e);
    endNodeDrag(e);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  function bumpZoom(factor: number) {
    const el = viewportRef.current;
    if (!el) return;
    const mx = el.clientWidth / 2;
    const my = el.clientHeight / 2;
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
      setPan((p) => {
        const wx = (mx - p.x) / z;
        const wy = (my - p.y) / z;
        return { x: mx - wx * next, y: my - wy * next };
      });
      return next;
    });
  }

  const draggingNode = Boolean(nodeDrag);

  const minimapScale = Math.min(
    (MINIMAP_W - 16) / Math.max(width, 1),
    (MINIMAP_H - 16) / Math.max(height, 1),
  );
  const mapPadX = (MINIMAP_W - width * minimapScale) / 2;
  const mapPadY = (MINIMAP_H - height * minimapScale) / 2;
  const viewWorld = {
    x: -pan.x / zoom,
    y: -pan.y / zoom,
    w: viewSize.w / zoom,
    h: viewSize.h / zoom,
  };

  function panToWorld(wx: number, wy: number) {
    setPan({
      x: viewSize.w / 2 - wx * zoom,
      y: viewSize.h / 2 - wy * zoom,
    });
  }

  function onMinimapPointer(
    e: ReactPointerEvent<HTMLDivElement>,
    capture = false,
  ) {
    e.stopPropagation();
    if (e.button !== 0 && e.type === "pointerdown") return;
    const el = e.currentTarget;
    if (capture && e.type === "pointerdown") {
      el.setPointerCapture(e.pointerId);
    }
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - mapPadX) / minimapScale;
    const wy = (my - mapPadY) / minimapScale;
    panToWorld(wx, wy);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6">
        <div>
          <h2 className="text-sm font-bold text-slate-800">แผนผังครอบครัว</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Move className="h-3 w-3" />
            Shift+ลาก เชื่อมพ่อแม่/คู่สมรส · ลากสลับตำแหน่ง · ลากพื้นเลื่อน
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {groups.map((g, i) => (
            <span
              key={g.gen}
              className="hidden items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500 sm:inline-flex"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${genPalette[i]?.chip ?? "bg-slate-400"}`}
              />
              {g.gen}
              <span className="tabular-nums text-slate-400">
                {g.people.length}
              </span>
            </span>
          ))}

          <div className="ml-1 flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => bumpZoom(0.9)}
              className="grid h-8 w-8 place-items-center text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              aria-label="ซูมออก"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-11 border-x border-slate-100 px-1 text-center text-[10px] font-semibold tabular-nums text-slate-500">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => bumpZoom(1.1)}
              className="grid h-8 w-8 place-items-center text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              aria-label="ซูมเข้า"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={fitView}
              className="grid h-8 w-8 place-items-center border-l border-slate-100 text-slate-500 transition hover:bg-slate-50 hover:text-mint-brand"
              aria-label="จัดให้อยู่กลาง"
              title="จัดให้อยู่กลาง"
            >
              <Focus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden ${
          draggingNode
            ? "cursor-grabbing"
            : panning
              ? "cursor-grabbing"
              : "cursor-grab"
        }`}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,_#e8eef6_0%,_transparent_50%),radial-gradient(ellipse_at_90%_100%,_#e0f2fe_0%,_transparent_45%)]"
        />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)",
            backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        <div
          className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{
            width,
            height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={width}
            height={height}
          >
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={p.dashed ? "5 4" : undefined}
                opacity={p.dashed ? 0.7 : 0.55}
              />
            ))}
            {linkFrom && linkPreview && (
              <line
                x1={linkFrom.x}
                y1={linkFrom.y}
                x2={linkPreview.x}
                y2={linkPreview.y}
                stroke="#1b3a5c"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
            )}
          </svg>

          {groups.map((group, gi) => {
            const rowNodes = nodes.filter((n) => n.genIndex === gi);
            if (rowNodes.length === 0) return null;
            const labelX =
              rowNodes.reduce((s, n) => s + n.x + NODE_W / 2, 0) /
              rowNodes.length;
            return (
              <div
                key={group.gen}
                className="pointer-events-none absolute -translate-x-1/2"
                style={{ left: labelX, top: rowNodes[0].y - 28 }}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm backdrop-blur">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${genPalette[gi]?.chip ?? "bg-slate-400"}`}
                  />
                  {group.gen}
                </span>
              </div>
            );
          })}

          {nodes.map((node) => {
            const { member: m, x, y, genIndex } = node;
            const palette = genPalette[genIndex] ?? genPalette[3];
            const isPrimary = m.relation === "เจ้าของหลัก";
            const isDragging = nodeDrag?.id === m.id;
            const isDropTarget = dropTargetId === m.id;
            const isLinkTarget = linkTargetId === m.id;
            const left = isDragging && nodeDrag ? nodeDrag.x : x;
            const top = isDragging && nodeDrag ? nodeDrag.y : y;

            return (
              <button
                key={m.id}
                type="button"
                data-node
                onPointerDown={(e) => onNodePointerDown(e, node)}
                onPointerMove={onNodePointerMove}
                onPointerUp={onNodePointerUp}
                onPointerCancel={onNodePointerUp}
                onClick={(e) => e.preventDefault()}
                className={`group absolute flex flex-col items-center rounded-2xl border bg-white/95 p-3 text-center shadow-[0_10px_28px_-14px_rgba(15,23,42,0.28)] backdrop-blur focus-visible:ring-2 focus-visible:ring-mint-brand focus-visible:outline-none ${
                  isDragging
                    ? "z-20 cursor-grabbing shadow-[0_20px_40px_-12px_rgba(27,58,92,0.45)] ring-2 ring-mint-brand/40"
                    : isDropTarget || isLinkTarget
                      ? "z-10 scale-[1.03] border-mint-brand ring-2 ring-mint-200"
                      : isPrimary
                        ? "border-mint-brand/45 ring-2 ring-mint-100 hover:-translate-y-0.5"
                        : "border-slate-100 hover:-translate-y-0.5 hover:border-mint-200"
                } ${isDragging ? "" : "transition duration-150"}`}
                style={{
                  left,
                  top,
                  width: NODE_W,
                  height: NODE_H,
                  opacity: isDragging ? 0.92 : 1,
                }}
              >
                {isPrimary && (
                  <span className="absolute -top-2 rounded-full bg-mint-brand px-1.5 py-px text-[8px] font-bold text-white shadow-sm">
                    หลัก
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`ลบ ${m.name}`}
                  data-node-action
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete(m);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      onDelete(m);
                    }
                  }}
                  className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-lg bg-rose-50 text-rose-400 opacity-0 transition hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
                <MemberAvatar
                  seed={m.id}
                  name={m.name}
                  size={36}
                  className="mb-2 shadow-md ring-2 ring-white"
                />
                <div className="w-full truncate text-[12px] leading-relaxed font-bold text-slate-800">
                  {m.name}
                </div>
                <div className="mt-0.5 text-[10px] leading-snug tabular-nums text-slate-400">
                  {m.age} ปี
                </div>
                <span
                  className={`mt-auto rounded-full px-2 py-0.5 text-[9px] font-semibold ${palette.badge}`}
                >
                  {m.relation}
                </span>
              </button>
            );
          })}
        </div>

        <div
          data-minimap
          role="navigation"
          aria-label="แผนที่ย่อ"
          className="absolute right-3 bottom-3 z-30 overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 shadow-[0_8px_24px_-10px_rgba(15,23,42,0.35)] backdrop-blur-md"
          style={{ width: MINIMAP_W, height: MINIMAP_H }}
          onPointerDown={(e) => onMinimapPointer(e, true)}
          onPointerMove={(e) => {
            if (e.buttons !== 1) return;
            onMinimapPointer(e);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* already released */
            }
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#e8eef6_0%,_transparent_55%)]"
          />
          <svg
            width={MINIMAP_W}
            height={MINIMAP_H}
            className="relative block"
          >
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={1.5 / Math.max(minimapScale, 0.01)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.4}
                transform={`translate(${mapPadX} ${mapPadY}) scale(${minimapScale})`}
              />
            ))}
            {nodes.map((n) => {
              const color =
                genPalette[n.genIndex]?.line ?? "#94a3b8";
              return (
                <rect
                  key={n.member.id}
                  x={mapPadX + n.x * minimapScale}
                  y={mapPadY + n.y * minimapScale}
                  width={NODE_W * minimapScale}
                  height={NODE_H * minimapScale}
                  rx={2}
                  fill={color}
                  opacity={0.85}
                />
              );
            })}
            <rect
              x={mapPadX + viewWorld.x * minimapScale}
              y={mapPadY + viewWorld.y * minimapScale}
              width={Math.max(10, viewWorld.w * minimapScale)}
              height={Math.max(8, viewWorld.h * minimapScale)}
              fill="rgba(27,58,92,0.12)"
              stroke="#1b3a5c"
              strokeWidth={1.5}
              rx={2}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
