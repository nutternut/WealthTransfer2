/**
 * Proxy SSE ของ POST /ask/stream — same-origin เหมือน /api/ask
 *
 * ต่างจาก /api/ask ที่เดียว: ส่ง body ของ upstream ต่อเป็นสตรีม ไม่ await ทั้งก้อน
 * ถ้า await ก่อนจะได้ progress มาพร้อมกันตอนจบ ซึ่งเท่ากับไม่ stream
 *
 * เหตุผลที่ยังต้องผ่านเซิร์ฟเวอร์เหมือนเดิม: ASK_API_KEY ต้องไม่หลุดไปเบราว์เซอร์
 * และยิงเข้า origin ตัวเองจึงไม่ต้องตั้ง CORS
 */

const ASK_URL = process.env.ASK_URL ?? "http://127.0.0.1:8000";
const ASK_API_KEY = process.env.ASK_API_KEY ?? "";

/** ยาวกว่า ask_timeout_s ของบริการ (120s) เพื่อให้บริการเป็นฝ่ายตัดเอง */
const TIMEOUT_MS = 150_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** error ที่เกิดก่อนเปิดสตรีมส่งเป็น JSON ปกติได้ หลังจากนั้นต้องเป็น event */
function failEvent(code: string, message: string) {
  const line = `data: ${JSON.stringify({ type: "error", code, message })}\n\n`;
  return new Response(line, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
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

  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
    return fail(400, "invalid_session", "session_id ต้องเป็น UUID");
  }
  if (typeof question !== "string" || !question.trim()) {
    return fail(400, "empty_question", "กรุณาพิมพ์คำถาม");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${ASK_URL}/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(ASK_API_KEY ? { "X-Api-Key": ASK_API_KEY } : {}),
      },
      body: JSON.stringify({ session_id: sessionId, question: question.trim() }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return failEvent(
      timedOut ? "timeout" : "upstream_unreachable",
      timedOut
        ? "ใช้เวลานานเกินกำหนด กรุณาลองใหม่"
        : "ติดต่อบริการตอบคำถามไม่ได้",
    );
  }

  // 401/422 จากบริการมาเป็น JSON ไม่ใช่ SSE — แปลงเป็น event เพื่อให้ฝั่ง client
  // มีทางอ่านทางเดียว ไม่ต้องเดาว่า body เป็นชนิดไหน
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    let message = "ระบบตอบคำถามไม่สำเร็จ";
    let code = "upstream_error";
    try {
      const parsed = JSON.parse(text)?.error;
      if (parsed?.message) message = parsed.message;
      if (parsed?.code) code = parsed.code;
    } catch {
      // ไม่ใช่ JSON ก็ใช้ข้อความกลาง ๆ — ไม่ส่ง body ดิบออกไป
    }
    return failEvent(code, message);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
