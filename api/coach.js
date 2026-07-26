const Anthropic = require("@anthropic-ai/sdk");

const REX_SYSTEM_PROMPT = `Sos Rex, el coach de negocio de Zunai, la plataforma de gestión y coaching para agentes inmobiliarios en LatAm.

No sos un asistente genérico ni un bot de tareas. Sos un coach, mentor y planificador con criterio real de negocio inmobiliario.

## CÓMO TRABAJÁS

**Ingeniería inversa de metas:** de la meta grande a las acciones concretas de hoy, con números.

**Ratios de referencia del negocio:**
- Cada 6 pre-listings/pre-buyings → 1 cierre.
- 30-50% de los pre-listings se captan. Con seguimiento se recupera ~20% de los no captados.
- Semana sustentable: 15 conexiones cara a cara, 2 contactos nuevos a la red, 3 pre-listings.
- Cartera: menos de 10 es negocio en desarrollo, 11-19 en crecimiento, 20 o más próspero.
- Rotación de cartera mayor o igual a 10%. Tasa de servicio mayor o igual a 15%.
- Conexión cara a cara es cualquier contacto presencial donde se hable del rubro.

**Ticket promedio:** en Argentina se habla del ticket por VALOR de propiedad, no por comisión.

## LAS 3 CLAVES QUE SOSTENÉS SIEMPRE
1. RESILIENCIA: cada no acerca al sí.
2. VOLUMEN: es lo único 100% en control del agente.
3. VELOCIDAD: venta diferida, venta perdida.

## FILOSOFÍA
- Venta consultiva y relacional. Las ventas son emocionales. El seguimiento es todo.
- Prospección es el 50% o más del tiempo.
- Vender es ayudar.
- Escuchar 80, hablar 20.
- Cada acción deja su próximo paso agendado. Nada suelto.

## ESTILO
- Español rioplatense, voseo.
- Cálido pero directo y concreto. Nada de motivación vacía.
- Breve: 2-4 frases o una lista corta.
- No inventes datos que no tenés.

## FORMATO DE RESPUESTA — CRÍTICO
Tu respuesta debe comenzar EXACTAMENTE con el carácter { y terminar EXACTAMENTE con el carácter }
NO agregues ningún texto antes ni después del JSON.
NO hagas auto-correcciones ni escribas frases como "Perdón, corrijo el formato".
NO uses backticks ni markdown.
SOLO el JSON, nada más.

Formato exacto:
{"speech":"texto conversacional para voz sin viñetas ni asteriscos","diagnostico":"2-3 frases sobre el momento del negocio","acciones":[{"texto":"accion concreta","deal_id":"id o null","prioridad":1}],"cierre":"frase de cierre breve"}

Mínimo 1 acción. Máximo 4. Si no hay deals, aconsejá cómo construir la cartera.`;

// ─── MODEL DISCOVERY ────────────────────────────────────────────
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
    console.error(`[Rex] Model discovery fallo: ${err.message}`);
    return MODEL_FALLBACK;
  }
}

// ─── PROVIDER ABSTRACTION ───────────────────────────────────────
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
    const textBlock = msg.content.find(b => b.type === "text");
    const text = textBlock ? textBlock.text : JSON.stringify(msg.content);
    return { text, model, provider: "anthropic" };
  },
};

const PROVIDERS = [{ provider: anthropicProvider, active: true }];
const RETRY_ATTEMPTS = 2;

async function callProviders(params) {
  const active = PROVIDERS.filter(p => p.active);
  for (const { provider } of active) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        return await provider.complete(params);
      } catch (err) {
        console.error(`[Rex] ${provider.name} intento ${attempt} fallo: ${err.message}`);
        if (err.status === 404) MODEL_CACHE.model = null;
        if (attempt < RETRY_ATTEMPTS) await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw new Error("ALL_PROVIDERS_FAILED");
}

// ─── FALLBACK LOCAL ──────────────────────────────────────────────
function buildFallbackResponse({ deals = [], metas = {} }) {
  const acciones = [];
  const coldDeals = [...deals]
    .filter(d => (d.dias_sin_contacto || 0) > 5)
    .sort((a, b) => b.dias_sin_contacto - a.dias_sin_contacto)
    .slice(0, 2);

  coldDeals.forEach((deal, i) => {
    acciones.push({
      texto: `Retomar contacto con ${deal.cliente} — lleva ${deal.dias_sin_contacto} dias sin movimiento`,
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

  return {
    speech: "No pude conectarme en este momento, pero arme tu foco con lo que se de tu cartera.",
    diagnostico: "No pude conectarme en este momento, pero arme tu foco con lo que se de tu cartera.",
    acciones: acciones.length > 0 ? acciones : [
      { texto: "Revisa tus deals activos y agenda al menos 3 contactos para hoy", deal_id: null, prioridad: 1 },
    ],
    cierre: "Cada accion suma. Vamos.",
    _fallback: true,
  };
}

// ─── JSON EXTRACTOR ──────────────────────────────────────────────
function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.trim()); } catch {}
  const start = text.indexOf('{');
  if (start === -1) return null;
  let inString = false;
  let escape = false;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.substring(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
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

  // STT_HOOK: context.transcript (voz a texto) entrara aqui en el futuro.

  try {
    const result = await Promise.race([
      callProviders({
        systemPrompt: REX_SYSTEM_PROMPT,
        userMessage: JSON.stringify(context),
        maxTokens: 1024,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)),
    ]);

    console.log("[Rex] Raw:", result.text ? result.text.substring(0, 200) : "undefined");

    // TTS_HOOK: result.speech se alimenta al servicio de sintesis de voz aqui.
    // Ejemplo futuro: const audioUrl = await ttsService.synthesize(parsed.speech)

    let parsed = extractJSON(result.text);
    if (!parsed) {
      parsed = { speech: result.text, diagnostico: result.text, acciones: [], cierre: "" };
    }

    if (!parsed.diagnostico && parsed.speech) parsed.diagnostico = parsed.speech;
    if (!parsed.diagnostico) parsed.diagnostico = "Contame que estas trabajando para ayudarte mejor.";
    if (!parsed.cierre) parsed.cierre = "Cada accion suma. Vamos.";
    if (!parsed.acciones || !parsed.acciones.length) {
      parsed.acciones = [{ texto: "Revisa tus deals activos y agenda 3 contactos para hoy", deal_id: null, prioridad: 1 }];
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
