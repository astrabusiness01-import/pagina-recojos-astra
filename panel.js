/* ==========================================================
   ASTRA · Panel de recojos
   Crea recojos desde la lista de Excel, los publica y envía
   a cada comercial su listado, link y código por WhatsApp.
   ========================================================== */
function iniciarPanel(pin) {
  const A = window.Astra;
  const DRAFT_KEY = A.DRAFT_KEY;
  A.setAdmin();
  document.getElementById("header").innerHTML = A.header("Ver portal de recojos", "index.html");

  const $ = (id) => document.getElementById(id);

  let PUBLICADO = JSON.stringify(window.RECOJOS || []);

  const loadDraft = () => A.cargarBorrador();
  const saveDraft = () => A.guardarBorrador(recojos);
  function hasLocalChanges() {
    return JSON.stringify(recojos) !== PUBLICADO;
  }

  let recojos = loadDraft();
  let editingId = null;

  // ---------- Lector de la lista pegada ----------
  // Acepta dos formatos y de cada fila solo toma: número, guía, nombre y peso.
  //  a) Filas copiadas de Excel (con tabulaciones), incluso con tablas lado a lado:
  //     24 <TAB> 511010109567 <TAB> ARACELI ... <TAB> 1 <TAB> 2.86 <TAB> nota
  //     Se ignoran la cantidad, las notas y las filas de totales.
  //  b) Texto: "GRUPO 1" en su línea y debajo "guía - nombre" (opcional "- 2.86 kg").
  const RE_GUIA = /^\d{9,}$/;
  const RE_NUM = /^\d+(?:[.,]\d+)?$/;
  const MINUS = ["de", "del", "la", "las", "los", "y", "e", "-"];

  function limpiaNombre(s) {
    s = s.replace(/\s+/g, " ").trim();
    if (s !== s.toUpperCase()) return s; // ya viene con mayúsculas y minúsculas
    return s.toLowerCase().split(" ").map((w, i) =>
      i > 0 && MINUS.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
    ).join(" ");
  }
  const num = (s) => parseFloat(String(s).replace(",", "."));

  function parseLista(text) {
    const grupos = [];
    const abiertos = new Map(); // columna -> grupo abierto
    let nombrePendiente = null;
    let pesoTotal = null;
    const avisos = [];
    const vistas = new Set();
    let orden = 0;

    function grupoEn(col) {
      if (!abiertos.has(col)) {
        const g = { nombre: nombrePendiente, cajas: [], col, orden: orden++ };
        nombrePendiente = null;
        grupos.push(g);
        abiertos.set(col, g);
      }
      return abiertos.get(col);
    }
    function agrega(col, n, gu, nom, peso, linea) {
      if (vistas.has(gu)) avisos.push(`La guía ${gu} está repetida (línea ${linea}).`);
      vistas.add(gu);
      const caja = [gu, limpiaNombre(nom)];
      if (peso != null && !isNaN(peso)) caja[2] = peso;
      if (n) caja[3] = n;
      const g = grupoEn(col);
      g.cajas.push(caja);
      return g;
    }

    text.split(/\r?\n/).forEach((raw, idx) => {
      const linea = idx + 1;
      const line = raw.replace(/ /g, " ");

      // a) Formato Excel (tabulaciones)
      if (line.includes("\t")) {
        const cells = line.split("\t").map((c) => c.trim());
        const usadas = new Set();
        cells.forEach((c, i) => {
          if (!RE_GUIA.test(c)) return;
          const nom = cells[i + 1] || "";
          if (!nom || RE_NUM.test(nom)) return;
          const n = /^\d{1,4}$/.test(cells[i - 1] || "") ? cells[i - 1] : null;
          // Tras el nombre vienen cantidad y peso: se toma el peso
          const nums = [];
          for (let j = i + 2; j < Math.min(cells.length, i + 5); j++) {
            if (RE_GUIA.test(cells[j])) break;
            if (RE_NUM.test(cells[j])) nums.push(cells[j]);
            else if (cells[j]) break;
          }
          let peso = null;
          if (nums.length >= 2) peso = num(nums[1]);
          else if (nums.length === 1 && /[.,]/.test(nums[0])) peso = num(nums[0]);
          const g = agrega(i, n, c, nom, peso, linea);
          usadas.add(i);
          // Nota de texto al costado (ej. "angie rey") = nombre del grupo.
          // Se ignoran notas numéricas ("10", "8.5") y las de "pick".
          if (!g.nombre) {
            for (let j = i + 2; j < cells.length && !RE_GUIA.test(cells[j]); j++) {
              const t = cells[j];
              if (!t || RE_NUM.test(t) || /^p[i]?c?k\b/i.test(t)) continue;
              if (RE_GUIA.test(cells[j + 1] || "") || RE_NUM.test(t.replace(/\s+/g, ""))) break;
              g.nombre = nombreNota(t);
              break;
            }
          }
        });
        // Cierra los grupos de las columnas que en esta fila no tienen caja
        [...abiertos.keys()].forEach((col) => { if (!usadas.has(col)) abiertos.delete(col); });
        if (!usadas.size) {
          const texto = cells.filter(Boolean);
          if (texto.length === 1 && !RE_NUM.test(texto[0])) nombrePendiente = tituloGrupo(texto[0]);
        }
        return;
      }

      // b) Formato texto
      const t = line.trim();
      if (!t) { abiertos.clear(); return; }
      if (/^total\b/i.test(t)) {
        const m = t.match(/([\d.,]+)\s*kg/i);
        if (m) pesoTotal = num(m[1]);
        abiertos.clear();
        return;
      }
      const m = t.match(/^(?:(\d{1,4})[.)]?\s+)?(\d{9,})\s*[-–—:|]?\s*(.+)$/);
      if (m) {
        let rest = m[3];
        let peso = null;
        const pm = rest.match(/\s*[-–—|·]\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*$/i);
        if (pm) { peso = num(pm[1]); rest = rest.slice(0, pm.index); }
        agrega("txt", m[1] || null, m[2], rest, peso, linea);
        return;
      }
      if (RE_NUM.test(t.replace(/\s+/g, ""))) { abiertos.clear(); return; } // fila de totales
      abiertos.clear();
      nombrePendiente = tituloGrupo(t);
    });

    // Orden: columna izquierda primero, luego las de la derecha
    const colKey = (g) => (g.col === "txt" ? -1 : g.col);
    const validos = grupos.filter((g) => g.cajas.length)
      .sort((a, b) => colKey(a) - colKey(b) || a.orden - b.orden);

    // Nombres automáticos: casilleros (guías 511000...) y grupos
    const esCasillero = (g) => g.cajas.every((c) => /^5110000/.test(c[0]));
    const sinNombreCas = validos.filter((g) => !g.nombre && esCasillero(g));
    let kG = 0, kC = 0;
    validos.forEach((g) => {
      if (g.nombre) return;
      if (esCasillero(g)) g.nombre = sinNombreCas.length > 1 ? `Casillero ${++kC}` : "Casillero";
      else g.nombre = `Grupo ${++kG}`;
    });

    const limpios = validos.map((g) => ({ nombre: g.nombre, cajas: g.cajas }));
    const pesoCajas = sumaPeso(limpios);
    return { grupos: limpios, peso: pesoTotal || pesoCajas || null, avisos };
  }

  function nombreNota(s) {
    return limpiaNombre(s.replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").toUpperCase());
  }

  function tituloGrupo(s) {
    const n = s.replace(/\(.*?\)/g, "").replace(/[:\-–—]+$/, "").trim();
    return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : null;
  }

  function sumaPeso(grupos) {
    const todas = [];
    grupos.forEach((g) => g.cajas.forEach((c) => todas.push(c)));
    const s = A.kgCajas(todas);
    return s ? parseFloat(s) : 0;
  }

  function listaToText(r) {
    return r.grupos
      .map((g) => g.nombre.toUpperCase() + "\n" + g.cajas.map((c) => {
        const n = A.num(c) ? A.num(c) + " " : "";
        const p = A.peso(c) != null ? ` - ${A.peso(c)} kg` : "";
        return `${n}${A.guia(c)} - ${A.nombre(c)}${p}`;
      }).join("\n"))
      .join("\n\n");
  }

  // ---------- Vista previa ----------
  function renderPreview() {
    const txt = $("fLista").value;
    const box = $("preview");
    if (!txt.trim()) { box.innerHTML = ""; $("fPeso").textContent = "—"; return; }
    const { grupos, peso, avisos } = parseLista(txt);
    $("fPeso").textContent = peso ? `${Number(peso).toFixed(2)} kg` : "—";
    const total = grupos.reduce((n, g) => n + g.cajas.length, 0);
    const kg = (gs) => { const s = sumaPeso(gs); return s ? ` · ${s.toFixed(2)} kg` : ""; };
    const rango = (g) => {
      const ns = g.cajas.map((c) => c[3]).filter(Boolean);
      return ns.length ? ` <span class="li-meta">(${ns[0]}–${ns[ns.length - 1]})</span>` : "";
    };
    box.innerHTML =
      grupos.map((g) => `<div class="preview-group"><span>${A.esc(g.nombre)}${rango(g)}</span><span>${g.cajas.length} ${g.cajas.length === 1 ? "caja" : "cajas"}${kg([g])}</span></div>`).join("") +
      `<div class="preview-group" style="background:rgba(232,149,47,.15)"><b>Total</b><b>${total} ${total === 1 ? "caja" : "cajas"}${kg(grupos)}</b></div>` +
      avisos.map((a) => `<div class="preview-warn">⚠ ${A.esc(a)}</div>`).join("");
  }
  $("fLista").addEventListener("input", renderPreview);

  // ---------- Formulario ----------
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  // Número de WhatsApp: solo dígitos; 9 dígitos que empiezan en 9 = celular de Perú (+51).
  // Devuelve "" si está vacío y false si no es válido.
  function normalizaTel(v) {
    const d = String(v || "").replace(/\D/g, "");
    if (!d) return "";
    if (/^9\d{8}$/.test(d)) return "51" + d;
    return /^\d{10,15}$/.test(d) ? d : false;
  }
  function slug(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recojo";
  }
  function resetForm() {
    editingId = null;
    $("formTitle").textContent = "Nuevo recojo";
    $("btnSave").textContent = "Guardar y publicar";
    $("btnCancel").hidden = true;
    ["fResp", "fNota", "fTel", "fLista"].forEach((k) => ($(k).value = ""));
    $("fPeso").textContent = "—";
    $("fNota").value = "1 caja por guía";
    $("fFecha").value = today();
    renderPreview();
  }

  function flash(el, msg) {
    $(el).textContent = msg;
    clearTimeout(flash[el]);
    flash[el] = setTimeout(() => ($(el).textContent = ""), 4000);
  }

  $("btnSave").addEventListener("click", async () => {
    const responsable = $("fResp").value.trim();
    const { grupos, peso } = parseLista($("fLista").value);
    if (!responsable) { flash("formStatus", "Escribe el nombre de quien recoge."); $("fResp").focus(); return; }
    if (!grupos.length) { flash("formStatus", "La lista no tiene cajas válidas."); $("fLista").focus(); return; }
    const telefono = normalizaTel($("fTel").value);
    if (telefono === false) { flash("formStatus", "Revisa el número de WhatsApp: deben ser 9 dígitos (Perú) o el número con código de país."); $("fTel").focus(); return; }

    const data = {
      responsable,
      fecha: $("fFecha").value || today(),
      pesoKg: peso || null, // calculado de la lista
      nota: $("fNota").value.trim(),
      telefono: telefono || undefined,
      grupos
    };

    let savedId = editingId;
    if (editingId) {
      const r = recojos.find((x) => x.id === editingId);
      Object.assign(r, data);
    } else {
      let id = slug(responsable) + "-" + data.fecha;
      let k = 2;
      while (recojos.some((x) => x.id === id)) id = `${slug(responsable)}-${data.fecha}-${k++}`;
      recojos.unshift(Object.assign({ id }, data));
      savedId = id;
    }
    saveDraft();
    const btn = $("btnSave");
    const ok = await conPublicacion(btn, null);
    resetForm();
    if (!ok) { flash("formStatus", "Se guardó, pero aún no se publicó. Toca «Publicar» junto al recojo en la lista."); return; }
    await trasPublicar(savedId);
  });

  $("btnCancel").addEventListener("click", resetForm);

  // ---------- Lista de recojos ----------
  function recojoSinPublicar(r) {
    const pub = (window.RECOJOS || []).find((x) => x.id === r.id);
    return !pub || JSON.stringify(pub) !== JSON.stringify(r);
  }
  // Solo los recojos de hoy (o sin publicar) se muestran a la vista;
  // los de días anteriores quedan plegados para que el panel no se llene.
  let verAnteriores = false;
  function renderList() {
    const box = $("list");
    if (!recojos.length) { box.innerHTML = '<p class="empty" style="padding:12px 0">Aún no hay recojos.</p>'; return; }
    const ordenados = recojos.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const esDeHoy = (r) => { const n = A.diasDesde(r.fecha); return n !== null && n <= 0; };
    const hoy = ordenados.filter((r) => esDeHoy(r) || recojoSinPublicar(r));
    const antes = ordenados.filter((r) => !hoy.includes(r));
    const item = (r) => {
      const total = A.totalCajas(r);
      return `<div class="list-item" data-id="${A.esc(r.id)}">
        <div>
          <div class="li-title">${A.esc(r.responsable)}${r.archivado ? ' <span class="li-meta">(oculto)</span>' : ""}</div>
          <div class="li-meta">${total} ${total === 1 ? "caja" : "cajas"} · ${A.fechaCompleta(r.fecha)}${recojoSinPublicar(r) ? ' · <b style="color:var(--gold)">sin publicar</b>' : ""}</div>
          ${r.codigo ? `<div class="li-code">🔑 Código: <b>${A.esc(r.codigo)}</b>${r.telefono ? ` · 📱 +${A.esc(r.telefono)}` : ""}</div>` : ""}
        </div>
        <div class="li-actions">
          ${recojoSinPublicar(r) ? '<button class="btn btn-sm btn-primary" data-act="pub">Publicar</button>' : '<button class="btn btn-sm btn-wsp" data-act="wsp">WhatsApp</button>'}
          <button class="btn btn-sm" data-act="edit">Editar</button>
          <button class="btn btn-sm" data-act="arch">${r.archivado ? "Mostrar" : "Ocultar"}</button>
          <button class="btn btn-sm btn-danger" data-act="del">Borrar</button>
        </div></div>`;
    };
    box.innerHTML =
      (hoy.length ? hoy.map(item).join("") : '<p class="empty" style="padding:8px 0">Hoy aún no hay recojos.</p>') +
      (antes.length
        ? `<details class="older"${verAnteriores ? " open" : ""}>
            <summary>Recojos anteriores (${antes.length})</summary>
            ${antes.map(item).join("")}
          </details>`
        : "");
    const det = box.querySelector("details.older");
    if (det) det.addEventListener("toggle", () => { verAnteriores = det.open; });
  }

  $("list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest(".list-item").dataset.id;
    const r = recojos.find((x) => x.id === id);
    if (!r) return;

    if (btn.dataset.act === "wsp") {
      A.abrirWhatsApp(r);
    } else if (btn.dataset.act === "pub") {
      if (await conPublicacion(btn, null)) await trasPublicar(id);
    } else if (btn.dataset.act === "edit") {
      editingId = id;
      $("formTitle").textContent = "Editar recojo · " + r.responsable;
      $("btnSave").textContent = "Guardar cambios y publicar";
      $("btnCancel").hidden = false;
      $("fResp").value = r.responsable;
      $("fFecha").value = r.fecha || "";
      $("fNota").value = r.nota || "";
      $("fTel").value = r.telefono || "";
      $("fLista").value = listaToText(r);
      renderPreview();
      $("formTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (btn.dataset.act === "arch") {
      r.archivado = !r.archivado;
      if (!r.archivado) delete r.archivado;
      saveDraft();
      await conPublicacion(btn, null);
    } else if (btn.dataset.act === "del") {
      const ok = await A.confirmModal("¿Borrar recojo?", `Se eliminará el recojo de <b>${A.esc(r.responsable)}</b> (${A.fechaLarga(r.fecha)}).`, "Sí, borrar");
      if (!ok) return;
      recojos = recojos.filter((x) => x.id !== id);
      if (editingId === id) resetForm();
      saveDraft();
      await conPublicacion(null, null);
    }
  });

  // ---------- Publicar ----------
  function buildFile() {
    const body = recojos.map((r) => {
      const grupos = r.grupos.map((g) => {
        const cajas = g.cajas.map((c) => {
          const arr = [A.guia(c), A.nombre(c)];
          if (A.peso(c) != null || A.num(c)) arr[2] = A.peso(c);
          if (A.num(c)) arr[3] = A.num(c);
          return `          ${JSON.stringify(arr)}`;
        }).join(",\n");
        return `      {\n        nombre: ${JSON.stringify(g.nombre)},\n        cajas: [\n${cajas}\n        ]\n      }`;
      }).join(",\n");
      const lines = [
        `    id: ${JSON.stringify(r.id)}`,
        `    responsable: ${JSON.stringify(r.responsable)}`,
        `    fecha: ${JSON.stringify(r.fecha)}`,
        `    pesoKg: ${r.pesoKg == null ? "null" : r.pesoKg}`,
        `    nota: ${JSON.stringify(r.nota || "")}`
      ];
      if (r.archivado) lines.push("    archivado: true");
      lines.push(`    grupos: [\n${grupos}\n    ]`);
      return `  {\n${lines.join(",\n")}\n  }`;
    }).join(",\n");
    return `/* ==========================================================
   DATOS DE RECOJOS — ASTRA
   Este es el único archivo que cambia en cada recojo.
   Lo más fácil: créalo desde panel.html y reemplaza este archivo.
   ========================================================== */
window.RECOJOS = [
${body}
];
`;
  }

  // Envía la lista completa al servidor. Devuelve true si se publicó.
  async function enviar() {
    let r;
    try {
      r = await fetch("/api/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, recojos })
      });
    } catch (e) {
      throw new Error("Sin conexión a internet. Revisa tu señal e inténtalo de nuevo.");
    }
    const d = await r.json().catch(() => null);
    if (!d) throw new Error("Aquí no se puede publicar. Abre el panel desde astra-recojos.vercel.app.");
    if (!r.ok) throw new Error(d.error || "No se pudo publicar.");
    window.RECOJOS = d.recojos;
    PUBLICADO = JSON.stringify(d.recojos);
    recojos = JSON.parse(PUBLICADO);
    saveDraft();
  }

  // Tras publicar un recojo: enviar su WhatsApp (con código) y/o ir al portal de recojos
  async function trasPublicar(id) {
    const r = recojos.find((x) => x.id === id);
    if (!r) { location.href = "index.html"; return; }
    const destino = r.telefono ? ` a <b>+${A.esc(r.telefono)}</b>` : "";
    const opcion = await A.modal({
      title: "¡Publicado!",
      html: `El recojo de <b>${A.esc(r.responsable)}</b> ya está en el portal.<br>Código de acceso: <b>${A.esc(r.codigo || "")}</b><br><br>Envía el listado y el código${destino} por WhatsApp.`,
      icon: "check",
      buttons: [
        { label: "Enviar por WhatsApp y ver recojos", value: "wsp", cls: "btn-wsp" },
        { label: "Ir al portal de recojos", value: "portal", cls: "btn-primary" }
      ]
    });
    if (opcion === "wsp") A.abrirWhatsApp(r);
    // Pequeña pausa para que el celular abra WhatsApp antes de cambiar de página
    setTimeout(() => { location.href = "index.html"; }, opcion === "wsp" ? 600 : 0);
  }

  // Publica mostrando "Publicando…" en el botón usado; si falla, ofrece reintentar.
  async function conPublicacion(btn, exito) {
    const texto = btn ? btn.textContent : "";
    for (;;) {
      if (btn && btn.isConnected) { btn.disabled = true; btn.textContent = "Publicando…"; }
      let error = null;
      try { await enviar(); } catch (e) { error = e.message; }
      if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = texto; }
      renderList();
      if (!error) {
        if (exito) await A.modal({ title: "¡Publicado!", html: exito, icon: "check", buttons: [{ label: "Listo", value: true, cls: "btn-primary" }] });
        return true;
      }
      const otraVez = await A.modal({
        title: "No se pudo publicar",
        html: A.esc(error) + "<br><br>Tu recojo quedó guardado en este celular.",
        icon: "warn",
        buttons: [{ label: "Reintentar", value: true, cls: "btn-primary" }, { label: "Cerrar", value: false }]
      });
      if (!otraVez) return false;
    }
  }

  $("btnDownload").addEventListener("click", () => {
    const blob = new Blob([buildFile()], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "recojos-data.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash("pubStatus", "Archivo descargado.");
  });

  $("btnCopy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(buildFile());
      flash("pubStatus", "Contenido copiado al portapapeles.");
    } catch (e) {
      flash("pubStatus", "No se pudo copiar. Usa el botón de descarga.");
    }
  });

  $("btnRevert").addEventListener("click", async () => {
    if (!hasLocalChanges()) { flash("pubStatus", "No hay cambios locales."); return; }
    const ok = await A.confirmModal("¿Descartar cambios?", "Se volverá a la lista publicada actualmente y se perderán los cambios hechos en este navegador.", "Sí, descartar");
    if (!ok) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    recojos = JSON.parse(PUBLICADO);
    resetForm();
    renderList();
    flash("pubStatus", "Se restauró la lista publicada.");
  });

  resetForm();
  renderList();
}

/* ---------- Acceso con código del encargado ----------
   El código lo verifica el servidor (/api/admin); no se guarda en esta página. */
(function () {
  const lock = document.getElementById("lock");
  const form = document.getElementById("lockForm");
  const input = document.getElementById("lockPin");
  const err = document.getElementById("lockErr");
  const btn = form.querySelector("button");

  document.getElementById("lockHeader").innerHTML = window.Astra.header();
  input.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = input.value.trim();
    if (!pin) return;
    btn.disabled = true;
    btn.textContent = "Verificando…";
    let r, d;
    try {
      r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      d = await r.json().catch(() => null);
    } catch (e2) { d = null; }
    btn.disabled = false;
    btn.textContent = "Entrar";
    if (r && r.ok && d && Array.isArray(d.recojos)) {
      window.RECOJOS = d.recojos; // lista completa publicada (con códigos)
      lock.remove();
      document.body.classList.remove("is-locked");
      iniciarPanel(pin);
      return;
    }
    err.textContent = !d
      ? "Sin conexión con el servidor. Abre el panel desde pagina-recojos-astra.vercel.app."
      : d.error || "Código incorrecto. Inténtalo de nuevo.";
    input.value = "";
    input.focus();
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
  });
})();
