/* Utilidades compartidas de la API de recojos (no es un endpoint: empieza con "_") */
const { get, put } = require("@vercel/blob");

const ARCHIVO = "recojos.json";

const crypto = require("crypto");

// Código de acceso de 4 dígitos para cada recojo (lo recibe el cliente por WhatsApp)
// Nunca repite un código que ya use otro recojo
function nuevoCodigo(usados = new Set()) {
  let c;
  do { c = String(crypto.randomInt(0, 10000)).padStart(4, "0"); } while (usados.has(c));
  usados.add(c);
  return c;
}

async function leerRecojos() {
  const r = await get(ARCHIVO, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const txt = await new Response(r.stream).text();
  const data = JSON.parse(txt);
  if (!Array.isArray(data.recojos)) return null;
  // Recojos antiguos sin código: se les asigna uno y se guarda
  let cambio = false;
  const usados = new Set();
  data.recojos.forEach((x) => {
    if (/^\d{4}$/.test(x.codigo || "") && !usados.has(x.codigo)) usados.add(x.codigo);
    else { x.codigo = nuevoCodigo(usados); cambio = true; }
  });
  if (cambio) await guardarRecojos(data.recojos);
  return data.recojos;
}

// Resumen público: sin guías, nombres de consignatarios, códigos ni teléfonos
function resumen(r) {
  let cajas = 0, mil = 0, hay = false;
  r.grupos.forEach((g) => g.cajas.forEach((c) => {
    cajas++;
    if (typeof c[2] === "number") { mil += Math.round(c[2] * 1000); hay = true; }
  }));
  const kg = hay ? (Math.round(mil / 10) / 100).toFixed(2) : typeof r.pesoKg === "number" ? r.pesoKg.toFixed(2) : null;
  return { id: r.id, responsable: r.responsable, fecha: r.fecha, cajas, kg };
}

// Detalle para el cliente: todo menos el código y el teléfono
function detalle(r) {
  const { codigo, telefono, ...resto } = r;
  return resto;
}

// ---- Código del encargado: el hash vive solo en variables de entorno de Vercel ----
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
function pinValido(pin) {
  const salt = process.env.PANEL_PIN_SALT || "";
  const esperado = process.env.PANEL_PIN_HASH || "";
  if (!salt || !esperado) return false;
  const h = crypto.createHash("sha256").update(salt + String(pin || "")).digest("hex");
  return h.length === esperado.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(esperado));
}
function leerBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
}

async function guardarRecojos(recojos) {
  const body = JSON.stringify({ actualizado: new Date().toISOString(), recojos });
  await put(ARCHIVO, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });
}

// ---- Validación: solo se guarda lo que la página sabe mostrar ----
const txt = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numero = (v) => (typeof v === "number" && isFinite(v) && v >= 0 && v < 100000 ? Math.round(v * 1000) / 1000 : null);

function limpiarRecojos(lista) {
  if (!Array.isArray(lista) || lista.length > 300) throw new Error("Lista de recojos inválida.");
  const ids = new Set();
  // Primero se reservan los códigos que ya existen, para que los nuevos no los repitan
  const usados = new Set();
  const repetido = new Set();
  lista.forEach((r) => {
    const c = String((r && r.codigo) || "");
    if (!/^\d{4}$/.test(c)) return;
    if (usados.has(c)) repetido.add(r); else usados.add(c);
  });
  return lista.map((r) => {
    if (!r || typeof r !== "object") throw new Error("Recojo inválido.");
    const id = txt(r.id, 80);
    if (!/^[a-z0-9-]+$/.test(id) || ids.has(id)) throw new Error("Identificador de recojo inválido.");
    ids.add(id);
    const fecha = txt(r.fecha, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Fecha inválida en " + id + ".");
    if (!Array.isArray(r.grupos) || !r.grupos.length || r.grupos.length > 60) throw new Error("Grupos inválidos en " + id + ".");
    const limpio = {
      id,
      responsable: txt(r.responsable, 60) || "Recojo",
      fecha,
      pesoKg: numero(r.pesoKg),
      nota: txt(r.nota, 120),
      grupos: r.grupos.map((g) => {
        if (!g || !Array.isArray(g.cajas) || !g.cajas.length || g.cajas.length > 600) throw new Error("Cajas inválidas en " + id + ".");
        return {
          nombre: txt(g.nombre, 60) || "Grupo",
          cajas: g.cajas.map((c) => {
            if (!Array.isArray(c)) throw new Error("Caja inválida en " + id + ".");
            const guia = txt(c[0], 20);
            if (!/^\d{6,20}$/.test(guia)) throw new Error("Guía inválida en " + id + ".");
            const caja = [guia, txt(c[1], 120)];
            const peso = numero(c[2]);
            const n = /^\d{1,5}$/.test(String(c[3] || "")) ? String(c[3]) : null;
            if (peso !== null || n) caja[2] = peso;
            if (n) caja[3] = n;
            return caja;
          })
        };
      })
    };
    const tel = txt(r.telefono, 15);
    if (/^\d{10,15}$/.test(tel)) limpio.telefono = tel;
    limpio.codigo = /^\d{4}$/.test(String(r.codigo || "")) && !repetido.has(r) ? String(r.codigo) : nuevoCodigo(usados);
    if (r.archivado === true) limpio.archivado = true;
    return limpio;
  });
}

module.exports = { leerRecojos, guardarRecojos, limpiarRecojos, resumen, detalle, pinValido, leerBody, espera };
