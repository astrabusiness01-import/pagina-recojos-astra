/* ==========================================================
   ASTRA · Checklist de un recojo
   ========================================================== */
window.Astra.listo(async function () {
  const A = window.Astra;
  const app = document.getElementById("app");
  document.getElementById("header").innerHTML = A.header("Recojo") + A.navBar(true);

  const id = new URLSearchParams(location.search).get("id") || "";
  const res = (A.RESUMEN || []).find((r) => r.id === id);

  function noEncontrado() {
    app.innerHTML = `<h1 class="title">Recojo no encontrado</h1>
      <p class="lead">Es posible que el enlace haya cambiado o que el recojo ya no esté disponible.</p>
      <a class="back" href="index.html">← Ver todos los recojos</a>`;
  }

  // 1) Si este celular ya tiene el código guardado, entra directo
  const guardado = A.leerCodigo(id);
  if (guardado) {
    const r = await A.abrirRecojo(id, guardado);
    if (r.recojo) return mostrar(r.recojo);
    if (r.status === 404) return noEncontrado();
    A.borrarCodigo(id);
  }

  // 2) Pide el código de acceso que el cliente recibió por WhatsApp
  app.innerHTML = `<form class="lock-card" id="codeForm" autocomplete="off">
      <img class="lock-logo" src="assets/astra-star-mark.webp" alt="" />
      <h1 class="modal-title">${res ? "Recojo · " + A.esc(res.responsable) : "Acceso al recojo"}</h1>
      <p class="modal-text">Ingresa el código de 4 dígitos que recibiste por WhatsApp para ver tus guías.</p>
      <input class="lock-input" id="codeInput" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" aria-label="Código de acceso" />
      <div class="lock-err" id="codeErr"></div>
      <button class="btn btn-primary btn-block" type="submit">Ver mis guías</button>
      <a class="back" href="index.html">← Ver todos los recojos</a>
    </form>`;
  const form = document.getElementById("codeForm");
  const input = document.getElementById("codeInput");
  const err = document.getElementById("codeErr");
  const btn = form.querySelector("button");
  input.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const codigo = input.value.trim();
    if (!/^\d{4}$/.test(codigo)) { err.textContent = "El código tiene 4 dígitos."; return; }
    btn.disabled = true;
    btn.textContent = "Verificando…";
    const r = await A.abrirRecojo(id, codigo);
    btn.disabled = false;
    btn.textContent = "Ver mis guías";
    if (r.recojo) { A.guardarCodigo(id, codigo); return mostrar(r.recojo); }
    if (r.status === 404) return noEncontrado();
    err.textContent = r.error || "Código incorrecto. Inténtalo de nuevo.";
    input.value = "";
    input.focus();
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
  });
});

// Muestra el checklist de un recojo ya desbloqueado
function mostrar(recojo) {
  const A = window.Astra;
  const app = document.getElementById("app");
  document.title = `Recojo · ${recojo.responsable} · ASTRA`;
  const total = A.totalCajas(recojo);
  const done = A.loadDone(recojo.id);
  // Limpia guías que ya no existen en la lista actual
  const validas = new Set();
  recojo.grupos.forEach((g) => g.cajas.forEach((c) => validas.add(A.guia(c))));
  [...done].forEach((gu) => { if (!validas.has(gu)) done.delete(gu); });

  const meta = [`${total} ${total === 1 ? "caja" : "cajas"}`];
  const pesoTotal = A.kgRecojo(recojo);
  if (pesoTotal) meta.push(`${pesoTotal} kg`);
  if (recojo.fecha) meta.unshift(A.fechaCompleta(recojo.fecha));
  if (recojo.nota) meta.push(A.esc(recojo.nota));

  let n = 0;
  const gruposHtml = recojo.grupos.map((g) => {
    const filas = g.cajas.map((c) => {
      n++;
      const num = String(A.num(c) || n).padStart(2, "0");
      const kg = A.peso(c);
      const gu = A.guia(c);
      return `<button type="button" class="row${done.has(gu) ? " is-done" : ""}" data-guia="${A.esc(gu)}" data-num="${num}" data-name="${A.esc(A.nombre(c))}" aria-pressed="${done.has(gu)}">
        <span class="row-num">${num}</span>
        <span class="row-body">
          <span class="row-guia">${A.esc(gu)}${kg != null ? `<span class="row-kg">${kg} kg</span>` : ""}</span>
          <span class="row-name">${A.esc(A.nombre(c))}</span>
        </span>
        <span class="check">${A.CHECK_SVG}</span>
      </button>`;
    }).join("");
    const k = g.cajas.length;
    const gkg = A.kgCajas(g.cajas);
    const gkgTxt = gkg ? ` · ${gkg} kg` : "";
    return `<div class="grupo"><div class="group-head"><span class="group-name">${A.esc(g.nombre)}</span>
      <span class="group-count">${k} ${k === 1 ? "caja" : "cajas"}${gkgTxt}</span></div>
      <div class="rows">${filas}</div></div>`;
  }).join("");

  const suma = recojo.grupos.map((g) => g.cajas.length);
  const sumaTxt = suma.length > 1 ? `${suma.join(" + ")} = ${total} cajas` : `${total} ${total === 1 ? "caja" : "cajas"}`;

  app.innerHTML = `
    <h1 class="title">Recojo · ${A.esc(recojo.responsable)}</h1>
    <p class="subtitle">${meta.join('<span class="dot">·</span>')}</p>
    <div class="progress-bar" id="pbar">
      <div class="progress-top">
        <span class="progress-count" id="pcount"></span>
        <span class="progress-pct" id="ppct"></span>
      </div>
      <div class="track"><div class="fill" id="pfill"></div></div>
      <div class="search">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar por 3 últimos dígitos de la guía o nombre" aria-label="Buscar caja" />
        <button type="button" id="qClear" aria-label="Borrar búsqueda" hidden>✕</button>
      </div>
      <div class="search-info" id="qInfo"></div>
    </div>
    <div id="grupos">${gruposHtml}</div>
    <p class="empty" id="qEmpty" hidden>No se encontró ninguna caja con esa búsqueda.</p>
    <div class="total">
      <div class="total-line">Total a recoger: ${sumaTxt}</div>
      <div class="total-note">Si falta alguna caja o no coincide la guía, avisa antes de retirarte.</div>
    </div>
    <div class="actions">
      <button class="btn btn-danger btn-block" id="btnReset">Reiniciar checklist</button>
    </div>
    <a class="back" href="index.html">← Ver todos los recojos</a>`;

  // ---------- Buscador: últimos dígitos de la guía o parte del nombre ----------
  const sinTildes = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = document.getElementById("q");
  const qClear = document.getElementById("qClear");
  function buscar() {
    const t = q.value.trim();
    qClear.hidden = !t;
    const soloDigitos = /^\d+$/.test(t);
    const texto = sinTildes(t);
    let hallados = 0;
    app.querySelectorAll(".grupo").forEach((g) => {
      let visibles = 0;
      g.querySelectorAll(".row").forEach((row) => {
        const ok = !t || (soloDigitos
          ? row.dataset.guia.endsWith(t) || (t.length >= 5 && row.dataset.guia.includes(t))
          : sinTildes(row.dataset.name).includes(texto));
        row.hidden = !ok;
        if (ok) visibles++;
      });
      g.hidden = !visibles;
      hallados += visibles;
    });
    document.getElementById("qEmpty").hidden = !t || hallados > 0;
    document.getElementById("qInfo").textContent = t && hallados ? `${hallados} ${hallados === 1 ? "caja encontrada" : "cajas encontradas"}` : "";
  }
  q.addEventListener("input", buscar);
  qClear.addEventListener("click", () => { q.value = ""; buscar(); q.focus(); });

  // ---------- Sesión: pedir el código otra vez tras 10 minutos fuera ----------
  // Mientras la página está a la vista se renueva el tiempo; al salir a otra app
  // queda registrado el momento, y al volver se revisa si ya vencieron los 10 minutos.
  A.renovarCodigo(recojo.id);
  setInterval(() => { if (document.visibilityState === "visible") A.renovarCodigo(recojo.id); }, 20000);
  function revisarSesion() {
    if (!A.leerCodigo(recojo.id)) location.reload(); // pasaron más de 10 min: vuelve a pedir el código
    else A.renovarCodigo(recojo.id); // volvió a tiempo: el conteo empieza de nuevo
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") A.renovarCodigo(recojo.id);
    else revisarSesion();
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) revisarSesion(); });

  const pbar = document.getElementById("pbar");
  function render() {
    const k = done.size;
    const pct = total ? Math.round((k / total) * 100) : 0;
    document.getElementById("pcount").innerHTML = `<b>${k}</b> de ${total} recogidas`;
    document.getElementById("ppct").textContent = k === total ? "¡Completo!" : pct + "%";
    document.getElementById("pfill").style.width = pct + "%";
    pbar.classList.toggle("done", k === total);
    A.guardarAvance(recojo.id, k, total);
  }
  render();

  function setRow(row, on) {
    row.classList.toggle("is-done", on);
    row.setAttribute("aria-pressed", on);
  }

  app.addEventListener("click", async (e) => {
    const row = e.target.closest(".row");
    if (!row) return;
    const gu = row.dataset.guia;

    if (done.has(gu)) {
      const ok = await A.confirmModal(
        "¿Desmarcar caja?",
        `¿Seguro que quieres desmarcar la caja <b>${A.esc(row.dataset.num)} – ${A.esc(row.dataset.name)}</b>?`,
        "Sí, desmarcar"
      );
      if (!ok) return;
      done.delete(gu);
      setRow(row, false);
      A.saveDone(recojo.id, done);
      render();
      return;
    }

    done.add(gu);
    setRow(row, true);
    A.saveDone(recojo.id, done);
    render();
    if (navigator.vibrate) navigator.vibrate(15);

    if (done.size === total) {
      await A.modal({
        title: "Recojo completo",
        html: `Se recogieron las <b>${total} cajas</b>. ¡Buen trabajo, ${A.esc(recojo.responsable)}!`,
        icon: "check",
        buttons: [{ label: "Listo", value: true, cls: "btn-primary" }]
      });
    }
  });

  document.getElementById("btnReset").addEventListener("click", async () => {
    if (!done.size) return;
    const ok = await A.confirmModal(
      "¿Reiniciar checklist?",
      `Se borrarán las <b>${done.size}</b> cajas marcadas en este celular. Esta acción no se puede deshacer.`,
      "Sí, reiniciar",
      "btn-primary"
    );
    if (!ok) return;
    done.clear();
    A.clearDone(recojo.id);
    app.querySelectorAll(".row.is-done").forEach((r) => setRow(r, false));
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
