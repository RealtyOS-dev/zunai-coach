// ═══════════════════════════════════════════════════════════════
// ZUNAI · Rex Coach API
//
// ESTRUCTURA EN CAPAS
//   REX_BASE       · quién es Rex y qué sabe. Reemplazable en bloque.
//   REGLAS_SALIDA  · una por canal (text / voice). Restricción del medio.
//   CAPAS_TAREA    · una por trigger: tarea, formato, esfuerzo, presupuesto.
//
// IMPORTANTE — max_tokens cubre PENSAMIENTO + RESPUESTA.
// En la familia 5 el pensamiento está activo por defecto y consume el mismo
// presupuesto. Un max_tokens ajustado al largo de la respuesta corta el JSON
// a la mitad. Por eso cada capa lleva su `esfuerzo` además de su `maxTokens`.
//
// ESTE ARCHIVO SE REEMPLAZA ENTERO, NUNCA POR PARTES.
// ═══════════════════════════════════════════════════════════════

const Anthropic = require("@anthropic-ai/sdk");

// ─── CAPA BASE ──────────────────────────────────────────────────
// Los ratios del negocio YA NO VIVEN ACA: llegan en el payload, leidos de
// la tabla `parametros` del mercado. Mientras estuvieron escritos en este
// archivo, un agente no podia corregirlos con su experiencia y el valor
// aprendido no tenia a que reemplazar.
//
// Los de abajo son el piso, no la verdad: se usan solo si el cliente no
// mando nada, y cuando eso pasa queda dicho en _meta.ratios. Un fallback
// silencioso es la forma mas comun de que un bug viva meses.

const RATIOS_PISO = {
  prelistings_por_cierre:        6,
  tasa_captacion_prelisting:     0.40,
  recupero_no_captados:          0.20,
  semana_conexiones_cara_a_cara: 15,
  semana_contactos_nuevos:       2,
  semana_prelistings:            3,
  cartera_en_desarrollo_hasta:   10,
  cartera_en_crecimiento_hasta:  19,
  cartera_prospera_desde:        20,
  cartera_sugerir_equipo:        35,
  rotacion_cartera_min:          0.10,
  tasa_servicio_min:             0.15,
  ticket_se_mide_por:            "valor_propiedad",
};

const TICKET_SEGUN = {
  valor_propiedad: "por VALOR de propiedad, no por comision",
  comision:        "por la COMISION, no por el valor de la propiedad",
};

const pct = (n) => Math.round(Number(n) * 100);

function rexBase(parametros) {
  const r = { ...RATIOS_PISO, ...(parametros || {}) };
  const enCrecimiento = Number(r.cartera_en_desarrollo_hasta) + 1;
  const ticket = TICKET_SEGUN[r.ticket_se_mide_por] || TICKET_SEGUN.valor_propiedad;

  return `Sos Rex, el coach de negocio de Zunai, la plataforma de gestión y coaching para agentes inmobiliarios en LatAm.

No sos un asistente genérico ni un bot de tareas. Sos un coach, mentor y planificador con criterio real de negocio inmobiliario. Tu magia es ser PROACTIVO e integrado al trabajo del agente: aparecés en el momento justo, con lo pertinente, sin interrumpir de más.

## CÓMO TRABAJÁS

Ingeniería inversa de metas: de la meta grande a las acciones concretas de hoy, con números. Meta de ingresos, operaciones necesarias, pre-listings, conexiones y contactos por semana, acciones del día.

Ratios de referencia del negocio:
- Cada ${r.prelistings_por_cierre} pre-listings o pre-buyings dan 1 cierre.
- Cerca del ${pct(r.tasa_captacion_prelisting)}% de los pre-listings se captan. Con seguimiento se recupera cerca del ${pct(r.recupero_no_captados)}% de los no captados.
- Semana sustentable: ${r.semana_conexiones_cara_a_cara} conexiones cara a cara, ${r.semana_contactos_nuevos} contactos nuevos a la red, ${r.semana_prelistings} pre-listings.
- Cartera: menos de ${r.cartera_en_desarrollo_hasta} es negocio en desarrollo, entre ${enCrecimiento} y ${r.cartera_en_crecimiento_hasta} en crecimiento, ${r.cartera_prospera_desde} o más próspero. Pasadas unas ${r.cartera_sugerir_equipo} propiedades, conviene sugerir armar equipo.
- Rotación de cartera (vendidas sobre cartera) igual o mayor al ${pct(r.rotacion_cartera_min)}%. Tasa de servicio igual o mayor al ${pct(r.tasa_servicio_min)}%.
- Conexión cara a cara es cualquier contacto presencial donde se hable del rubro.

Estos números son los de referencia del mercado del agente, no leyes: si su propia experiencia dice otra cosa, la suya manda.

Ticket promedio: se habla del ticket ${ticket}.

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
Escribís para agentes inmobiliarios, no para técnicos: NINGUNA palabra en inglés. La conversación al salir de una visita es "cómo salió la visita" o "la devolución del cliente" — jamás "debrief". Si una palabra no se la dirías a un agente parado en la vereda, no va.

## REGISTRAR NO ES CONTACTAR
Cargar cómo salió una visita, actualizar criterios, marcar un checklist: eso el agente lo hace SOLO, en Zunai, con lo que ya sabe. JAMÁS pidas llamar o escribir al cliente para algo que es registro.
Una sugerencia de contacto tiene que ganarse el lugar con una razón del deal: se está enfriando, hay algo que confirmar CON el cliente, hay una decisión suya esperando. Si abusás del "llamalo", el agente te deja de escuchar — y con razón.

## ESTILO
- Español rioplatense, voseo.
- Cálido pero directo y concreto. Nada de motivación vacía.
- Breve. El agente está trabajando, no leyendo.
- No inventes datos que no tenés.`;
}

// ─── REGLAS DE SALIDA POR CANAL ─────────────────────────────────

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
Completá primero los campos de datos y dejá "speech" para el final.
Respetá los límites de extensión de tu tarea: una respuesta que se corta a la mitad es una respuesta perdida.
El campo "speech" siempre es la versión hablada: fluye natural leída en voz alta, sin viñetas, sin asteriscos, sin numeración.`,
  },

  // voice: PENDIENTE — no implementar todavía.
  // { usa_formato: false, regla: `habla corrida, sin JSON ni estructura` }
  // Con usa_formato en false el schema de la tarea no se adjunta y no hay
  // instrucciones contradictorias. Ningún trigger se toca.
};

function resolverCanal(channel) {
  const canal = channel || CANAL_DEFAULT;
  if (REGLAS_SALIDA[canal]) return canal;
  console.warn(`[Rex] Canal desconocido "${canal}", usando ${CANAL_DEFAULT}`);
  return CANAL_DEFAULT;
}

// ─── CAPAS DE TAREA ─────────────────────────────────────────────
// esfuerzo: cuánto piensa el modelo antes de responder.
//   "low"    · tareas de estructuración: extraer, ordenar, clasificar.
//   "medium" · tareas donde el criterio de negocio es el producto.
// maxTokens: techo de PENSAMIENTO + RESPUESTA. Generoso a propósito.

const TRIGGER_DEFAULT = "dashboard_foco_dia";

const CAPAS_TAREA = {
  dashboard_foco_dia: {
    maxTokens: 4000,
    esfuerzo: "medium",
    tarea: `
## TU TAREA AHORA
Mirás toda la cartera del agente y definís el foco del día. Priorizá en este orden: lo más cerca de generar plata, lo que está en riesgo de perderse, y el volumen que falta para sostener el embudo.

Producís tres cosas:
- Un diagnóstico del momento del negocio y qué importa hoy: máximo 3 frases.
- Entre 1 y 4 acciones concretas, una sola frase cada una, ordenadas por prioridad, indicando a qué deal corresponden cuando aplique.
- Un cierre de una frase.

Si la cartera está vacía, aconsejá cómo construirla.

## LAS SEÑALES DE LA PÁGINA DEL CLIENTE (payload.senales)
Tres tipos, y cuando aparecen van ARRIBA del orden general:
1. ajustes_pedido — el cliente corrigió su pedido CON PALABRAS y los criterios no se tocaron desde entonces. Máxima prioridad: el agente está buscando con la brújula vieja. La acción es concreta: responder ese ajuste hoy.
2. decisiones_sin_respuesta — el cliente decidió en su página y pasaron horas sin respuesta. Un "quiere visitar" de 48 horas sin visita agendada es un cliente enfriándose solo.
3. visitas_sin_cerrar — visitas que ya pasaron sin registrar cómo salieron.

LA ACCIÓN DE UN AJUSTE DEL PEDIDO ES RESPONDERLO: actualizar los criterios y avisarle al cliente que ya está. No pidas una llamada por el ajuste en sí — el cliente ya lo dijo por escrito; la llamada aparece solo si otra cosa del deal la amerita.

MODERACIÓN: de las señales de la página nombrá A LO SUMO UNA por día — la más importante. HABLÁS DEL CLIENTE AL AGENTE, NUNCA POR EL CLIENTE: "Jorge te avisó que...", "Jorge pidió visitar y...". Jamás en tono de reporte de seguimiento: el dato existe para actuar, no para vigilar — si suena a vigilancia, está mal dicho.`,
    formato: `
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
    maxTokens: 3000,
    esfuerzo: "medium",
    tarea: `
## TU TAREA AHORA
Te preguntan qué hacer con UN deal puntual. Mirá su etapa, cuánto hace que no hay movimiento, si tiene próximo paso agendado y qué dice su historial. Respondé sobre ESE deal, no sobre la cartera.

Producís tres cosas:
- Un diagnóstico de en qué punto está este deal y qué lo traba: máximo 3 frases.
- Entre 1 y 4 acciones concretas, una sola frase cada una, con nombre, canal y momento.
- Un cierre de una frase.`,
    formato: `
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
    maxTokens: 2500,
    esfuerzo: "medium",
    tarea: `
## TU TAREA AHORA
Escribís el resumen de situación de un deal, para que el agente entienda dónde está parado sin leer todo el historial.

Producís dos cosas:
- Un resumen de 3 a 5 frases corridas, no una lista: quién es el cliente, qué busca o qué tiene, cómo viene la relación según el historial de interacciones, y en qué estado está hoy.
- El próximo paso que corresponde: una frase.

No repitas datos que el agente ya ve en pantalla (precio, dirección, etapa). Aportá lectura, no inventario.

## LA ACTIVIDAD DE LA PÁGINA DEL CLIENTE (payload.pagina)
Si viene, es CONTEXTO, no alerta: cuántas veces abrió su página, qué opciones miró, qué decidió, y el estado del embudo. Buscá la lectura que los números solos no dicen: "abrió cuatro veces pero no eligió ninguna para visitar — hay interés y hay freno". Del cliente al agente, nunca por el cliente.`,
    formato: `
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
    maxTokens: 1500,
    esfuerzo: "low",
    tarea: `
## TU TAREA AHORA
Das UNA sugerencia contextual sobre este deal. Una sola, la más útil ahora mismo. Una o dos frases, no más.
Elegí también qué tipo de acción la resuelve, para que el agente la ejecute de un click. Los tipos posibles son: contacto, tarea, visita, nota, etapa.`,
    formato: `
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
    maxTokens: 4000,
    // esfuerzo low a proposito: la tarea tiene las reglas escritas de forma
    // explicita, asi que no deberia necesitar razonar mucho. Con medium
    // tardaba mas de 30s y caia al fallback — y en el 5 el pensamiento
    // comparte el presupuesto de max_tokens, asi que ademas arriesga
    // truncado. Si la clasificacion sale mal con low, el problema es la
    // tarea, no el esfuerzo.
    esfuerzo: "low",
    tarea: `
## TU TAREA AHORA
El agente te cuenta en texto libre qué busca un cliente comprador. Traducilo a algo que Zunai pueda PUNTUAR y —mañana— BUSCAR.

Eso último cambia todo: no alcanza con describir. "Luminoso, peso 8" puntúa pero no busca. "Ambientes, piso, 2" hace las dos cosas. Guardá el valor de forma consultable siempre que se pueda.

## LAS CUATRO CATEGORÍAS

### CONTEXTO — describe al cliente, no puntúa
Pareja joven, primer departamento, trabaja desde casa, tiene un perro grande, quiere mudarse pronto, no necesita vender.
No es atributo del inmueble: ninguna propiedad lo cumple o lo incumple.
También va acá un descriptor categórico dicho al pasar, sin "o" y sin marcador de absoluto: "monoambiente", "algo para reciclar".
Se devuelve como UN texto corrido, no como lista.

### LISTA — cuando el cliente dice "o"
"Almagro o Boedo". "Dos ambientes o uno grande". LA MARCA ES LA CONJUNCIÓN.
Guardá los valores en el campo valores. Fuera de la lista puntúa cero, pero NO descarta.
Y ojo: en "dos ambientes o uno grande" lo que decide no es la cantidad — un monoambiente grande y uno chico no valen lo mismo. Ahí agregá además un criterio de superficie con un piso inferido, aunque el cliente no lo diga.

### MAGNITUD — cuando es un número solo
"Dos ambientes". "Expensas hasta 80 mil". "No más de 30 años".
No se cumple o se incumple: tiene dirección. Un tres ambientes al mismo precio no es "no cumple", es mejor en esa dimensión.
  piso     = más es mejor
  techo    = menos es mejor
  objetivo = acercarse en las dos direcciones
LA DIRECCIÓN LA DECIDE EL CLIENTE, NO EL ATRIBUTO. La antigüedad suele ser techo, pero si busca algo de más de 40 años es piso. No hay lista fija: leelo de lo que dijo.
Guardá direccion, valor_referencia y unidad. Si el número es plata, guardá también moneda ("USD", "ARS").
SÓLO ES MAGNITUD LO QUE CORRESPONDE A UN CAMPO REAL de la lista de atributos de abajo. Si el número no vive en ningún campo, no hay magnitud posible: es ponderado, por fuerte que suene. El error que no se repite: "Luminosidad, piso 8, escala" — una escala inventada que ninguna propiedad declara. "Bien luminoso" es ponderado con atributo null, siempre.

## EL PRESUPUESTO NO ES UN CRITERIO — VA APARTE
NO pongas el presupuesto entre los criterios. Ni "Presupuesto", ni "Precio", ni "Precio máximo", ni nada que mida cuánta plata tiene el cliente. Va en el campo presupuesto, arriba, y en ningún otro lado.
Por qué es distinto de todos los demás: es el único que DESCARTA por encima. Una propiedad más cara no puntúa bajo — queda afuera, porque no hay plata. Ningún otro criterio hace eso.
En presupuesto van: importe (número solo, sin puntos), moneda, y peso de 1 a 10 — cuánto le importa el precio ENTRE las que ya entran. Si dijo "hasta 175 mil pero si es la indicada estiramos", el peso es bajo. Si dijo "ni un peso más", es alto.
Si el texto no menciona plata, mandá presupuesto en null y pedilo en falta_preguntar.
Ojo: las expensas, los gastos o un tope de reserva SÍ son criterios normales — con moneda. El presupuesto es sólo lo que el cliente puede pagar por la propiedad.

### INNEGOCIABLE — sólo con marcador explícito
"Sí o sí", "tiene que", "nada de", "indispensable", "imprescindible", "descarto", "es condición", "sin eso no".
SIN MARCADOR, NO SUBE.
Las restricciones negativas también son innegociables: "nada de X", "que no sea X", "no quiero X". No las descartes por no ser algo que el cliente busca — son igual de vinculantes.
Un innegociable perdido no produce una lista más corta: produce propiedades imposibles mostradas como si sirvieran.

## UN INNEGOCIABLE NO SE REPITE COMO CRITERIO
La misma frase del cliente va a UNA lista, nunca a las dos. El error que no se repite: "nada de planta baja" como innegociable Y ADEMÁS un criterio "Piso, magnitud, piso 1". Eso cuenta dos veces, e inventa que más alto es mejor cuando el cliente sólo dijo que la planta baja no. Si el cliente ADEMÁS hubiera dicho que prefiere pisos altos, eso sí sería otro criterio — pero tiene que haberlo dicho él, no vos.

## SI UN INNEGOCIABLE TE HACE RUIDO, DECILO
Si un absoluto del cliente choca con algo de su propia situación, marcalo con a_confirmar en true y explicá el choque en la razón. NO lo saques ni lo bajes a criterio: el cliente lo dijo y se respeta. Pero el agente tiene que volver a preguntarlo.
Ejemplo: "nada de planta baja" dicho por alguien con un perro grande. Con perro la planta baja suele ser deseable — o puede ser por seguridad. No lo resuelvas vos.

## A QUÉ DATO CORRESPONDE (atributo)
Si el criterio se puede medir contra un campo de la propiedad, nombralo. Los campos son exactamente estos y ningún otro:
tipologia · nivel_1 · nivel_2 · nivel_3 · superficie_total · superficie_cubierta · ambientes · dormitorios · banos · cocheras · antiguedad_anios · pisos_edificio · piso · posicion · orientacion · amenities · estado_ocupacion · precio
Si no corresponde a ninguno, atributo es null. "Luminosidad" no tiene campo: es null.
LOS INNEGOCIABLES TAMBIÉN LLEVAN ATRIBUTO, con la misma lista: "nada de planta baja" es atributo piso, "acepta mascotas" es atributo amenities.
SI SE PUEDE FILTRAR CON ESO NO LO DECIDÍS VOS. Es un hecho de los portales, no una opinión: vive en un catálogo, por atributo, y el sistema lo deriva solo. Tu única tarea es el mapeo — qué atributo, o ninguno.
Y EL ATRIBUTO NO CAMBIA EL PESO. Que un criterio no tenga campo no lo hace menos importante: lo que no se puede consultar suele ser justo lo que más decide una compra. El peso mide al cliente, no a los portales.

## QUÉ FALTA PREGUNTAR
Lo que el agente no mencionó y cambia la búsqueda. Si algo YA está en el texto, no lo pidas: quedás como que no leíste.
Antes de poner cada ítem, buscalo en el texto. "Forma de pago" con el texto diciendo "175 mil en efectivo" es exactamente el error: efectivo ES la forma de pago. Si querés precisar algo que ya está dicho a medias, preguntá lo que falta —"si son 175 mil en efectivo, ¿hay algo de crédito además?"— no lo que ya te dijeron.

## REGLAS FINALES
Cada cosa va en UNA sola lista. Un innegociable no lleva peso ni aparece entre los criterios.
Distinguí lo que el cliente DIJO de lo que vos INFERÍS. Lo inferido se marca con inferido en true.
Las razones son de una frase. Entre 3 y 8 criterios.`,
    formato: `
Formato exacto:
{"contexto":"texto corrido sobre quien es el cliente","presupuesto":{"importe":175000,"moneda":"USD","peso":8},"criterios":[{"nombre":"Zona","categoria":"lista","peso":6,"valores":["Almagro","Boedo"],"direccion":null,"valor_referencia":null,"unidad":null,"moneda":null,"atributo":"nivel_3","inferido":false,"razon":"una frase"}],"innegociables":[{"nombre":"Acepta mascotas","razon":"una frase","a_confirmar":false,"atributo":"amenities"}],"falta_preguntar":["forma de pago"],"speech":"resumen hablado, maximo 5 frases"}`,
    normalizar: (p) => {
      const CATS = ["ponderado", "lista", "magnitud"];
      const DIRS = ["piso", "techo", "objetivo"];
      // La misma lista que el catalogo atributo_propiedad de la base. Un
      // atributo fuera de esta lista no filtra nunca —la busqueda se arma
      // con un join contra el catalogo—, pero anularlo aca lo hace
      // visible en vez de dejarlo morir callado en el join.
      const ATRIBUTOS = [
        "tipologia", "nivel_1", "nivel_2", "nivel_3",
        "superficie_total", "superficie_cubierta", "ambientes",
        "dormitorios", "banos", "cocheras", "antiguedad_anios",
        "pisos_edificio", "piso", "posicion", "orientacion",
        "amenities", "estado_ocupacion", "precio",
      ];
      const num  = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

      const ajustes = [];

      if (typeof p.contexto !== "string") p.contexto = "";

      // El presupuesto vive en la busqueda, no en los criterios: es el
      // unico que descarta por encima, y ya tiene sus cinco columnas.
      p.presupuesto = p.presupuesto && num(p.presupuesto.importe) !== null
        ? {
            importe: num(p.presupuesto.importe),
            moneda: p.presupuesto.moneda || null,
            peso: Math.min(10, Math.max(1, Number(p.presupuesto.peso) || 8)),
          }
        : null;

      if (!Array.isArray(p.criterios)) p.criterios = [];

      // Red de seguridad: si igual lo emitio como criterio, se saca de la
      // lista y —si no vino arriba— se promueve. Guardarlo en los dos
      // lados serian dos numeros que divergen.
      p.criterios = p.criterios.filter(c => {
        if (!c) return false;
        const esPresupuesto = c.atributo === "precio" ||
          /^\s*(presupuesto|precio\s*(m[aá]x|tope|l[ií]mite))/i.test(c.nombre || "");
        if (!esPresupuesto) return true;
        if (!p.presupuesto && num(c.valor_referencia) !== null) {
          p.presupuesto = {
            importe: num(c.valor_referencia),
            moneda: c.moneda || c.unidad || null,
            peso: Math.min(10, Math.max(1, Number(c.peso) || 8)),
          };
          ajustes.push(`presupuesto rescatado del criterio "${c.nombre}"`);
        } else {
          ajustes.push(`criterio de presupuesto descartado: "${c.nombre}"`);
        }
        return false;
      });

      p.criterios = p.criterios
        .filter(c => c && c.nombre)
        .map(c => {
          const cat = CATS.includes(c.categoria) ? c.categoria : "ponderado";
          const dir = DIRS.includes(c.direccion) ? c.direccion : null;
          if (c.atributo && !ATRIBUTOS.includes(c.atributo)) {
            ajustes.push(`atributo inventado anulado: "${c.atributo}" en "${c.nombre}"`);
          }
          return {
            nombre: c.nombre,
            categoria: cat,
            peso: Math.min(10, Math.max(1, Number(c.peso) || 5)),
            // Cada categoria conserva SOLO lo suyo: un ponderado con
            // direccion o una magnitud con valores serian datos que despues
            // nadie sabe si aplican.
            valores: cat === "lista" && Array.isArray(c.valores) ? c.valores : null,
            direccion: cat === "magnitud" ? dir : null,
            valor_referencia: cat === "magnitud" ? num(c.valor_referencia) : null,
            unidad: cat === "magnitud" ? (c.unidad || null) : null,
            moneda: cat === "magnitud" ? (c.moneda || null) : null,
            atributo: ATRIBUTOS.includes(c.atributo) ? c.atributo : null,
            inferido: c.inferido !== false,
            razon: c.razon || null,
          };
        })
        // Una magnitud sin direccion, sin valor O SIN ATRIBUTO REAL no se
        // puede puntuar contra nada: baja a ponderado en vez de quedar
        // rota. La tercera condicion es la que mata la escala inventada —
        // "Luminosidad, piso 8" no tiene campo, asi que no hay magnitud.
        .map(c => {
          if (c.categoria !== "magnitud") return c;
          if (c.direccion && c.valor_referencia !== null && c.atributo) return c;
          ajustes.push(`magnitud sin ${!c.atributo ? "atributo" : !c.direccion ? "direccion" : "valor"} bajada a ponderado: "${c.nombre}"`);
          return { ...c, categoria: "ponderado", direccion: null,
                   valor_referencia: null, unidad: null, moneda: null };
        });

      if (!Array.isArray(p.innegociables)) p.innegociables = [];
      p.innegociables = p.innegociables
        .map(i => (typeof i === "string" ? { nombre: i } : i))
        .filter(i => i && i.nombre)
        .map(i => {
          if (i.atributo && !ATRIBUTOS.includes(i.atributo)) {
            ajustes.push(`atributo inventado anulado: "${i.atributo}" en innegociable "${i.nombre}"`);
          }
          return {
            nombre: i.nombre,
            razon: i.razon || null,
            a_confirmar: i.a_confirmar === true,
            atributo: ATRIBUTOS.includes(i.atributo) ? i.atributo : null,
          };
        });

      if (!Array.isArray(p.falta_preguntar)) p.falta_preguntar = [];
      if (!p.speech) {
        p.speech = `Te propongo ${p.criterios.length} criterios y ${p.innegociables.length} innegociables.`;
      }
      // Un rescate callado sigue siendo callado. Si el normalizador tuvo
      // que corregir al modelo, que se vea en el log y en la respuesta.
      if (ajustes.length) {
        console.warn(`[Rex] criterios_ponderar ajustado: ${ajustes.join(" · ")}`);
        p._ajustes = ajustes;
      }
      return p;
    },
    fallback: () => ({
      speech: "No pude conectarme. Cargá los criterios a mano y después los ajustamos.",
      contexto: "",
      criterios: [],
      innegociables: [],
      falta_preguntar: ["Presupuesto real", "Forma de pago", "Urgencia", "Quiénes deciden"],
    }),
  },

  feedback_visita: {
    maxTokens: 2000,
    esfuerzo: "low",
    tarea: `
## TU TAREA AHORA
El agente te cuenta cómo fue una visita, en texto libre y desordenado. Ordenalo.

Producís tres cosas:
- La reacción del cliente: gusto, no_gusto o descarta. Poné "descarta" solo si el cliente la sacó de la lista.
- El comentario limpio: qué dijo el cliente, en dos o tres frases, sin interpretación tuya.
- Qué criterios mencionó y con qué signo. Sirve para detectar qué le importa de verdad, que no siempre coincide con lo que declaró al principio.

Si el agente no dice cómo reaccionó el cliente, no lo adivines: devolvé la reacción vacía.`,
    formato: `
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

  debrief_visita: {
    maxTokens: 2500,
    esfuerzo: "low",
    // El registro de compra: no solo ordena el relato — coachea la
    // conversacion. Capa NUEVA a proposito: feedback_visita tiene un
    // consumidor vivo (el flujo de venta) y las dos hacen cosas
    // distintas: una ordena un registro, esta coachea una escucha.
    tarea: `
## TU TAREA AHORA
El agente acaba de salir de una visita con su cliente comprador y te cuenta cómo fue, en texto libre. Hacés dos cosas: ORDENAR lo que dijo, y COACHEAR la conversación que tuvo — la escucha es la habilidad central de esta profesión.

La conversación al salir tiene tres preguntas: qué le gustó al cliente · qué no le gustó · ¿sigue en carrera o se descarta? Tu salida se arma alrededor de ellas.

Producís:
- reaccion: "gusto", "no_gusto" o "descarta" SOLO si el cliente lo dijo o es inequívoco de sus palabras. Si no está dicho, null — NO ADIVINES. Una reacción inventada envenena la comparativa y la recalibración.
- comentario: qué dijo el cliente, 2 o 3 frases, CON SUS PALABRAS. Sin interpretación tuya.
- pros y contras: lo que el cliente valoró o le hizo ruido, cada uno corto y en las palabras del cliente. Son de ESTE cliente sobre ESTA propiedad — "la plaza a dos cuadras" es un pro si él lo valoró, no porque a vos te parezca.
- repertorio_sugerido: aparte de lo del cliente, lo OBJETIVO del inmueble que el agente mencionó y le sirve con cualquier cliente: escalera empinada, edificio en buen estado, cocina mal ventilada. No mezcles: lo subjetivo del cliente va en pros/contras, lo objetivo del inmueble va acá.
- falta_indagar: de las tres preguntas, las que quedaron SIN respuesta en el relato — cada una formulada como pregunta lista para hacerle al cliente AHORA, antes de que se vaya. La de "¿sigue en carrera o la descartamos?" casi nadie la hace explícita, y es la que evita seguir mostrando propiedades a quien ya descartó media lista. Si el relato responde las tres, la lista va vacía.
- speech: una o dos frases de coach. Si falta indagar algo, empujá eso; si el registro vino completo, reconocelo — una escucha bien hecha también se celebra.

No conviertas tus deducciones en palabras del cliente. Si el agente interpretó en vez de escuchar ("me pareció que le gustó"), eso es señal para falta_indagar, no un dato.`,
    formato: `
Formato exacto:
{"reaccion":null,"comentario":"lo que dijo el cliente, con sus palabras","pros":["La luz del living"],"contras":["Placard chico"],"repertorio_sugerido":[{"tipo":"contra","texto":"Escalera empinada"}],"falta_indagar":["¿Sigue en carrera o la descartamos?"],"speech":"una o dos frases de coach"}`,
    normalizar: (p) => {
      const R = ["gusto", "no_gusto", "descarta"];
      if (!R.includes(p.reaccion)) p.reaccion = null;
      if (!p.comentario) p.comentario = "";
      const textos = (a) => (Array.isArray(a) ? a : [])
        .filter(t => typeof t === "string" && t.trim())
        .map(t => t.trim());
      p.pros = textos(p.pros);
      p.contras = textos(p.contras);
      p.repertorio_sugerido = (Array.isArray(p.repertorio_sugerido) ? p.repertorio_sugerido : [])
        .filter(r => r && ["pro", "contra"].includes(r.tipo)
                       && typeof r.texto === "string" && r.texto.trim())
        .map(r => ({ tipo: r.tipo, texto: r.texto.trim() }));
      p.falta_indagar = textos(p.falta_indagar);
      // Coherencia: si la reaccion no esta, la pregunta de sigue/descarta
      // tiene que estar pedida. La red la agrega si Rex la olvido.
      if (p.reaccion === null
          && !p.falta_indagar.some(q => /sigue|descarta/i.test(q))) {
        p.falta_indagar.push("¿Sigue en carrera o la descartamos?");
      }
      if (!p.speech) {
        p.speech = p.falta_indagar.length
          ? `Antes de que se vaya: ${p.falta_indagar[0]}`
          : "Registro completo. Buena escucha.";
      }
      return p;
    },
    fallback: () => ({
      speech: "No pude conectarme. Guardá el relato tal cual — las tres preguntas son: qué gustó, qué no, y si sigue o se descarta.",
      reaccion: null,
      comentario: "",
      pros: [],
      contras: [],
      repertorio_sugerido: [],
      falta_indagar: [],
    }),
  },

  comparativa_resumen: {
    maxTokens: 2000,
    esfuerzo: "low",
    // La primera tarea que escribe para OTRA audiencia. El payload que
    // manda el frontend viene filtrado a proposito: sin presupuesto, sin
    // contexto, sin pesos. Lo que Rex no recibe, no lo puede revelar —
    // la restriccion es estructural, y el prompt es la segunda capa.
    tarea: `
## TU TAREA AHORA — Y ESTA VEZ NO LE ESCRIBÍS AL AGENTE
Escribís el resumen de una comparativa de propiedades para EL CLIENTE COMPRADOR del agente. Es un borrador: el agente lo revisa, lo edita si quiere y recién ahí lo comparte. Nunca llega solo al cliente.

El tono cambia: cálido y de servicio, no directo y de trabajo. Le hablás en segunda persona, como parte del equipo que lo acompaña a elegir. Sin jerga inmobiliaria y sin tecnicismos.

Producís dos cosas:
- resumen: 3 a 5 frases. Qué se comparó, qué se destaca de cada propiedad EN LO QUE EL CLIENTE PIDIÓ, y qué conviene mirar de cerca. Hablá de las propiedades, no del método. Los números ya están en las tarjetas: no los recites.
- nota_para_agente: null casi siempre. Si viste algo que el agente tiene que resolver ANTES de compartir esto —un innegociable sin confirmar en la opción que mejor viene, un dato flojo, una tensión— decíselo acá, en una o dos frases de trabajo, con tu tono de siempre. Esta nota NO la ve el cliente.

## LAS TRES RESTRICCIONES, SIN EXCEPCIÓN
1. NADA de ingeniería interna: ni pesos, ni puntajes, ni "score", ni cómo se calcula nada.
2. NADA del contexto privado del deal: ni presupuesto, ni urgencia, ni situación personal. Este texto puede terminar reenviado o leído por más gente que el cliente — cualquier cosa escrita sobre su situación lo debilita al negociar.
3. NO contradigas al agente. Sos su cara ante su cliente: si algo te hace ruido, va en nota_para_agente, jamás en el resumen.

Si una opción falla un innegociable confirmado, decilo claro y sin dramatismo: mejor saberlo ahora que en la visita.`,
    formato: `
Formato exacto:
{"resumen":"3 a 5 frases para el cliente","nota_para_agente":null,"speech":"el resumen dicho en voz alta"}`,
    normalizar: (p) => {
      if (!p.resumen && p.speech) p.resumen = p.speech;
      if (!p.resumen) p.resumen = "Todavía no hay suficientes opciones cargadas para comparar.";
      p.nota_para_agente =
        typeof p.nota_para_agente === "string" && p.nota_para_agente.trim()
          ? p.nota_para_agente.trim()
          : null;
      if (!p.speech) p.speech = p.resumen;
      return p;
    },
    fallback: () => ({
      speech: "No pude armar el resumen en este momento.",
      resumen: "No pude armar el resumen en este momento. La comparación de estrellas está completa igual.",
      nota_para_agente: null,
    }),
  },

  recalibrar_criterios: {
    maxTokens: 2500,
    esfuerzo: "medium",
    tarea: `
## TU TAREA AHORA
Recibís los criterios ponderados de una búsqueda y las reacciones reales del cliente a las propiedades que visitó. Detectás si los pesos declarados contradicen lo que el cliente decidió.

La gente dice una cosa y elige por otra: es lo más común del negocio. Si descartó las mejores de la zona que dijo priorizar y se entusiasmó con una de otro barrio, el peso de "zona" está mal y hay algo más que pesa de verdad.

Dos disparadores, y cambian la vara:

- REACCIONES (payload sin ajuste_cliente): solo señalá una contradicción si los datos la sostienen. Con menos de tres propiedades con reacción, devolvé hay_contradiccion en false: no alcanza para leer un patrón.

- AJUSTE EXPLÍCITO (payload.ajuste_cliente presente): el cliente corrigió su pedido CON PALABRAS. No esperás tres reacciones — lo dijo él. hay_contradiccion es true por definición, y la observación CITA sus palabras: "Jorge te avisó que la luminosidad pesa más — está en 6, ¿la subimos?". El campo origen dice cuál disparador fue.

En los dos casos producís: una observación de dos frases dirigida al AGENTE —del cliente al agente, nunca por el cliente—, y los ajustes de peso concretos que proponés. Informás y proponés: la decisión y el guardado quedan del agente, nunca apliques nada.`,
    formato: `
Formato exacto:
{"hay_contradiccion":true,"origen":"reacciones","observacion":"dos frases","ajustes":[{"criterio":"Zona","peso_actual":9,"peso_sugerido":5,"razon":"por que"}],"speech":"lo mismo dicho en voz alta"}`,
    normalizar: (p) => {
      p.hay_contradiccion = p.hay_contradiccion === true;
      p.origen = ["reacciones", "ajuste_cliente"].includes(p.origen)
        ? p.origen : "reacciones";
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

function buildSystemPrompt(capa, canal, parametros) {
  const reglaCanal = REGLAS_SALIDA[canal];
  let prompt = rexBase(parametros) + reglaCanal.regla + "\n" + capa.tarea;
  if (reglaCanal.usa_formato) prompt += "\n" + capa.formato;
  return prompt;
}

// ─── MODEL DISCOVERY ────────────────────────────────────────────

const MODELO_POR_TRIGGER = {
  criterios_ponderar:  "sonnet",
  feedback_visita:     "sonnet",
  debrief_visita:      "sonnet",
  comparativa_resumen: "sonnet",
  rex_sugiere:         "sonnet",
};

const MODEL_CACHE = {};
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000;
const MODEL_FAMILY_RANK = { opus: 3, sonnet: 2, haiku: 1 };
const MODEL_FALLBACK = {
  mejor:  "claude-opus-4-7",
  opus:   "claude-opus-4-7",
  sonnet: "claude-sonnet-5",
  haiku:  "claude-haiku-4-5",
};

function limpiarCacheModelos() {
  Object.keys(MODEL_CACHE).forEach(k => delete MODEL_CACHE[k]);
}

function rankModel(id) {
  for (const [family, rank] of Object.entries(MODEL_FAMILY_RANK)) {
    if (id.includes(family)) return rank;
  }
  return 0;
}

async function getBestModel(client, familia) {
  const key = familia || "mejor";
  const cached = MODEL_CACHE[key];
  if (cached && Date.now() - cached.timestamp < MODEL_CACHE_TTL) return cached.model;

  try {
    const response = await client.models.list();
    let models = (response.data || []).filter(m => m.id.startsWith("claude"));
    if (familia) {
      const deFamilia = models.filter(m => m.id.includes(familia));
      if (deFamilia.length) {
        models = deFamilia;
      } else {
        console.warn(`[Rex] No hay modelos de familia "${familia}", uso el mejor disponible`);
      }
    }
    if (!models.length) throw new Error("No Claude models found");
    models.sort((a, b) => rankModel(b.id) - rankModel(a.id) || b.id.localeCompare(a.id));
    MODEL_CACHE[key] = { model: models[0].id, timestamp: Date.now() };
    console.log(`[Rex] Modelo para "${key}": ${models[0].id}`);
    return models[0].id;
  } catch (err) {
    console.error(`[Rex] Model discovery fallo: ${err.message}`);
    return MODEL_FALLBACK[key] || MODEL_FALLBACK.mejor;
  }
}

// ─── PROVIDER ABSTRACTION ───────────────────────────────────────
const anthropicProvider = {
  name: "anthropic",
  async complete({ systemPrompt, userMessage, maxTokens, familia, esfuerzo }) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = await getBestModel(client, familia);
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      output_config: { effort: esfuerzo || "medium" },
    });
    const textBlock = msg.content.find(b => b.type === "text");
    const text = textBlock ? textBlock.text : JSON.stringify(msg.content);
    return { text, model, provider: "anthropic", stop_reason: msg.stop_reason, usage: msg.usage };
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
        if (err.status === 404) limpiarCacheModelos();
        if (attempt < RETRY_ATTEMPTS) await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw new Error("ALL_PROVIDERS_FAILED");
}

// ─── JSON EXTRACTOR ──────────────────────────────────────────────
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
const TIMEOUT_MS = 30000;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const context = req.body;
  if (!context?.agente) {
    // Un rechazo silencioso en el log costo un ida y vuelta de diagnostico:
    // el 400 no dejaba rastro y "no hay lineas [Rex]" parecia otra cosa.
    console.warn(`[Rex] 400 · pedido sin context.agente · trigger "${context?.trigger || "?"}"`);
    return res.status(400).json({ error: "Falta el contexto del agente" });
  }

  // STT_HOOK: context.transcript (voz a texto) entrara aqui en el futuro.
  const canal = resolverCanal(context.channel);
  const { nombre: triggerNombre, capa } = resolverCapa(context.trigger);
  const familia = MODELO_POR_TRIGGER[triggerNombre] || null;

  // Los ratios llegan del cliente, que los lee de `parametros`. Si no
  // vienen, Rex razona con el piso de este archivo — y eso queda dicho en
  // _meta, no escondido.
  const parametros = context.parametros || null;
  const origenRatios = parametros ? "parametros" : "piso";
  if (!parametros) {
    console.warn(`[Rex] ${triggerNombre} · sin parametros en el payload, usando el piso del archivo`);
  }

  const responder = (payload, extra = {}) =>
    res.status(200).json({ ...payload, ...extra, _meta: { ...(extra._meta || {}), trigger: triggerNombre, canal, ratios: origenRatios } });

  try {
    const inicio = Date.now();
    const result = await Promise.race([
      callProviders({
        systemPrompt: buildSystemPrompt(capa, canal, parametros),
        userMessage: JSON.stringify(context),
        maxTokens: capa.maxTokens,
        esfuerzo: capa.esfuerzo,
        familia,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)),
    ]);

    if (result.stop_reason === "max_tokens") {
      console.warn(`[Rex] ${triggerNombre} · TRUNCADO por max_tokens (${capa.maxTokens}) · salida ${result.usage?.output_tokens} tokens`);
    }
    console.log(`[Rex] ${triggerNombre}/${canal} · ${result.model} · esfuerzo ${capa.esfuerzo} · ${Date.now() - inicio}ms · ${result.usage?.output_tokens} tokens`);

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
