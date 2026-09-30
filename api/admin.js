/* POST /api/admin — lista completa para el panel (requiere el código del encargado) */
const { leerTodo, pinValido, leerBody, espera } = require("./_datos");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  let body;
  try { body = leerBody(req); } catch (e) { return res.status(400).json({ error: "Solicitud inválida." }); }
  if (!pinValido(body.pin)) {
    await espera(1500);
    return res.status(401).json({ error: "Código incorrecto." });
  }
  try {
    const t = await leerTodo();
    res.status(200).json({ recojos: t ? t.recojos : [], version: t ? t.version : "" });
  } catch (e) {
    res.status(500).json({ error: "No se pudo leer la lista de recojos." });
  }
};
