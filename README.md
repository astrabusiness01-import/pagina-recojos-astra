# Página Recojos ASTRA

Portal de recojos de ASTRA Importaciones: cada persona abre su recojo, marca las cajas a medida que las recibe y envía el listado por WhatsApp.

- **Portal (link para compartir):** https://pagina-recojos-astra.vercel.app
- **Panel del encargado:** botón «⚙ Volver al panel» (pide código).

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Portal: recojos de Hoy / Ayer / Anteriores |
| `recojo.html` + `recojo.js` | Checklist de un recojo y envío por WhatsApp |
| `panel.html` + `panel.js` | Panel: pegar lista de Excel, guardar y publicar |
| `common.js`, `styles.css` | Utilidades y estilos de marca ASTRA |
| `api/recojos.js` | GET: lista publicada (Vercel Blob privado) |
| `api/publicar.js` | POST: publica la lista (valida el código del encargado) |
| `recojos-data.js` | Respaldo estático si la API no responde |

## Publicar cambios de código

`git push` a `main` → Vercel despliega solo.
