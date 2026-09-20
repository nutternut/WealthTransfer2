"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, MessageSquarePlus, Minus, Send, Sparkles, Square, X } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
  thinking?: boolean;
  streaming?: boolean;
  /** มาตราที่คำตอบนี้อ้าง — มาจากบริการ ไม่ใช่จากการอ่านข้อความ */
  anchors?: string[];
  /** วันที่ดึงตัวบท: กฎภาษีไทยแก้ทุกปี คำตอบที่ไม่บอกวินเทจใช้งานไม่ได้ */
  fetchedAt?: string[];
  /** บริการปฏิเสธเพราะตัวบทในคลังตอบไม่ได้ — ไม่ใช่ข้อผิดพลาด */
  refused?: boolean;
  /** เรียกบริการไม่สำเร็จ */
  error?: boolean;
  /** ขั้นตอนที่บริการรายงานระหว่างคิด — เก็บไว้หลังตอบเสร็จด้วย เพราะมันคือ
   *  หลักฐานว่าคำตอบมาจากการค้นตัวบท ไม่ใช่การเดา */
  steps?: string[];
};

const STARTER: ChatMessage[] = [
  {
    id: "hello",
    role: "bot",
    text: [
      "สวัสดีค่ะ นี่คือ **FAMZ**",
      "",
      "ถามเรื่องภาษีการรับมรดก การให้ หรือการขายอสังหาฯ ได้เลย คำตอบจะยกตัวบทและบอกเลขมาตราให้",
    ].join("\n"),
  },
];

const SUGGESTIONS = [
  "แม่โอนที่ดินให้ลูกโดยเสน่หา เสียภาษีไหม",
  "ได้รับมรดก 150 ล้าน เสียภาษีเท่าไร",
  "ภาษีการรับมรดกใครเป็นผู้มีหน้าที่เสีย",
];

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  img: ({ alt }) => <span>{alt ?? ""}</span>,
};

function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-md text-[12px] leading-relaxed text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text || " "}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="chat-think-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-1 space-y-0.5">
      {steps.map((step, i) => (
        <li key={`${i}-${step}`} className="flex gap-1.5 text-[10px] text-slate-500">
          <span className="text-slate-300">{i + 1}.</span>
          <span className="break-all">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ThoughtPanel({ steps }: { steps?: string[] }) {
  return (
    <div className="max-w-[90%] px-1 py-1" aria-live="polite">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Sparkles className="h-3 w-3 animate-pulse text-mint-brand" />
        {steps?.length ? "กำลังทำงาน" : "กำลังค้นตัวบท"}
        <ThinkingDots />
      </p>
      {steps?.length ? <StepList steps={steps} /> : null}
    </div>
  );
}


// 0.055 (55 ตัว/วิ) จูนไว้กับคำตอบ mock สั้น ๆ ของจริงวัดได้ ~1,300 ตัวอักษร
// ซึ่งจะใช้เวลาพิมพ์ 24 วินาที ต่อท้ายการรอคำตอบอีก ~31 วินาที
const ANSWER_CHARS_PER_MS = 0.35;

/** uuid ของห้องแชท = thread_id ฝั่งบริการ ไม่ใช่การล็อกอิน คงอยู่ข้าม reload */
const SESSION_KEY = "wt_ask_session";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** event ที่บริการส่งมา -> บรรทัดเดียวที่คนอ่านได้ ไม่รู้จักก็ข้าม */
function stepLabel(event: {
  type: string;
  calls?: { name: string; args?: Record<string, unknown>; label?: string }[];
}): string | null {
  if (event.type === "retry") {
    return "ข้อความที่ยกมาไม่ตรงตัวบท กำลังอ่านมาตราใหม่";
  }
  if (event.type !== "tool" || !event.calls?.length) return null;
  const parts = event.calls.map((call) => {
    const args = call.args ?? {};
    switch (call.name) {
      case "search_law":
        return `ค้นตัวบท: ${String(args.question ?? "").slice(0, 40)}`;
      case "read_section":
        // engine ส่ง label เป็นชื่อกฎหมาย + มาตรา มาให้; ไม่มีก็โชว์ anchor ดิบ
        return `อ่าน ${call.label ?? String(args.anchor ?? "")}`;
      case "gaps":
        return "ตรวจว่ากฎหมายฉบับนั้นอยู่ในคลังหรือไม่";
      case "tax_inheritance":
        return "คำนวณภาษีการรับมรดก";
      case "exempt_gift":
        return "คำนวณเพดานยกเว้นการให้";
      default:
        return call.name;
    }
  });
  return parts.join(" · ");
}

/** โชว์รายการ "มาตราที่อ้าง" กับ "ข้อมูล ณ" ใต้คำตอบหรือไม่ — ปิดไว้ตามที่ขอให้เห็นแค่คำตอบ
 *  ข้อมูลยังมาครบใน state (anchors / fetchedAt) และยังอยู่ใน audit ของ engine เปิดกลับได้บรรทัดเดียว */
const SHOW_CITATIONS: boolean = false;

/** anchor ของคลัง: doc-id#m42, doc-id#m41ทวิ, doc-id#k2.32, doc-id#m91/2 หรือ doc-id เฉย ๆ
 *  ทุก doc-id มีขีดเสมอ (rd-revenue-code, dol-fees-taxes-duties) จึงบังคับให้มีขีดอย่างน้อยหนึ่ง
 *  แล้วจะไม่กิน (27) ใน "มาตรา 42 (27)", "ร้อยละ 0.5" หรือคำอังกฤษคำเดียวที่ไม่มีขีด */
const ANCHOR = String.raw`[a-z][a-z0-9]*(?:-[a-z0-9]+)+(?:#[^\s(),;»]+)?`;
/** anchor ที่ไหนก็ตาม: ในวงเล็บ (rd-revenue-code#m42), โดด ๆ ท้ายคำพูด «...» rd-revenue-code#m42,
 *  หรือหลายตัวคั่นด้วย , ; · — โมเดลต่างตัวพ่นคนละแบบ จึงตัดทุกแบบ */
const INLINE_CITE = new RegExp(
  String.raw`[ \t]*\((?:อ้างอิง\s*:?\s*)?${ANCHOR}(?:\s*[,;·]\s*${ANCHOR})*\)`,
  "g",
);
const BARE_CITE = new RegExp(
  String.raw`[ \t]*${ANCHOR}(?:\s*[,;·]\s*${ANCHOR})*`,
  "g",
);
/** บรรทัด "อ้างอิง: ..." ท้ายคำตอบ ทั้งบรรทัด (รวมแบบตัวหนา **อ้างอิง:**) */
const CITE_LINE = /^[ \t]*\**อ้างอิง\**\s*:.*$/gm;

/** ตัดการอ้างอิงออกจากข้อความก่อนแสดง — ตัวตรวจของ engine ตรวจข้อความเต็ม (พร้อม anchor)
 *  ไปแล้วก่อนถึงตรงนี้ และ audit/Langfuse ยังเก็บข้อความเต็มไว้ครบ */
function forDisplay(text: string): string {
  return text
    .replace(CITE_LINE, "")
    .replace(INLINE_CITE, "")
    .replace(BARE_CITE, "")
    .replace(/[ \t]+(?=[,.;:)»])/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function newSessionId(): string {
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    // โหมดส่วนตัว / ปิด site data — แค่ทำให้ห้องแชทไม่ข้าม reload
  }
  return id;
}

function loadSessionId(): string {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved && UUID_RE.test(saved)) return saved;
  } catch {
    // อ่านไม่ได้ก็สร้างใหม่
  }
  return newSessionId();
}

export function PlanChatWidget() {
  const titleId = useId();
  const confirmTitleId = useId();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [confirmNewChat, setConfirmNewChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamGen = useRef(0);
  const streamingRef = useRef(false);
  const timerRef = useRef(0);
  const sessionIdRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  // localStorage / crypto มีแต่ในเบราว์เซอร์ จึงอ่านใน effect ไม่ใช่ตอน render
  useEffect(() => {
    if (!sessionIdRef.current) sessionIdRef.current = loadSessionId();
  }, []);

  useEffect(() => {
    if (!open) return;
    setUnread(false);
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    if (!streaming) inputRef.current?.focus();
  }, [open, messages, streaming]);

  useEffect(() => {
    return () => {
      streamGen.current += 1;
      window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function stopStream() {
    streamGen.current += 1;
    streamingRef.current = false;
    window.clearTimeout(timerRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  function resetChat() {
    stopStream();
    // ห้องใหม่ = thread ใหม่ฝั่งบริการ ไม่งั้นบริบทเก่ายังตามมา
    sessionIdRef.current = newSessionId();
    setMessages(STARTER);
    setDraft("");
    setConfirmNewChat(false);
  }

  function patchBot(id: string, patch: Partial<ChatMessage>) {
    setMessages((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function send(text: string) {
    const value = text.trim();
    if (!value || streamingRef.current) return;
    const gen = ++streamGen.current;
    const botId = `b-${Date.now()}`;
    streamingRef.current = true;
    setMessages((rows) => [
      ...rows,
      { id: `u-${Date.now()}`, role: "user", text: value },
      {
        id: botId,
        role: "bot",
        text: "",
        thinking: true,
      },
    ]);
    setDraft("");
    setStreaming(true);

    const sessionId = sessionIdRef.current || (sessionIdRef.current = loadSessionId());
    const controller = new AbortController();
    abortRef.current = controller;

    let full = "";
    let meta: Partial<ChatMessage> = {};
    const steps: string[] = [];
    try {
      const res = await fetch("/api/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        // ส่งแค่สองฟิลด์ตามสัญญาของบริการ — ตัวเลขแผนของลูกค้าไม่ออกไป (PDPA)
        body: JSON.stringify({ sessionId, question: value }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // 400 จาก route handler (uuid/คำถามว่าง) หรือ 401 จาก proxy ยังเป็น JSON
        const data = await res.json().catch(() => null);
        full = data?.error?.message ?? "ตอบไม่สำเร็จ กรุณาลองใหม่";
        meta = { error: true };
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        while (!done) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          // SSE คั่น event ด้วยบรรทัดว่าง — เก็บเศษท้ายไว้รอบถัดไป
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const line = block
              .split("\n")
              .find((row) => row.startsWith("data: "));
            if (!line) continue;
            let event: {
              type: string;
              answer?: string;
              anchors?: string[];
              fetched_at?: string[];
              refused?: boolean;
              message?: string;
              calls?: { name: string; args?: Record<string, unknown>; label?: string }[];
            };
            try {
              event = JSON.parse(line.slice("data: ".length));
            } catch {
              continue;
            }
            if (streamGen.current !== gen) return;
            if (event.type === "answer") {
              full = forDisplay(event.answer ?? "");
              meta = {
                anchors: event.anchors ?? [],
                fetchedAt: event.fetched_at ?? [],
                refused: Boolean(event.refused),
              };
              done = true;
              break;
            }
            if (event.type === "error") {
              full = event.message ?? "ระบบตอบคำถามไม่สำเร็จ";
              meta = { error: true };
              done = true;
              break;
            }
            const label = stepLabel(event);
            if (label) {
              steps.push(label);
              patchBot(botId, { steps: [...steps] });
            }
          }
        }
        reader.cancel().catch(() => {});
        if (!full && !meta.error) {
          // สตรีมจบโดยไม่มี answer — บริการตายกลางทาง
          full = "การตอบถูกตัดกลางทาง กรุณาลองใหม่";
          meta = { error: true };
        }
      }
    } catch {
      // ถูกกดหยุด / unmount: gen เปลี่ยนแล้ว ไม่ต้องเขียนอะไรลง state
      if (streamGen.current !== gen) return;
      full = "ติดต่อผู้ช่วยไม่ได้ กรุณาลองใหม่";
      meta = { error: true };
    }

    if (streamGen.current !== gen) return;
    abortRef.current = null;

    const tickAnswer = (startedAt: number) => {
      if (streamGen.current !== gen) return;
      const elapsed = Math.max(0, performance.now() - startedAt);
      const index = Math.min(full.length, Math.ceil(elapsed * ANSWER_CHARS_PER_MS));
      const done = index >= full.length;
      patchBot(botId, {
        text: full.slice(0, index),
        streaming: !done,
        thinking: false,
      });
      if (done) {
        streamingRef.current = false;
        setStreaming(false);
        return;
      }
      timerRef.current = window.setTimeout(() => tickAnswer(startedAt), 30);
    };

    // มาตราขึ้นพร้อมคำตอบตั้งแต่ต้น ไม่ต้องรอพิมพ์จบ
    patchBot(botId, { thinking: false, text: "", streaming: true,
                      steps: steps.length ? [...steps] : undefined, ...meta });
    // อ่านเวลาใน callback ไม่ใช่ในตัวฟังก์ชัน — react-hooks/purity มองว่าการเรียก
    // performance.now() ในตัว component เป็นการเรียกตอน render (รูปแบบเดียวกับโค้ดเดิม)
    timerRef.current = window.setTimeout(() => {
      if (streamGen.current !== gen) return;
      tickAnswer(performance.now());
    }, 0);
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end sm:right-6 sm:bottom-6">
      {open ? (
        <section
          className="pointer-events-auto relative mb-3 flex h-[min(34rem,calc(100vh-7rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15"
          role="dialog"
          aria-labelledby={titleId}
          aria-modal="false"
        >
          <header className="flex items-center gap-3 bg-linear-to-r from-mint-brand to-mint-brandDark px-3.5 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-sm font-bold tracking-wide">
                FAMZ
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setConfirmNewChat(true)}
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="สร้างแชทใหม่"
              title="สร้างแชทใหม่"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmNewChat(false);
                setOpen(false);
              }}
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="ย่อหน้าต่างแชท"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmNewChat(false);
                setOpen(false);
              }}
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="ปิดแชท"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {confirmNewChat ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby={confirmTitleId}
            >
              <div className="w-full max-w-[16.5rem] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-mint-brandLight text-mint-brandDark">
                  <MessageSquarePlus className="h-5 w-5" />
                </div>
                <h3 id={confirmTitleId} className="text-sm font-bold text-slate-800">
                  เริ่มแชทใหม่?
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                  ประวัติข้อความตอนนี้จะถูกล้าง และกลับไปหน้าเริ่มต้น
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmNewChat(false)}
                    className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={resetChat}
                    className="flex-1 rounded-xl bg-mint-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-mint-brandDark"
                  >
                    เริ่มใหม่
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-mint-brand px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-white">
                    {msg.text}
                  </p>
                ) : msg.thinking ? (
                  <ThoughtPanel steps={msg.steps} />
                ) : (
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                    {msg.steps?.length ? (
                      <details className="mb-1.5">
                        <summary className="cursor-pointer text-[10px] font-semibold text-slate-400">
                          ขั้นตอนที่ใช้ ({msg.steps.length})
                        </summary>
                        <StepList steps={msg.steps} />
                      </details>
                    ) : null}
                    <ChatMarkdown text={msg.text} />
                    {msg.error ? (
                      <p className="mt-1.5 text-[10px] font-semibold text-red-600">
                        เรียกผู้ช่วยไม่สำเร็จ
                      </p>
                    ) : null}
                    {SHOW_CITATIONS && msg.anchors?.length ? (
                      <div className="mt-2 border-t border-slate-100 pt-1.5">
                        <p className="text-[10px] font-semibold text-slate-400">
                          มาตราที่อ้าง
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {msg.anchors.map((anchor) => (
                            <li
                              key={anchor}
                              className="font-mono text-[10px] break-all text-slate-500"
                            >
                              {anchor}
                            </li>
                          ))}
                        </ul>
                        {msg.fetchedAt?.length ? (
                          <p className="mt-1 text-[10px] text-slate-400">
                            ข้อมูล ณ{" "}
                            {msg.fetchedAt
                              .map((stamp) => stamp.slice(0, 10))
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    ) : msg.refused && !msg.streaming ? (
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        ไม่มีตัวบทในคลังที่ตอบคำถามนี้ได้
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 bg-white px-3 py-2.5">
            <div className="chat-suggest-row mb-2 flex flex-nowrap gap-1 overflow-x-auto">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => send(item)}
                  disabled={streaming}
                  className="shrink-0 snap-start rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium whitespace-nowrap text-slate-600 ring-1 ring-slate-200 transition hover:bg-mint-brandLight hover:text-mint-brandDark disabled:opacity-40"
                >
                  {item}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                send(draft);
              }}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="พิมพ์คำถาม..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-mint-brand focus:bg-white"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stopStream}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-200 text-slate-600 transition hover:bg-slate-300"
                  aria-label="หยุดรอคำตอบ"
                  title="หยุด"
                >
                  <Square className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-mint-brand text-white transition hover:bg-mint-brandDark disabled:opacity-40"
                  aria-label="ส่งข้อความ"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </form>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto relative ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint-brand text-white shadow-lg shadow-mint-brand/30 transition hover:bg-mint-brandDark"
        aria-label={open ? "ปิดแชทผู้ช่วย" : "เปิดแชทผู้ช่วย"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && unread ? (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-orange-500 ring-2 ring-white" />
        ) : null}
      </button>
    </div>
  );
}
