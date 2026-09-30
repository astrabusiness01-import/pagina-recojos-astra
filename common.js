/* ==========================================================
   ASTRA · Recojos — utilidades compartidas
   ========================================================== */
(function () {
  const STAR_IMG = '<img class="brand-star" src="assets/astra-star-mark.webp" alt="" />';

  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" ' +
    'stroke="#1a1006" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function header(pillText, pillHref) {
    const pill = pillText
      ? pillHref
        ? `<a class="pill" href="${pillHref}">${pillText}</a>`
        : `<span class="pill">${pillText}</span>`
      : "";
    return `<header class="brand">
      <a class="brand-link" href="index.html">${STAR_IMG}
        <div><div class="brand-name">ASTRA</div><div class="brand-tag">La comunidad de importaciones</div></div>
      </a>${pill}</header>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Normaliza un recojo: cajas como [guia, nombre] o {guia, nombre}
  function totalCajas(r) {
    return r.grupos.reduce((n, g) => n + g.cajas.length, 0);
  }
  function guia(c) { return Array.isArray(c) ? c[0] : c.guia; }
  function nombre(c) { return Array.isArray(c) ? c[1] : c.nombre; }
  // Opcionales: peso en kg (posición 2) y número propio de la caja (posición 3)
  function peso(c) { const v = Array.isArray(c) ? c[2] : c.peso; return typeof v === "number" ? v : null; }
  // ---- Sumas de peso exactas (como Excel) ----
  // Se suma en milésimas enteras para evitar errores de decimales
  // (ej. 38.754999) y se redondea a 2 decimales hacia arriba en .5.
  function kgCajas(cajas) {
    let mil = 0, hay = false;
    cajas.forEach((c) => { const p = peso(c); if (p != null) { mil += Math.round(p * 1000); hay = true; } });
    return hay ? (Math.round(mil / 10) / 100).toFixed(2) : null;
  }
  // Peso total del recojo: suma de sus cajas; si no tienen peso, el peso escrito
  function kgRecojo(r) {
    const todas = [];
    r.grupos.forEach((g) => g.cajas.forEach((c) => todas.push(c)));
    const s = kgCajas(todas);
    if (s !== null) return s;
    return typeof r.pesoKg === "number" ? r.pesoKg.toFixed(2) : null;
  }
  function num(c) { const v = Array.isArray(c) ? c[3] : c.num; return v ? String(v) : null; }

  // Siempre en números: día/mes/año (30/09/2026)
  function fechaLarga(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // ---- Progreso guardado en el navegador (por recojo) ----
  const KEY = (id) => "astra-recojo:" + id;
  function loadDone(id) {
    try {
      const v = JSON.parse(localStorage.getItem(KEY(id)) || "[]");
      return new Set(Array.isArray(v) ? v : []);
    } catch (e) { return new Set(); }
  }
  function saveDone(id, set) {
    try { localStorage.setItem(KEY(id), JSON.stringify([...set])); } catch (e) {}
  }
  function clearDone(id) {
    try { localStorage.removeItem(KEY(id)); } catch (e) {}
  }
  // Cuenta solo guías que siguen existiendo en el recojo
  function countDone(r) {
    const done = loadDone(r.id);
    let n = 0;
    r.grupos.forEach((g) => g.cajas.forEach((c) => { if (done.has(guia(c))) n++; }));
    return n;
  }

  // ---- Modal de confirmación con diseño ASTRA ----
  let modalEl;
  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.className = "modal";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.innerHTML = `<div class="modal-card">
      <div class="modal-icon"></div>
      <h3 class="modal-title"></h3>
      <p class="modal-text"></p>
      <div class="modal-actions"></div></div>`;
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function modal({ title, html, icon = "star", buttons }) {
    const m = ensureModal();
    m.querySelector(".modal-icon").innerHTML =
      icon === "check"
        ? '<svg viewBox="0 0 54 54" fill="none"><circle cx="27" cy="27" r="25" stroke="#F0B400" stroke-width="2.5"/><path d="M16 28l7.5 7.5L39 20" stroke="#D98300" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : icon === "warn"
        ? '<svg viewBox="0 0 54 54" fill="none"><circle cx="27" cy="27" r="25" stroke="#D98300" stroke-width="2.5"/><path d="M27 15v16" stroke="#D98300" stroke-width="3.5" stroke-linecap="round"/><circle cx="27" cy="39" r="2.4" fill="#D98300"/></svg>'
        : '<img src="assets/astra-star-mark.webp" alt="" style="width:54px;height:auto" />';
    m.querySelector(".modal-title").textContent = title;
    m.querySelector(".modal-text").innerHTML = html || "";
    const actions = m.querySelector(".modal-actions");
    actions.innerHTML = "";
    return new Promise((resolve) => {
      const close = (val) => {
        m.classList.remove("open");
        document.removeEventListener("keydown", onKey);
        m.onclick = null;
        resolve(val);
      };
      const onKey = (e) => { if (e.key === "Escape") close(false); };
      buttons.forEach((b) => {
        const el = document.createElement("button");
        el.className = "btn btn-block " + (b.cls || "");
        el.textContent = b.label;
        el.onclick = () => close(b.value);
        actions.appendChild(el);
      });
      m.onclick = (e) => { if (e.target === m) close(false); };
      document.addEventListener("keydown", onKey);
      requestAnimationFrame(() => {
        m.classList.add("open");
        const first = actions.querySelector("button");
        if (first) first.focus({ preventScroll: true });
      });
    });
  }

  function confirmModal(title, html, okLabel, okCls = "btn-primary", icon = "warn") {
    return modal({
      title, html, icon,
      buttons: [
        { label: okLabel, value: true, cls: okCls },
        { label: "Cancelar", value: false }
      ]
    });
  }

  // Marca este navegador como el del administrador (se activa al abrir el panel)
  const ADMIN_KEY = "astra-recojos-admin";
  function isAdmin() {
    try { return localStorage.getItem(ADMIN_KEY) === "1"; } catch (e) { return false; }
  }
  function setAdmin() {
    try { localStorage.setItem(ADMIN_KEY, "1"); } catch (e) {}
  }
  // Barra de navegación superior: volver a recojos y al panel
  function navBar(showRecojos) {
    const links = [];
    if (showRecojos) links.push('<a class="nav-btn" href="index.html">← Recojos</a>');
    // Siempre visible: el panel pide el código del encargado al entrar
    links.push('<a class="nav-btn nav-admin" href="panel.html">⚙ Volver al panel</a>');
    return links.length ? `<nav class="nav-bar">${links.join("")}</nav>` : "";
  }

  // ---- Borrador del encargado ----
  // Se guarda junto con la versión publicada sobre la que se hizo ("base").
  // Si luego se publica una versión nueva, NO se pierde lo que aún no
  // estaba publicado: se conservan los recojos nuevos del borrador.
  const DRAFT_KEY = "astra-recojos-borrador";
  function cargarBorrador() {
    const pub = window.RECOJOS || [];
    const pubTxt = JSON.stringify(pub);
    try {
      const v = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (v && Array.isArray(v.recojos)) {
        if (v.base === pubTxt) return v.recojos;
        const ids = new Set(pub.map((r) => r.id));
        const nuevos = v.recojos.filter((r) => !ids.has(r.id));
        return nuevos.concat(JSON.parse(pubTxt));
      }
    } catch (e) {}
    return JSON.parse(pubTxt);
  }
  function guardarBorrador(recojos) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: JSON.stringify(window.RECOJOS || []), recojos }));
    } catch (e) {}
  }

  // Lista a mostrar: el público ve lo publicado; el admin ve además su borrador
  function recojosVisibles() {
    const pub = window.RECOJOS || [];
    if (!isAdmin()) return { list: pub, sinPublicar: new Set() };
    const list = cargarBorrador();
    const pubMap = new Map(pub.map((r) => [r.id, JSON.stringify(r)]));
    const sinPublicar = new Set(list.filter((r) => pubMap.get(r.id) !== JSON.stringify(r)).map((r) => r.id));
    return { list, sinPublicar };
  }

  // ---- Fechas relativas (se recalculan cada vez que se abre la página) ----
  function diasDesde(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const hoy = new Date();
    const a = Date.UTC(y, m - 1, d);
    const b = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return Math.round((b - a) / 86400000);
  }
  function fechaRelativa(iso) {
    const n = diasDesde(iso);
    if (n === null) return "";
    if (n === 0) return "Hoy";
    if (n === 1) return "Ayer";
    if (n === -1) return "Mañana";
    if (n > 1 && n < 7) return `Hace ${n} días`;
    return fechaLarga(iso);
  }
  // "Hoy · 30/09/2026" / "Ayer · 29/09/2026" / "12/09/2026"
  function fechaCompleta(iso) {
    const rel = fechaRelativa(iso);
    const num = fechaLarga(iso);
    return rel === num ? num : `${rel} · ${num}`;
  }

  // ---- Resumen público de recojos (sin guías): /api/recojos.
  // Si la API no responde (vista previa local), se arma desde recojos-data.js.
  let cargaPromesa = null;
  function resumenLocal(r) {
    return { id: r.id, responsable: r.responsable, fecha: r.fecha, cajas: totalCajas(r), kg: kgRecojo(r) };
  }
  function cargarDatos() {
    if (!cargaPromesa) {
      cargaPromesa = fetch("/api/recojos", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { api.RESUMEN = d && Array.isArray(d.recojos) ? d.recojos : null; })
        .catch(() => { api.RESUMEN = null; })
        .then(() => {
          if (!api.RESUMEN) api.RESUMEN = (window.RECOJOS || []).filter((r) => !r.archivado).map(resumenLocal);
        });
    }
    return cargaPromesa;
  }

  // ---- Detalle de un recojo: solo con su código de acceso ----
  async function abrirRecojo(id, codigo) {
    try {
      const r = await fetch("/api/recojo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, codigo })
      });
      const d = await r.json().catch(() => null);
      if (!d) return { status: 0, error: "No se pudo conectar. Revisa tu internet." };
      return { status: r.status, recojo: r.ok ? d.recojo : null, error: d.error };
    } catch (e) {
      return { status: 0, error: "Sin conexión a internet. Inténtalo de nuevo." };
    }
  }
  const CODE_KEY = (id) => "astra-codigo:" + id;
  function leerCodigo(id) { try { return localStorage.getItem(CODE_KEY(id)) || ""; } catch (e) { return ""; } }
  function guardarCodigo(id, c) { try { localStorage.setItem(CODE_KEY(id), c); } catch (e) {} }
  function borrarCodigo(id) { try { localStorage.removeItem(CODE_KEY(id)); } catch (e) {} }

  // Avance guardado (para mostrarlo en el portal sin pedir las guías)
  const AV_KEY = (id) => "astra-avance:" + id;
  function guardarAvance(id, hechas, total) { try { localStorage.setItem(AV_KEY(id), JSON.stringify({ hechas, total })); } catch (e) {} }
  function leerAvance(id) { try { return JSON.parse(localStorage.getItem(AV_KEY(id))) || null; } catch (e) { return null; } }

  // ---- Mensaje de WhatsApp para el comercial (se envía desde el panel) ----
  // Agrupa los números en rangos: [1,2,3,5] -> "de la 1 a la 3 y la 5"
  function rangos(nums) {
    const ord = nums.slice().sort((a, b) => a - b);
    const partes = [];
    for (let i = 0; i < ord.length; i++) {
      let j = i;
      while (j + 1 < ord.length && ord[j + 1] === ord[j] + 1) j++;
      partes.push(j > i ? `de la ${ord[i]} a la ${ord[j]}` : `la ${ord[i]}`);
      i = j;
    }
    return partes.length > 1 ? partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1] : partes[0] || "";
  }
  function mensajeWsp(recojo) {
    let seq = 0;
    const total = totalCajas(recojo);
    const lineas = recojo.grupos.map((g) => {
      const nums = g.cajas.map((c) => { seq++; return parseInt(num(c) || seq, 10); });
      const k = g.cajas.length;
      return `• *${g.nombre}* (${k} ${k === 1 ? "caja" : "cajas"}): ${rangos(nums)}`;
    });
    const kg = kgRecojo(recojo);
    const fecha = recojo.fecha ? fechaLarga(recojo.fecha) : "";
    let txt = `*ASTRA${fecha ? " · " + fecha : ""}*\n\n`;
    txt += `*PARA EL COMERCIAL:*\n*${recojo.responsable.toUpperCase()} RECOGERÁ:*\n\n${lineas.join("\n")}`;
    txt += `\n\n*En total: ${total} ${total === 1 ? "caja" : "cajas"}${kg ? " (" + kg + " kg)" : ""}*`;
    txt += `\n\n⚠️ Importante: verificar siempre los números de guía y el total de cajas al momento del recojo.`;
    const link = `${location.origin}/recojo.html?id=${encodeURIComponent(recojo.id)}`;
    txt += `\n\n\n📦 Tus guías las podrás visualizar en la página:\n${link}`;
    if (recojo.codigo) txt += `\n🔑 Tu código de acceso: *${recojo.codigo}*`;
    txt += `\n\n🔒 *Este link y código no se comparten con nadie*, por la seguridad de tus cajas.`;
    return txt;
  }
  function abrirWhatsApp(recojo) {
    const tel = /^\d{10,15}$/.test(recojo.telefono || "") ? recojo.telefono : "";
    const a = document.createElement("a");
    a.href = `https://wa.me/${tel}?text=` + encodeURIComponent(mensajeWsp(recojo));
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function listo(fn) { cargarDatos().then(fn); }

  const api = {
    cargarDatos, listo, abrirRecojo, leerCodigo, guardarCodigo, borrarCodigo, guardarAvance, leerAvance, rangos, mensajeWsp, abrirWhatsApp,
    isAdmin, setAdmin, navBar, recojosVisibles, DRAFT_KEY, cargarBorrador, guardarBorrador, diasDesde, fechaRelativa, fechaCompleta,
    STAR_IMG, CHECK_SVG, header, esc, totalCajas, guia, nombre, peso, num, kgCajas, kgRecojo, fechaLarga,
    loadDone, saveDone, clearDone, countDone, modal, confirmModal
  };
  window.Astra = api;
})();
