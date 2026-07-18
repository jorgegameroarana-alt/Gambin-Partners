const SUPABASE_URL = "https://hmqupdyrgrqiqfcvvhkn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nOjNIhAIe030z8aotzFa8A_naaWnTlc";
const NOTIFICATION_EMAIL = "jorge.gamero.arana@gmail.com";
const FROM_EMAIL = "Gambin Partners <jorge.gamero@gambinpartners.com>";

const allowedTopics = new Set([
  "Estrategia y crecimiento",
  "Excelencia operativa",
  "Finanzas y performance",
  "Data y Business Intelligence",
  "Market Entry y Business Development",
  "Otro",
]);

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    return response.status(200).json({ ok: true, service: "contact-notifications" });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido." });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return response.status(503).json({ error: "El servicio de correo no está disponible." });
  }

  const body = request.body ?? {};
  if (clean(body.website, 200)) {
    return response.status(200).json({ ok: true });
  }

  const payload = {
    request_id: clean(body.request_id, 36),
    nombre: clean(body.nombre, 120),
    empresa: clean(body.empresa, 160),
    cargo: clean(body.cargo, 120) || null,
    correo: clean(body.correo, 254).toLowerCase(),
    telefono: clean(body.telefono, 40) || null,
    pais: clean(body.pais, 100) || null,
    tema: clean(body.tema, 120),
    mensaje: clean(body.mensaje, 5000),
    estado: "nuevo",
    origen: "website",
  };

  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.request_id);
  if (
    !isValidUuid ||
    payload.nombre.length < 2 ||
    payload.empresa.length < 2 ||
    !isEmail(payload.correo) ||
    !allowedTopics.has(payload.tema) ||
    payload.mensaje.length < 10
  ) {
    return response.status(400).json({ error: "Revisa los datos del formulario." });
  }

  const databaseResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/contact_submissions`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!databaseResponse.ok) {
    const databaseError = await databaseResponse.json().catch(() => ({}));
    const isDuplicateRequest = databaseResponse.status === 409 && databaseError.code === "23505";

    if (!isDuplicateRequest) {
      console.error("Supabase insert failed", databaseResponse.status, databaseError);
      return response.status(502).json({ error: "No pudimos guardar la consulta." });
    }
  }

  const safe = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, escapeHtml(String(value ?? "—"))]),
  );

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `contact-${payload.request_id}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [NOTIFICATION_EMAIL],
      reply_to: payload.correo,
      subject: `Nueva consulta web: ${payload.tema} — ${payload.empresa}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#2B2F36;max-width:640px;margin:auto">
          <div style="background:#0D1B2A;color:#fff;padding:24px 28px;border-bottom:4px solid #C8A968">
            <div style="font-size:12px;letter-spacing:2px;color:#C8A968">GAMBIN PARTNERS</div>
            <h1 style="font-size:24px;margin:8px 0 0">Nueva consulta desde la página web</h1>
          </div>
          <div style="padding:28px;border:1px solid #e3e3df;border-top:0">
            <p><strong>Nombre:</strong> ${safe.nombre}</p>
            <p><strong>Empresa:</strong> ${safe.empresa}</p>
            <p><strong>Cargo:</strong> ${safe.cargo}</p>
            <p><strong>Correo:</strong> <a href="mailto:${safe.correo}">${safe.correo}</a></p>
            <p><strong>Teléfono:</strong> ${safe.telefono}</p>
            <p><strong>País:</strong> ${safe.pais}</p>
            <p><strong>Tema:</strong> ${safe.tema}</p>
            <div style="margin-top:24px;padding:18px;background:#F5F5F2;border-left:3px solid #C8A968">
              <strong>Mensaje</strong><br><br>${safe.mensaje.replaceAll("\n", "<br>")}
            </div>
          </div>
        </div>`,
      text: `Nueva consulta de ${payload.nombre} (${payload.empresa})\n\nTema: ${payload.tema}\nCorreo: ${payload.correo}\nTeléfono: ${payload.telefono ?? "—"}\nPaís: ${payload.pais ?? "—"}\n\n${payload.mensaje}`,
    }),
  });

  if (!emailResponse.ok) {
    console.error("Resend failed", emailResponse.status, await emailResponse.text());
    return response.status(502).json({
      error: "La consulta fue guardada, pero la notificación no pudo enviarse. Inténtalo nuevamente.",
    });
  }

  return response.status(201).json({ ok: true });
}
