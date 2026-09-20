/**
 * Proxy ไปยังบริการตอบคำถามกฎหมาย (wealth-agent) แบบ same-origin
 *
 * เหตุผลที่ต้องผ่านเซิร์ฟเวอร์ ไม่ยิงตรงจากเบราว์เซอร์:
 *  1. ASK_API_KEY ต้องไม่หลุดไปฝั่ง client (ห้ามใช้ชื่อ NEXT_PUBLIC_*)
 *  2. เบราว์เซอร์ยิงเข้า origin ตัวเอง จึงไม่ต้องตั้ง CORS ที่ฝั่งบริการ
 * แนวคิดเดียวกับ proxy /supabase ใน next.config.ts
 *
 * สัญญากับฝั่งบริการแคบมากโดยเจตนา: ส่งได้แค่ session_id + question
 * ฟิลด์เกินจะถูกปฏิเสธด้วย 422 เพื่อกันมูลค่าทรัพย์สินลูกค้าเข้า transcript (PDPA)
 */

const ASK_URL = (process.env.ASK_URL ?? "http://127.0.0.1:8000").trim().replace(/\/$/, "");
const ASK_API_KEY = (process.env.ASK_API_KEY ?? "").trim();

/** ยาวกว่า ask_timeout_s ของบริการ (120s) เพื่อให้บริการเป็นฝ่ายตัดเอง */
const TIMEOUT_MS = 150_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json", "อ่านคำขอไม่ได้");
  }

  const { sessionId, question } = (body ?? {}) as {
    sessionId?: unknown;
    question?: unknown;
  };

  // ตรวจที่นี่ด้วย เพื่อไม่ต้องเสียเวลาไปกลับกับบริการเมื่อคำขอผิดรูปชัดเจน
  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
    return fail(400, "invalid_session", "session_id ต้องเป็น UUID");
  }
  if (typeof question !== "string" || !question.trim()) {
    return fail(400, "empty_question", "กรุณาพิมพ์คำถาม");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${ASK_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ASK_API_KEY ? { "X-Api-Key": ASK_API_KEY } : {}),
      },
      // ส่งเฉพาะสองฟิลด์นี้ ไม่ส่งต่อสิ่งที่ client แนบมาเกิน
      body: JSON.stringify({ session_id: sessionId, question: question.trim() }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    // ข้อความของ exception ไม่ส่งออกไป — มันพา URL/คีย์ออกไปได้
    return fail(
      timedOut ? 504 : 502,
      timedOut ? "timeout" : "upstream_unreachable",
      timedOut
        ? "ใช้เวลานานเกินกำหนด กรุณาลองใหม่"
        : "ติดต่อบริการตอบคำถามไม่ได้",
    );
  }

  const text = await upstream.text();
  // ส่ง envelope ของบริการต่อตามเดิม (answer / anchors / grounded / refused /
  // fetched_at / request_id) เพื่อให้ฝั่ง UI เห็น request_id ที่ใช้ตามหาใน log ได้
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
