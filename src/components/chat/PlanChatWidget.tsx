"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, MessageSquarePlus, Minus, Send, Sparkles, X } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { money } from "@/lib/format";

export type ChatPlanHints = {
  cashNeeded?: number;
  giftTax?: number;
  inheritanceTax?: number;
  status?: string;
};

type ChatMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
  thinking?: boolean;
  streaming?: boolean;
};

const STARTER: ChatMessage[] = [
  {
    id: "hello",
    role: "bot",
    text: [
      "สวัสดีค่ะ นี่คือ**ผู้ช่วยแผนส่งต่อ**แบบทดลองใช้",
      "",
      "ถามเรื่องลำดับปี ภาษีการให้ มรดก หรือเงินสดที่ต้องเตรียมได้เลย",
      "",
      "> ตัวเลขเป็นประมาณการจากแผนนี้ ไม่ใช่คำวินิจฉัยทางภาษี",
    ].join("\n"),
  },
];

const SUGGESTIONS = [
  "ต้องเตรียมเงินสดเท่าไร",
  "ภาษีการให้คิดยังไง",
  "ภาษีมรดกใครเป็นผู้จ่าย",
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

function ThoughtPanel() {
  return (
    <div className="max-w-[90%] px-1 py-1" aria-live="polite">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Sparkles className="h-3 w-3 animate-pulse text-mint-brand" />
        กำลังคิด
        <ThinkingDots />
      </p>
    </div>
  );
}

function mockReply(input: string, hints?: ChatPlanHints): string {
  const q = input.trim();
  if (/เงินสด|เตรียม|cash/i.test(q)) {
    if (hints?.cashNeeded != null) {
      return [
        `จากแผนที่เปิดอยู่ เงินสดที่ต้องเตรียมประมาณ **${money(hints.cashNeeded)}**`,
        "",
        "ครอบคลุม",
        "- ภาษีการให้",
        "- ภาษีมรดก",
        "- ค่าธรรมเนียม และอากร",
        "",
        `สถานะผลคำนวณเป็น \`${hints.status ?? "Estimated"}\``,
      ].join("\n");
    }
    return "เมื่อมีรายการในแผน ระบบจะรวมภาษีและค่าธรรมเนียมเป็นยอด**เงินสดที่ต้องเตรียม**ด้านล่างของหน้านี้";
  }
  if (/ให้|gift|42/i.test(q)) {
    if (hints?.giftTax != null) {
      return [
        `ภาษีการให้ในแผนนี้ประมาณ **${money(hints.giftTax)}**`,
        "",
        "สะสมตาม **ผู้รับ + ปีภาษี**",
        "- ญาติ ตาม ม.42(27) วงเงิน 20 ลบ.",
        "- บุคคลอื่นตามเงื่อนไข ม.42(28) วงเงิน 10 ลบ.",
        "- อสังหา ม.42(26) ยกเว้น 20 ลบ./บุตรชอบด้วยกฎหมาย/ปี",
        "- ถ้าให้หลายคนหรือหลายปี ให้หารฐานตามจำนวนผู้รับและจำนวนปีก่อนคิดยกเว้น",
      ].join("\n");
    }
    return [
      "ภาษีการให้**ไม่คิดแยกรายทรัพย์** แต่รวมฐานทั้งปี",
      "",
      "- ญาติ / สังหาริมทรัพย์ — ยกเว้น 20 ลบ./ผู้รับ/ปี แล้วคูณส่วนเกิน 5%",
      "- อสังหาให้บุตรชอบด้วยกฎหมาย — ฐานหารตามจำนวนผู้รับและจำนวนปี แล้วยกเว้น 20 ลบ./คน/ปี คูณส่วนเกิน 5%",
    ].join("\n");
  }
  if (/มรดก|inherit/i.test(q)) {
    if (hints?.inheritanceTax != null) {
      return [
        `ภาษีมรดกในแผนนี้ประมาณ **${money(hints.inheritanceTax)}**`,
        "",
        "- นับแยก **ผู้รับ + เจ้ามรดก**",
        "- รวมมูลค่าทรัพย์ที่เข้าเกณฑ์ทั้งหมด แล้วหักยกเว้น 100 ลบ./คน ก่อนคูณ 5%",
        "- ทองและพระเครื่องอยู่ในบัญชีแต่ไม่เข้าฐานอัตโนมัติ",
        "- คู่สมรสยกเว้นภาษี แต่ค่าโอนอสังหายังมี",
      ].join("\n");
    }
    return [
      "ภาษีมรดกคิดต่อ**ผู้รับและเจ้ามรดก**แต่ละราย",
      "",
      "รวมทรัพย์ห้ากลุ่มทั้งก้อน หักยกเว้น 100 ลบ./คน แล้วคูณส่วนเกิน 5% (ทายาท) หรือ 10% (คนอื่น)",
    ].join("\n");
  }
  if (/ปี|timeline|ลำดับ/i.test(q)) {
    return [
      "หน้านี้เรียงตาม**ปีที่วางในแผน**",
      "",
      "แต่ละปีแยกวิธี",
      "1. ให้",
      "2. ขาย",
      "3. มรดก",
      "",
      "กดดูรายการในลำดับการดำเนินการเพื่อดูทรัพย์และผู้รับ",
    ].join("\n");
  }
  return [
    "ตอนนี้เป็นแชทดลองใช้บนหน้าแผนเท่านั้น",
    "",
    "ลองถามเรื่อง",
    "- เงินสดที่ต้องเตรียม",
    "- ภาษีการให้",
    "- ภาษีมรดก",
    "",
    "หรือเลือกคำถามด้านล่าง",
  ].join("\n");
}

const ANSWER_CHARS_PER_MS = 0.055;
const THINK_MS = 900;

type PlanChatWidgetProps = {
  hints?: ChatPlanHints;
};

export function PlanChatWidget({ hints }: PlanChatWidgetProps) {
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
    };
  }, []);

  function stopStream() {
    streamGen.current += 1;
    streamingRef.current = false;
    window.clearTimeout(timerRef.current);
    setStreaming(false);
  }

  function resetChat() {
    stopStream();
    setMessages(STARTER);
    setDraft("");
    setConfirmNewChat(false);
  }

  function patchBot(id: string, patch: Partial<ChatMessage>) {
    setMessages((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function send(text: string) {
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

    const full = mockReply(value, hints);

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

    // แสดงแค่ "กำลังคิด" สั้น ๆ แล้วขึ้นคำตอบเลย — ไม่พิมพ์ร่างแล้วลบ
    timerRef.current = window.setTimeout(() => {
      if (streamGen.current !== gen) return;
      patchBot(botId, { thinking: false, text: "", streaming: true });
      tickAnswer(performance.now());
    }, THINK_MS);
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
              <h2 id={titleId} className="text-sm font-bold">
                ผู้ช่วยแผนส่งต่อ
              </h2>
              <p className="text-[10px] text-white/70">ทดลองใช้ · ยังไม่เชื่อมโมเดล</p>
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
                  <ThoughtPanel />
                ) : (
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                    <ChatMarkdown text={msg.text} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 bg-white px-3 py-2.5">
            <div className="mb-2 flex flex-wrap gap-1">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => send(item)}
                  disabled={streaming}
                  className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-mint-brandLight hover:text-mint-brandDark disabled:opacity-40"
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
              <button
                type="submit"
                disabled={!draft.trim() || streaming}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-mint-brand text-white transition hover:bg-mint-brandDark disabled:opacity-40"
                aria-label="ส่งข้อความ"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
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
