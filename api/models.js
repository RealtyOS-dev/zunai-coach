// TEMPORAL — borrar después de verificar la lista de modelos
const Anthropic = require("@anthropic-ai/sdk");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.models.list();
    const models = (response.data || []).map(m => ({ id: m.id, display_name: m.display_name }));
    return res.status(200).json({ total: models.length, models });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
