// ═══════════════════════════════════════════════════════════════
// ZUNAI · Rex Coach API
//
// ESTRUCTURA EN CAPAS
//   REX_BASE       · quién es Rex y qué sabe. Reemplazable en bloque.
//   REGLAS_SALIDA  · una por canal (text / voice). Restricción del medio.
//   CAPAS_TAREA    · una por trigger, partida en dos:
//                      tarea   → qué se pide (igual en todo canal)
//                      formato → el schema (solo canales estructurados)
//
// El prompt enviado = REX_BASE + regla del canal + tarea + [formato]
//
// Agregar un trigger: una entrada en CAPAS_TAREA.
// Agregar un canal:   una entrada en REGLAS_SALIDA. Nada más.
//
// El modelo se selecciona AUTOMÁTICAMENTE. Nunca hardcodear uno acá.
// ═══════════════════════════════════════════════════════════════

const Anthropic = require("@anthropic-ai/sdk");

// ─── CAPA BASE ──────────────────────────────────────────────────

const REX_BASE = `Sos Rex, el coach de negocio de Zunai, la plataforma de gestión y coaching para agentes inmobiliarios en LatAm.

No sos un asistente genérico ni un bot de tareas. Sos un coach, mentor y planificador con criterio real de negocio inmobiliario. Tu magia es ser PROACTIVO e integrado al trabajo del agente: aparecés en el momento justo, con lo pertinente, sin interrumpir de más.

## CÓMO TRABAJÁS

Ingeniería inversa de metas: de la meta grande a las acciones concretas de hoy, con números. Meta de ingresos, operaciones necesarias, pre-listings, conexiones y contactos por semana, acciones del día.

Ratios de referencia del negocio:
- Cada 6 pre-listings o pre-buyings dan 1 cierre.
- Entre el 30 y el 50% de los pre-listings se captan. Con seguimiento se recupera cerca del 20% de los no captados.
- Semana sustentable: 15 conexiones cara a cara, 2 contactos nuevos a la red, 3 pre-listings.
- Cartera: menos de 10 es negocio en desarrollo, entre 11 y 19 en crecimiento, 20 o más próspero. Pasadas unas 35 propiedades, conviene sugerir armar equipo.
- Rotación de cartera (vendidas sobre cartera) igual o mayor al 10%. Tasa de servicio igual o mayor al 15%.
- Conexión cara a cara es cualquier contacto presencial donde se hable del rubro.

Ticket promedio: en Argentina se habla del ticket por VALOR de propiedad, no por comisión.

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
- Todo lead que entra es captación o venta.

## TE ADAPTÁS A LA PERSONA
Todo lo que decís es SUGERENCIA. El objetivo no es maximizar números: es que el agente tenga el negocio Y la vida que quiere. Si alguien elige trabajar menos, tu trabajo es ayudarlo a lograr eso mejor, no empujarlo a facturar más.

## LENGUAJE
Nunca desmoralices. Mostrale el camino con calidez, nunca lo hagas sentir mal por dónde está parado.

## ESTILO
- Español rioplatense, voseo.
- Cálido pero directo y concreto. Nada de motivación vacía.
- Breve. El agente está trabajando, no leyendo.
- No inventes datos que no tenés.`;

// ─── REGLAS DE SALIDA POR CANAL ─────────────────────────────────
// Restricción del medio, no de la personalidad ni de la tarea.
// NO mover esto adentro de REX_BASE: si se reemplaza la base entera
// por el prompt definitivo, estas reglas tienen que sobrevivir.
//
// usa_formato indica si al prompt se le adjunta el schema JSON de la
// tarea. En voz no hay schema: la respuesta es habla corrida.

const CANAL_DEFAULT = "text";

const REGLAS_SALIDA = {
  text: {
    usa_formato: true,
    regla: `

## FORMATO DE SALIDA — CRÍTICO
Tu respuesta empieza EXACTAMENTE con el carácter { y termina EXACTAMENTE con el carácter }
No agregues ningún texto antes ni después del JSON.
No hagas auto-correcciones ni escribas frases como "perdón, corrijo el formato".
No uses backticks ni markdown.
Respetá los límites de extensión de tu tarea: una respuesta que se corta a la mitad es una respuesta perdida.
El campo "speech" siempre es la versión hablada: fluye natural leída en voz alta, sin viñetas, sin asteriscos, sin numeración.`,
  },

  // voice: PENDIENTE — no implementar todavía.
  // {
  //   usa_formato: false,
  //   regla: `Respondés hablando. Sin JSON, sin campos, sin viñetas,
  //           sin numeración. Habla corrida, con la cadencia de alguien
  //           que le está contando algo a un colega.`,
  // }
  // Al tener usa_formato en false, el schema de la tarea no se adjunta
  // y no hay instrucciones contradictorias. Ningún trigger se toca.
  // El handler necesitará saltear extractJSON para este canal.
};

function resolverCanal(channel) {
  const canal = channel || CANAL_DEFAULT;
  if (REGLAS_SALIDA[canal]) return canal;
  console.warn(`[Rex] Canal desconocido "${canal}", usando ${CANAL_DEFAULT}`);
  return CANAL_DEFAULT;
}

// ─── CAPAS DE TAREA ─────────────────────────────────────────────

const TRIGGER_DEFAULT = "dashboard_foco_dia";

const CAPAS_TAREA = {
  dashboard_foco_dia: {
    maxTokens: 1500,
    tarea: `
## TU TAREA AHORA
Mirás toda la cartera del agente y definís el foco del día. Priorizá en este orden: lo más cerca de generar plata, lo que está en riesgo de perderse, y el volumen que falta para sostener el embudo.

Producís tres cosas:
- Un diagnóstico del momento del negocio y qué importa hoy: máximo 3 frases.
- Entre 1 y 4 acciones concretas, una sola frase cada una, ordenadas por prioridad, indicando a qué deal corresponden cuando aplique.
- Un cierre de una frase.

Si la cartera está vacía, aconsejá cómo construirla.`,
    formato: `
Completá primero los campos de datos y dejá "speech" para el final.

Formato exacto:
{"diagnostico":"el diagnóstico","acciones":[{"texto":"la acción","deal_id":"id del deal o null","prioridad":1}],"cierre":"el cierre","speech":"lo mismo dicho en voz alta, máximo 6 frases"}`,
    normalizar: (p) => {
      if (!p.diagnostico && p.speech) p.diagnostico = p.speech;
      if (!p.diagnostico) p.diagnostico = "Contame qué estás trabajando para ayudarte mejor.";
      if (!p.cierre) p.cierre = "Cada acción suma. Vamos.";
      if (!Array.isArray(p.acciones)) p.acciones = [];
      p.acciones = p.acciones.filter(a => a && typeof a.texto === "string" && a.texto.trim().length > 0);
      if (!p.acciones.length) {
        p.acciones = [{ texto: "Revisá tus deals activos y agendá 3 contactos para hoy", deal_id: null, prioridad: 1 }];
      }
      if (!p.speech) p.speech = `${p.diagnostico} ${p.acciones.map(a => a.texto).join(". ")}. ${p.cierre}`;
      return p;
    },
    fallback: ({ deals = [], metas = {} } = {}) => {
      const acciones = [];
      [...deals]
        .filter(d => (d.dias_sin_contacto || 0) > 5)
        .sort((a, b) => b.dias_sin_contacto - a.dias_sin_contacto)
        .slice(0, 2)
        .forEach((deal, i) => acciones.push({
          texto: `Retomar contacto con ${deal.cliente} — lleva ${deal.dias_sin_contacto} dias sin movimiento`,
          deal_id: deal.id || null,
          prioridad: i + 1,
        }));
      const faltan = (metas.conexiones_semana?.meta || 15) - (metas.conexiones_semana?.actual || 0);
      if (faltan > 0) {
        acciones.push({
          texto: `Cerrar ${faltan} conexiones cara a cara para alcanzar la meta semanal`,
          deal_id: null,
          prioridad: acciones.length + 1,
        });
      }
      if (!acciones.length) {
        acciones.push({ texto: "Revisá tus deals activos y agendá al menos 3 contactos para hoy", deal_id: null, prioridad: 1 });
      }
      const diagnostico = "No pude conectarme en este momento, pero armé tu foco con lo que sé de tu cartera.";
      return {
        speech: `${diagnostico} ${acciones.map(a => a.texto).join(". ")}.`,
        diagnostico,
        acciones,
        cierre: "Cada acción suma. Vamos.",
      };
    },
  },

  deal_detail: {
    maxTokens: 1200,
    tarea: `
## TU TAREA AHORA
Te preguntan qué hacer con UN deal puntual. Mirá su etapa, cuánto hace que no hay movimiento, si tiene próximo paso agendado y qué dice su historial. Respondé sobre ESE deal, no sobre la cartera.

Producís tres cosas:
- Un diagnóstico de en qué punto está este deal y qué lo traba: máximo 3 frases.
- Entre 1 y 4 acciones concretas, una sola frase cada una, con nombre, canal y momento.
- Un cierre de una frase.`,
    formato: `
Completá primero los campos de datos y dejá "speech" para el final.

Formato exacto:
{"diagnostico":"el diagnóstico","acciones":[{"texto":"la acción","deal_id":"id del deal","prioridad":1}],"cierre":"el cierre","speech":"lo mismo dicho en voz alta, máximo 6 frases"}`,
    normalizar: (p, ctx) => CAPAS_TAREA.dashboard_foco_dia.normalizar(p, ctx),
    fallback: ({ deal = {} } = {}) => {
      const diagnostico = "No pude conectarme en este momento. Revisá el historial del deal y definí el próximo paso.";
      return {
        speech: diagnostico,
        diagnostico,
        acciones: [{
          texto: deal.cliente
            ? `Contactar a ${deal.cliente} y dejar agendado el próximo paso antes de cortar`
            : "Contactar al cliente y dejar agendado el próximo paso",
          deal_id: deal.id || null,
          prioridad: 1,
        }],
        cierre: "Nada debe quedar suelto.",
      };
    },
  },

  deal_resumen: {
    maxTokens: 800,
    tarea: `
## TU TAREA AHORA
Escribís el resumen de situación de un deal, para que el agente entienda dónde está parado sin leer todo el historial.

Producís dos cosas:
- Un resumen de 3 a 5 frases corridas, no una lista: quién es el cliente, qué busca o qué tiene, cómo viene la relación según el historial de interacciones, y en qué estado está hoy.
- El próximo paso que corresponde: una frase.

No repitas datos que el agente ya ve en pantalla (precio, dirección, etapa). Aportá lectura, no inventario.`,
    formato: `
Completá primero los campos de datos y dejá "speech" para el final.

Formato exacto:
{"resumen":"el párrafo","proximo_paso":"la frase","speech":"lo mismo para escuchar"}`,
    normalizar: (p) => {
      if (!p.resumen && p.speech) p.resumen = p.speech;
      if (!p.resumen) p.resumen = "Todavía no hay suficiente historial para armar un resumen de este deal.";
      if (!p.proximo_paso) p.proximo_paso = "Definí y agendá el próximo paso.";
      if (!p.speech) p.speech = `${p.resumen} ${p.proximo_paso}`;
      return p;
    },
    fallback: ({ deal = {} } = {}) => {
      const resumen = deal.cliente
        ? `No pude conectarme para armar el resumen. El deal con ${deal.cliente} sigue activo y su historial está en la pestaña de Actividad.`
        : "No pude conectarme para armar el resumen. El historial completo está en la pestaña de Actividad.";
      return { speech: resumen, resumen, proximo_paso: "Revisá la última interacción y definí el próximo paso." };
    },
  },

  rex_sugiere: {
    maxTokens: 400,
    tarea: `
## TU TAREA AHORA
Das UNA sugerencia contextual sobre este deal. Una sola, la más útil ahora mismo. Una o dos frases, no más.
Elegí también qué tipo de acción la resuelve, para que el agente la ejecute de un click. Los tipos posibles son: contacto, tarea, visita, nota, etapa.`,
    formato: `
Completá primero los campos de datos y dejá "speech" para el final.

Formato exacto:
{"sugerencia":"una o dos frases","accion":{"texto":"label corto del boton, maximo 4 palabras","tipo":"contacto"},"speech":"lo mismo dicho en voz alta"}`,
    normalizar: (p) => {
      const TIPOS = ["contacto", "tarea", "visita", "nota", "etapa"];
      if (!p.sugerencia && p.speech) p.sugerencia = p.speech;
      if (!p.sugerencia) p.sugerencia = "Revisá cuándo fue el último contacto y dejá agendado el próximo paso.";
      if (!p.accion || typeof p.accion !== "object") p.accion = {};
      if (!p.accion.texto) p.accion.texto = "Registrar contacto";
      if (!TIPOS.includes(p.accion.tipo)) p.accion.tipo = "contacto";
      if (!p.speech) p.speech = p.sugerencia;
      return p;
    },
    fallback: () => ({
      speech: "No pude conectarme. Revisá cuándo fue el último contacto y dejá agendado el próximo paso.",
      sugerencia: "Revisá cuándo fue el último contacto y dejá agendado el próximo paso.",
      accion: { texto: "Registrar contacto", tipo: "contacto" },
    }),
  },

  criterios_ponderar: {
    maxTokens: 1200,
    tarea: `
## TU TAREA AHORA
El agente te cuenta en texto libre qué busca un cliente comprador. Traducilo a criterios ponderados.

Producís tres cosas:
- Una lista de criterios con peso del 1 al 10, cada uno con una razón de UNA frase corta. Entre 4 y 8 criterios.
- Los innegociables: lo que no puede faltar o sería descarte automático. No llevan peso, son filtros.
- Qué falta preguntar: lo que el agente no mencionó y cambia la búsqueda (forma de pago, urgencia, decisores, si necesita vender primero).

Distinguí lo que el cliente DIJO de lo que el agente INFIERE. Si algo no se dijo, va en "falta_preguntar", no lo inventes como criterio.
Las razones son cortas: una frase, no un párrafo.`,
    formato: `
Completá primero los campos de datos y dejá "speech" para el final. El speech no pasa de 5 frases.

Formato exacto:
{"criterios":[{"nombre":"Zona","peso":9,"razon":"por que ese peso"}],"innegociables":["cochera cubierta"],"falta_preguntar":["forma de pago"],"speech":"resumen hablado de lo anterior, maximo 5 frases"}`,
    normalizar: (p) => {
      if (!Array.isArray(p.criterios)) p.criterios = [];
      p.criterios = p.criterios
        .filter(c => c && c.nombre)
        .map(c => ({ ...c, peso: Math.min(10, Math.max(1, Number(c.peso) || 5)) }));
      if (!Array.isArray(p.innegociables)) p.innegociables = [];
      if (!Array.isArray(p.falta_preguntar)) p.falta_preguntar = [];
      if (!p.speech) {
        p.speech = `Te propongo ${p.criterios.length} criterios y ${p.innegociables.length} innegociables.`;
      }
      return p;
    },
    fallback: () => ({
      speech: "No pude conectarme. Cargá los criterios a mano y después los ajustamos.",
      criterios: [],
      innegociables: [],
      falta_preguntar: ["Presupuesto real", "Forma de pago", "Urgencia", "Quiénes deciden"],
    }),
  },

  feedback_visita: {
    maxTokens: 700,
    tarea: `
## TU TAREA AHORA
El agente te cuenta cómo fue una visita, en texto libre y desordenado. Ordenalo.

Producís tres cosas:
- La reacción del cliente: gusto, no_gusto o descarta. Poné "descarta" solo si el cliente la sacó de la lista.
- El comentario limpio: qué dijo el cliente, en dos o tres frases, sin interpretación tuya.
- Qué criterios mencionó y con qué signo. Sirve para detectar qué le importa de verdad, que no siempre coincide con lo que declaró al principio.

Si el agente no dice cómo reaccionó el cliente, no lo adivines: devolvé la reacción vacía.`,
    formato: `
Completá primero los campos de datos y dejá "speech" para el final.

Formato exacto:
{"reaccion":"gusto","comentario":"lo que dijo el cliente","criterios_mencionados":[{"nombre":"Luminosidad","sentimiento":"positivo"}],"speech":"lo mismo dicho en voz alta"}`,
    normalizar: (p) => {
      const R = ["gusto", "no_gusto", "descarta"];
      if (!R.includes(p.reaccion)) p.reaccion = null;
      if (!p.comentario) p.comentario = "";
      if (!Array.isArray(p.criterios_mencionados)) p.criterios_mencionados = [];
      if (!p.speech) p.speech = p.comentario || "Registré la visita.";
      return p;
    },
    fallback: () => ({
      speech: "No pude conectarme. Guardá el comentario tal cual y después lo ordenamos.",
      reaccion: null,
      comentario: "",
      criterios_mencionados: [],
    }),
  },

  comparativa_resumen: {
    maxTokens: 700,
    tarea: `
## TU TAREA AHORA
Explicás el resultado de una comparativa de propiedades para que la lea EL CLIENTE COMPRADOR, no el agente.

Producís dos cosas:
- Un resumen de 3 a 4 frases: qué se comparó y qué se desprende. Hablale al cliente en segunda persona.
- Una recomendación de una o dos frases, con el porqué.

Nunca menciones puntajes, pesos ni porcentajes: el cliente no ve la ingeniería interna. Hablá de la propiedad, no del método.
Si alguna falla un innegociable, decilo con claridad y sin rodeos.`,
    formato: `
Completá primero los campos de datos y dejá "speech" para el final.

Formato exacto:
{"resumen":"3 a 4 frases","recomendacion":"1 o 2 frases","speech":"lo mismo para escuchar"}`,
    normalizar: (p) => {
      if (!p.resumen && p.speech) p.resumen = p.speech;
      if (!p.resumen) p.resumen = "Todavía no hay suficientes opciones cargadas para comparar.";
      if (!p.recomendacion) p.recomendacion = "";
      if (!p.speech) p.speech = `${p.resumen} ${p.recomendacion}`;
      return p;
    },
    fallback: () => ({
      speech: "No pude armar el resumen en este momento.",
      resumen: "No pude armar el resumen en este momento. La comparación de estrellas está completa igual.",
      recomendacion: "",
    }),
  },

  recalibrar_criterios: {
    maxTokens: 800,
    tarea: `
## TU TAREA AHORA
Recibís los criterios ponderados de una búsqueda y las reacciones reales del cliente a las propiedades que visitó. Detectás si los pesos declarados contradicen lo que el cliente decidió.

La gente dice una cosa y elige por otra: es lo más común del negocio. Si descartó las mejores de la zona que dijo priorizar y se entusiasmó con una de otro barrio, el peso de "zona" está mal y hay algo más que pesa de verdad.

Solo señalá una contradicción si los datos la sostienen. Con menos de tres propiedades con reacción, devolvé hay_contradiccion en false: no alcanza para leer un patrón.

Si la hay, producís: una observación de dos frases dirigida al AGENTE, y los ajustes de peso concretos que proponés.`,
    formato: `
Completá primero los campos de datos y dejá "speech" para el final.

Formato exacto:
{"hay_contradiccion":true,"observacion":"dos frases","ajustes":[{"criterio":"Zona","peso_actual":9,"peso_sugerido":5,"razon":"por que"}],"speech":"lo mismo dicho en voz alta"}`,
    normalizar: (p) => {
      p.hay_contradiccion = p.hay_contradiccion === true;
      if (!Array.isArray(p.ajustes)) p.ajustes = [];
      if (!p.observacion) p.observacion = "";
      if (!p.hay_contradiccion) { p.ajustes = []; p.observacion = ""; }
      if (!p.speech) p.speech = p.observacion;
      return p;
    },
    fallback: () => ({
      speech: "",
      hay_contradiccion: false,
      observacion: "",
      ajustes: [],
    }),
  },
};
function resolverCapa(trigger) {
  if (CAPAS_TAREA[trigger]) return { nombre: trigger, capa: CAPAS_TAREA[trigger] };
  console.warn(`[Rex] Trigger desconocido "${trigger}", usando ${TRIGGER_DEFAULT}`);
  return { nombre: TRIGGER_DEFAULT, capa: CAPAS_TAREA[TRIGGER_DEFAULT] };
}

// identidad + regla del canal + tarea + (schema solo si el canal lo usa)
function buildSystemPrompt(capa, canal) {
  const reglaCanal = REGLAS_SALIDA[canal];
  let prompt = REX_BASE + reglaCanal.regla + "\n" + capa.tarea;
  if (reglaCanal.usa_formato) prompt += "\n" + capa.formato;
  return prompt;
}

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
  if (MODEL_CACHE.model && now - MODEL_CACHE.timestamp < MODEL_CACHE_TTL) return MODEL_CACHE.model;
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
    return { text, model, provider: "anthropic", stop_reason: msg.stop_reason };
  },
};

const PROVIDERS = [{ provider: anthropicProvider, active: true }];
const RETRY_ATTEMPTS = 2;

async function callProviders(params) {
  for (const { provider } of PROVIDERS.filter(p => p.active)) {
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

// ─── JSON EXTRACTOR ──────────────────────────────────────────────
// Recupera el JSON aunque venga con texto alrededor. Si la respuesta
// quedó truncada por max_tokens, cierra las estructuras abiertas para
// salvar lo que llegó completo.
function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.trim()); } catch {}
  const start = text.indexOf("{");
  if (start === -1) return null;

  const stack = [];
  let inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) {
        try { return JSON.parse(text.substring(start, i + 1)); } catch { return null; }
      }
    }
  }

  if (stack.length) {
    let salvage = text.substring(start);
    if (inString) salvage += '"';
    for (let i = stack.length - 1; i >= 0; i--) salvage += stack[i] === "{" ? "}" : "]";
    try {
      const parsed = JSON.parse(salvage);
      console.warn("[Rex] JSON truncado, recuperado parcialmente");
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

// ─── HANDLER ────────────────────────────────────────────────────
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
  const canal = resolverCanal(context.channel);
  const { nombre: triggerNombre, capa } = resolverCapa(context.trigger);

  const responder = (payload, extra = {}) =>
    res.status(200).json({ ...payload, ...extra, _meta: { ...(extra._meta || {}), trigger: triggerNombre, canal } });

  try {
    const result = await Promise.race([
      callProviders({
        systemPrompt: buildSystemPrompt(capa, canal),
        userMessage: JSON.stringify(context),
        maxTokens: capa.maxTokens,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)),
    ]);

    if (result.stop_reason === "max_tokens") {
      console.warn(`[Rex] ${triggerNombre} · respuesta truncada por max_tokens (${capa.maxTokens})`);
    }
    console.log(`[Rex] ${triggerNombre}/${canal} · raw: ${result.text ? result.text.substring(0, 160) : "undefined"}`);

    // NUNCA devolver texto sin parsear como contenido: si no se puede
    // parsear, va el fallback de la capa. Volcar el crudo a la pantalla
    // le muestra JSON al agente.
    const extraido = extractJSON(result.text);
    if (!extraido) {
      console.error(`[Rex] ${triggerNombre} · no se pudo parsear, usando fallback`);
      return responder(capa.fallback(context), { _fallback: true });
    }

    // TTS_HOOK: parsed.speech se alimenta al servicio de sintesis de voz aqui.
    const parsed = capa.normalizar(extraido, context);

    return responder(parsed, { _meta: { provider: result.provider, model: result.model } });
  } catch (err) {
    console.error(`[Rex] Fatal en ${triggerNombre}: ${err.message}`);
    return responder(capa.fallback(context), { _fallback: true });
  }
};
