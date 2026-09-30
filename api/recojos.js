/* GET /api/recojos — resumen público de recojos (sin guías ni datos de clientes) */
const { leerRecojos, resumen } = require("./_datos");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const recojos = await leerRecojos();
    if (!recojos) return res.status(404).json({ recojos: null });
    res.status(200).json({ recojos: recojos.filter((r) => !r.archivado).map(resumen) });
  } catch (e) {
    res.status(500).json({ error: "No se pudo leer la lista de recojos." });
  }
};
