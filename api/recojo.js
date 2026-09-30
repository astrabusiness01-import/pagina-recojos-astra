/* POST /api/recojo — detalle de un recojo, solo con su código de acceso */
const crypto = require("crypto");
const { leerRecojos, detalle, leerBody, espera } = require("./_datos");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  let body;
  try { body = leerBody(req); } catch (e) { return res.status(400).json({ error: "Solicitud inválida." }); }
  const id = String(body.id || "");
  const codigo = String(body.codigo || "");
  try {
    const recojos = (await leerRecojos()) || [];
    const r = recojos.find((x) => x.id === id && !x.archivado);
    if (!r) return res.status(404).json({ error: "Recojo no encontrado." });
    const ok = /^\d{4}$/.test(codigo) && crypto.timingSafeEqual(Buffer.from(codigo), Buffer.from(r.codigo));
    if (!ok) {
      await espera(1500); // frena intentos de adivinar el código
      return res.status(401).json({ error: "Código incorrecto." });
    }
    res.status(200).json({ recojo: detalle(r) });
  } catch (e) {
    res.status(500).json({ error: "No se pudo abrir el recojo." });
  }
};
