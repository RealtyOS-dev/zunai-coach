// ═══════════════════════════════════════════════════════════════
// ZUNAI · Rex Coach API
// IMPORTANTE: El modelo se selecciona AUTOMÁTICAMENTE.
// Nunca hardcodear un nombre de modelo en este archivo.
// ═══════════════════════════════════════════════════════════════

const Anthropic = require("@anthropic-ai/sdk");

// ─── SYSTEM PROMPT ──────────────────────────────────────────────
// Para actualizar la personalidad de Rex, solo editá esta sección.
// El system prompt vive acá separado de la lógica de la función.
// NOTA: no está atado a ningún canal (texto o voz) — Rex es Rex.
const REX_SYSTEM_PROMPT = `Sos Rex, el coach de negocio de Zunai, la plataforma de gestión y coaching para agentes inmobiliarios en LatAm.

No sos un asistente genérico ni un bot de tareas. Sos un coach, mentor y planificador con criterio real de negocio inmobiliario. Tu magia es ser PROACTIVO e integrado al trabajo del agente: aparecés en el momento justo, con lo pertinente, sin interrumpir de más.

## CÓMO TRABAJÁS

**Ingeniería inversa de metas:** de la meta grande a las acciones concretas de hoy, con números. (Meta de ingresos → operaciones necesarias → pre-listings → conexiones y contactos por semana → acciones del día.)

**Ratios de referencia del negocio:**
- Cada 6 pre-listings/pre-buyings → 1 cierre.
- 30-50% de los pre-listings se captan. Con seguimiento se recupera ~20% de los no captados.
- Semana sustentable: 15 conexiones cara a cara, 2 contactos nuevos a la red, 3 pre-listings.
- Cartera: <10 negocio en desarrollo / 11-19 en crecimiento / 20+ próspero. Pasadas ~35 propiedades, sugerir armar equipo.
- Rotación de cartera (vendidas/cartera) ≥10%. Tasa de servicio ≥15%.
- "Conexión cara a cara" = cualquier contacto presencial donde se hable del rubro.

**Ticket promedio:** en Argentina se habla del ticket por VALOR de propiedad (ej. USD 180.000), no por comisión.

## LAS 3 CLAVES QUE SOSTENÉS SIEMPRE
1. RESILIENCIA — cada no acerca al sí.
2. VOLUMEN — es lo ÚNICO 100% en control del agente.
3. VELOCIDAD — "venta diferida, venta perdida".

## FILOSOFÍA
- Venta CONSULTIVA y RELACIONAL. Las ventas son emocionales. El SEGUIMIENTO es todo.
- Prospección = 50%+ del tiempo.
- Vender es AYUDAR.
- Escuchar 80 / hablar 20.
- Cada acción deja su PRÓXIMO PASO agendado. Nada suelto.
- Todo lead que entra es captación o venta.

## TE ADAPTÁS A LA PERSONA
Todo lo que decís es SUGERENCIA. El objetivo no es maximizar números: es que tenga el negocio Y la vida que quiere.

## LENGUAJE
Nunca desmoralices. Mostrale el camino con calidez, nunca lo hagas sentir mal por dónde está.

## ESTILO
- Español rioplatense, voseo.
- Cálido pero DIRECTO y CONCRETO. Nada de motivación vacía.
- BREVE: 2-4 frases o una lista corta. El agente está trabajando.
- Terminá con un próximo paso claro.
- No inventes datos que no tenés.

## FORMATO DE RESPUESTA
Devolvé SOLO un JSON válido, sin texto adicional ni backticks:
{"speech":"lo que Rex diría en voz alta — fluye natural hablado, sin viñetas ni asteriscos ni markdown","diagnostico":"2-3 frases sobre cómo viene y qué importa hoy","acciones":[{"texto":"acción concreta","deal_id":"id o null","prioridad":1}],"cierre":"una frase breve de cierre"}

El campo "speech" es la versión conversacional pura: sin puntos numerados, sin formato visual, suena bien leído en voz alta. "diagnostico" puede tener estructura levemente más visual para pantalla.
Priorizá: (1) más cerca de generar plata, (2) en riesgo de perderse, (3) volumen faltante. Máximo 4 acciones.`;

// ─── MODEL DISCOVERY ────────────────────────────────────────────
// Rex usa siempre el mejor modelo disponible de Anthropic.
// Se descubre automáticamente y se cachea 24hs en memoria.

const MODEL_CACHE = { model: null, timestamp: 0 };
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000;
const MODEL_FAMILY_RANK = { opus: 3, sonnet: 2, haiku: 1 };
const MODEL_FALLBACK = "claude-opus-4-7";

function rankModel(id) {
  for (const [family, rank] of Object.entries(MODEL_FAMILY_RANK)) {
    if (id.includes(family)) return rank;
  }
  return 0;
}

async function getBestModel(client) {
  const now = Date.now();
  if (MODEL_CACHE.model && now - MODEL_CACHE.timestamp < MODEL_CACHE_TTL) {
    return MODEL_CACHE.model;
  }
  try {
    const response = await client.models.list();
    const models = (response.data || []).filter(m => m.id.startsWith("claude"));
    if (models.length === 0) throw new Error("No Claude models found");
    models.sort((a, b) => rankModel(b.id) - rankModel(a.id) || b.id.localeCompare(a.id));
    MODEL_CACHE.model = models[0].id;
    MODEL_CACHE.timestamp = now;
    console.log(`[Rex] Modelo seleccionado: ${MODEL_CACHE.model}`);
    return MODEL_CACHE.model;
  } catch (err) {
    console.error(`[Rex] Model discovery falló, usando fallback: ${err.message}`);
    return MODEL_FALLBACK;
  }
}

// ─── PROVIDER ABSTRACTION ───────────────────────────────────────
// Rex está desacoplado del proveedor de IA.
// Para agregar otro proveedor: implementar { name, complete() }
// y agregarlo a PROVIDERS en orden de prioridad.

const anthropicProvider = {
  name: "anthropic",
  async complete({ systemPrompt, userMessage, maxTokens }) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = await getBestModel(client);
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    return { text: msg.content[0].text, model, provider: "anthropic" };
  },
};

const PROVIDERS = [
  { provider: anthropicProvider, active: true, score: null },
  // { provider: openaiProvider, active: false, score: null },
];

const RETRY_ATTEMPTS = 2;

async function callProviders(params) {
  const active = PROVIDERS.filter(p => p.active);
  for (const { provider } of active) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        return await provider.complete(params);
      } catch (err) {
        console.error(`[Rex] ${provider.name} intento ${attempt} falló: ${err.message}`);
        if (err.status === 404) MODEL_CACHE.model = null;
        if (attempt < RETRY_ATTEMPTS) await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw new Error("ALL_PROVIDERS_FAILED");
}

// ─── FALLBACK LOCAL ──────────────────────────────────────────────
// Si todos los proveedores fallan, Rex responde con reglas locales.
// El agente nunca se queda sin foco del día.

function buildFallbackResponse({ deals = [], metas = {} }) {
  const acciones = [];
  const coldDeals = [...deals]
    .filter(d => (d.dias_sin_contacto || 0) > 5)
    .sort((a, b) => b.dias_sin_contacto - a.dias_sin_contacto)
    .slice(0, 2);

  coldDeals.forEach((deal, i) => {
    acciones.push({
      texto: `Retomar contacto con ${deal.cliente} — ${deal.direccion} lleva ${deal.dias_sin_contacto} días sin movimiento`,
      deal_id: deal.id || null,
      prioridad: i + 1,
    });
  });

  const conexFaltantes = (metas.conexiones_semana?.meta || 15) - (metas.conexiones_semana?.actual || 0);
  if (conexFaltantes > 0) {
    acciones.push({
      texto: `Cerrar ${conexFaltantes} conexiones cara a cara para alcanzar la meta semanal`,
      deal_id: null,
      prioridad: acciones.length + 1,
    });
  }

  const speech = acciones.length > 0
    ? `No pude conectarme en este momento, pero armé tu foco. ${acciones.map(a => a.texto).join(". ")}.`
    : "No pude conectarme en este momento. Revisá tus deals activos y agendá al menos 3 contactos para hoy.";

  return {
    speech,
    diagnostico: "No pude conectarme en este momento, pero armé tu foco con lo que sé de tu cartera.",
    acciones: acciones.length > 0 ? acciones : [
      { texto: "Revisá tus deals activos y agendá al menos 3 contactos para hoy", deal_id: null, prioridad: 1 },
    ],
    cierre: "Cada acción suma. Vamos.",
    _fallback: true,
  };
}

// ─── HANDLER PRINCIPAL ──────────────────────────────────────────

const TIMEOUT_MS = 20000;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const context = req.body;
  if (!context?.agente) return res.status(400).json({ error: "Falta el contexto del agente" });

  // STT_HOOK: context.transcript (voz→texto) entrará aquí en el futuro.
  // El canal (text | voice) se puede leer en context.channel — por ahora siempre 'text'.

  try {
    const result = await Promise.race([
      callProviders({
        systemPrompt: REX_SYSTEM_PROMPT,
        userMessage: JSON.stringify(context),
        maxTokens: 800,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)),
    ]);

    // TTS_HOOK: parsed.speech se alimenta al servicio de síntesis de voz aquí antes de responder.
    // Ejemplo futuro: const audioUrl = await ttsService.synthesize(parsed.speech)
    // Proveedor a definir: ElevenLabs / Google TTS / OpenAI TTS.
    let parsed;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = { speech: result.text, diagnostico: result.text, acciones: [], cierre: "" };
    }

    return res.status(200).json({
      ...parsed,
      _meta: { provider: result.provider, model: result.model },
    });
  } catch (err) {
    console.error(`[Rex] Fatal: ${err.message}`);
    return res.status(200).json(buildFallbackResponse(context));
  }
};
