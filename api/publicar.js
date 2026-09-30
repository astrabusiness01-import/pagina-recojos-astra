/* POST /api/publicar — publica la lista de recojos (requiere el código del encargado) */
const { leerTodo, guardarRecojos, limpiarRecojos, pinValido, leerBody, espera } = require("./_datos");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  let body;
  try { body = leerBody(req); } catch (e) { return res.status(400).json({ error: "Solicitud inválida." }); }
  if (!pinValido(body.pin)) {
    await espera(1500); // frena intentos de adivinar el código
    return res.status(401).json({ error: "Código incorrecto." });
  }

  let recojos;
  try {
    recojos = limpiarRecojos(body.recojos);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  try {
    // Si otro celular o pestaña publicó después de que este panel cargó la lista,
    // no se sobrescribe (se perderían esos cambios): se pide recargar.
    const actual = await leerTodo();
    if (actual && actual.version && body.version !== actual.version) {
      return res.status(409).json({
        conflicto: true,
        error: "La lista cambió desde otro celular o pestaña. Recarga el panel para ver lo último; tu recojo nuevo se conserva."
      });
    }
    const version = await guardarRecojos(recojos);
    res.status(200).json({ ok: true, recojos, version });
  } catch (e) {
    res.status(500).json({ error: "No se pudo publicar. Inténtalo de nuevo." });
  }
};
