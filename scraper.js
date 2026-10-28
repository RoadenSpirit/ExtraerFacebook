const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Target-Based Facebook Comment and Like Scraper.
 * Dynamically detects total target comments and reactions from the post header,
 * then scrolls and clicks expansion buttons until the target count is satisfied.
 * Deep scroll enabled for both comment feed (up to 130 steps) and reactions modal (up to 90 steps).
 * 
 * @param {string} url - Facebook post URL
 * @param {number} maxComments - Maximum cap for comments (default 5000)
 * @returns {Promise<{success: boolean, url: string, targetComments: number, total: number, uniquePersons: number, likesDetected: number, comments: Array}>}
 */
async function scrapeFacebookComments(url, maxComments = 5000) {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-notifications',
      '--disable-blink-features=AutomationControlled',
      '--lang=es-ES,es'
    ]
  });

  const context = await browser.newContext();

  // Cargar cookies guardadas si existen (soporta entorno container /data o local)
  const cookiePaths = ['/data/REDACTED_COOKIES', '/opt/n8ncarmay/REDACTED_COOKIES', path.join(__dirname, 'REDACTED_COOKIES')];
  for (const cPath of cookiePaths) {
    if (fs.existsSync(cPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cPath, 'utf8'));
        await context.addCookies(cookies);
        console.log(`Cookies cargadas desde: ${cPath}`);
        break;
      } catch (err) {
        console.error(`Error al cargar cookies de ${cPath}:`, err.message);
      }
    }
  }

  const page = await context.newPage();
  
  try {
    console.log(`Navegando directamente a la publicación: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Cambiar a "Todos los comentarios"
    try {
      const filterBtn = page.locator('div[role="button"]:has-text("Most relevant"), div[role="button"]:has-text("Más relevantes")');
      if (await filterBtn.count() > 0) {
        await filterBtn.first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);
        const allOption = page.locator('div[role="menuitem"]:has-text("All comments"), div[role="menuitem"]:has-text("Todos los comentarios")');
        if (await allOption.count() > 0) {
          await allOption.first().click({ force: true }).catch(() => {});
          console.log('Filtro cambiado a Todos los comentarios!');
          await page.waitForTimeout(2500);
        }
      }
    } catch (e) {
      console.log('Filtro de comentarios ya seleccionado o no requerido:', e.message);
    }

    // Sistema de Target: Detectar número objetivo de comentarios publicado en el encabezado
    const detectedTarget = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span, div, a'));
      for (const span of spans) {
        const txt = span.innerText ? span.innerText.trim() : '';
        const match = txt.match(/^([\d.,Kk]+)\s*(comentarios|comments)$/i);
        if (match) {
          let raw = match[1].toUpperCase().replace(',', '.');
          if (raw.endsWith('K')) {
            return Math.round(parseFloat(raw.replace('K', '')) * 1000);
          }
          return parseInt(raw.replace(/\./g, ''), 10) || 1000;
        }
      }
      return 1000;
    });

    const targetComments = Math.min(detectedTarget, maxComments);
    console.log(`[Sistema Target] Meta objetivo detectada: ${targetComments} comentarios (Total anunciado en post: ${detectedTarget})`);

    const allComments = [];
    const seenKeys = new Set();
    const uniquePersonsSet = new Set();
    let noNewCount = 0;
    let lastTotal = 0;

    // Bucle de desplazamiento basado en Target (hasta 130 pasadas o cumplir la meta)
    for (let s = 0; s < 130; s++) {
      // 1. Scroll en ventana y en todos los divs internos con scrollbar
      await page.evaluate(() => {
        window.scrollBy(0, 2500);
        const scrollables = Array.from(document.querySelectorAll('div')).filter(el => {
          const style = window.getComputedStyle(el);
          return (style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight;
        });
        scrollables.forEach(div => { div.scrollTop += 2500; });
      });

      // 2. Hacer clic automático en botones de "Ver más comentarios" o "Ver más respuestas"
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('span, div[role="button"], a'));
        for (const b of btns) {
          const txt = b.innerText ? b.innerText.trim() : '';
          if (/ver\s*[\d.]*\s*comentario|view\s*[\d.]*\s*comment|ver\s*[\d.]*\s*respuestas?|view\s*[\d.]*\s*replies|ver\s*comentarios\s*anteriores/i.test(txt)) {
            try { b.click(); } catch(e) {}
          }
        }
      });

      const currentChunk = await page.evaluate(() => {
        const results = [];
        const footer = document.querySelector('footer, #pageFooter');

        const isInvalidName = (str) => {
          if (!str || str.length < 2 || str.length > 50 || str.includes('\n')) return true;
          if (/^\d+\s*[hmsd]/i.test(str)) return true;
          if (/^\d+\s*(min|semana|sem|día|dia|hora)/i.test(str)) return true;

          const lower = str.toLowerCase();
          if (lower.includes('carmay outfit') || lower.includes('carmayoutfit') || lower.includes('alvaro ruiz') || lower.includes('alvaroruiz')) return true;
          if (/\.(com|net|org|io|ai|co|es|site|xyz|info|online|store|shop|me|biz|live|tech|app|dev)\b/i.test(str)) return true;
          if (/https?:\/\/|www\./i.test(str)) return true;

          if (/^(Amigos|Recuerdos|Guardado|Grupos|Reels|Marketplace|Feeds|Eventos|Notificaciones|Mensajes|Páginas|Paginas|Historias|Guardados|Ver más|Ver menos|Explorar|Crear historia|Cinépolis|Productos Yamrac|Log In|Forgot Account|Go to|Visit|Me gusta|Responder|Compartir|Ver|Seguir|Relevantes|Registrarte|Iniciar|Información|Ayuda|Condiciones|Cookies|Opciones|English|Español|Français|Português|Italiano|Deutsch|Meta|Instagram|Threads|Vídeo|Messenger|Subir|Centro|Privacidad|Crear|Desarrolladores|Empleo|Sign Up|More languages|Facebook Lite|Video|Ray-Ban|Policy|Careers|Terms|Help|Contact|GIPHY|Top fan|Autor|Author)/i.test(str)) return true;
          return false;
        };

        const isInvalidCommentText = (str, autorStr) => {
          if (!str || str.length < 2 || str.length > 1500) return true;
          if (str.trim().toLowerCase() === autorStr.trim().toLowerCase()) return true;

          if (/^(Me gusta|Responder|Compartir|\d+\s*[hmsd]|Hace|Top fan|Seguir|\d+\s*Reply|\d+\s*Respuesta|·|English|Español|Français|Português|Sign Up|Registrarte|Log In|No|Sí|Yes|Cancel|Close|Cerrar|Crear historia|Cinépolis|CARMAY OUTFITS)/i.test(str)) return true;
          if (/^[a-zA-Z0-9-]+\.(com|net|org|io|ai|co|es|site|xyz|info|online|store|shop|me|biz|live|tech|app|dev)$/i.test(str.trim())) return true;
          if (/^https?:\/\/\S+$/i.test(str.trim())) return true;

          return false;
        };

        const userLinks = Array.from(document.querySelectorAll('a[role="link"], h3 a, h4 a, a[href*="/people/"]')).filter(link => {
          if (footer && footer.contains(link)) return false;
          return true;
        });

        for (const link of userLinks) {
          const autor = link.innerText.trim();
          if (isInvalidName(autor)) continue;

          let container = link.parentElement;
          for (let i = 0; i < 6; i++) {
            if (!container || container.tagName === 'BODY') break;
            const textSpans = Array.from(container.querySelectorAll('div[dir="auto"], span[dir="auto"]'))
              .map(el => el.innerText.trim())
              .filter(txt => !isInvalidCommentText(txt, autor));

            const tagLinks = Array.from(container.querySelectorAll('a[role="link"], a[href*="/people/"], a[href*="profile.php"]'))
              .map(a => a.innerText.trim())
              .filter(txt => txt && txt !== autor && !isInvalidName(txt));

            if (textSpans.length > 0) {
              const comentario = textSpans[0];
              if (!isInvalidCommentText(comentario, autor)) {
                results.push({ nombre: autor, comentario, etiquetas_dom: Array.from(new Set(tagLinks)) });
              }
              break;
            }
            container = container.parentElement;
          }
        }
        return results;
      });

      for (const item of currentChunk) {
        const key = `${item.nombre}:::${item.comentario}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allComments.push(item);
          uniquePersonsSet.add(item.nombre.trim().toLowerCase());
        }
      }

      // Verificación de cumplimiento de meta Target
      if (allComments.length >= targetComments) {
        console.log(`[Sistema Target] Meta alcanzada: ${allComments.length} comentarios extraídos (Target: ${targetComments}).`);
        break;
      }

      if (allComments.length === lastTotal) {
        noNewCount++;
        if (noNewCount >= 10) {
          console.log(`[Sistema Target] Límite final de comentarios disponibles cargados en el DOM (${allComments.length} comentarios).`);
          break;
        }
      } else {
        noNewCount = 0;
        lastTotal = allComments.length;
      }

      await page.keyboard.press('PageDown');
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(200);
    }

    console.log(`[Sistema Target] Comentarios crudos extraídos: ${allComments.length} (${uniquePersonsSet.size} personas únicas). Extrayendo reacciones / likes...`);

    // Volver arriba para abrir el modal de reacciones
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Selector universal de botón de reacciones
    const reactionsBtn = page.locator('[aria-label*="reaccionado"], [aria-label*="reacted"], [aria-label*="reacciones"], [aria-label*="reactions"], span[role="toolbar"]');
    const likersSet = new Set();

    if (await reactionsBtn.count() > 0) {
      await reactionsBtn.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);

      let noNewLikers = 0;
      let lastLikerCount = 0;

      // Desplazarse por el modal de reacciones (hasta 90 iteraciones para abarcar ~1400+ likes)
      for (let i = 0; i < 90; i++) {
        const names = await page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"]');
          if (!dialog) return [];

          const links = Array.from(dialog.querySelectorAll('a[role="link"]'));
          if (links.length > 0) {
            links[links.length - 1].scrollIntoView();
          }

          const res = [];
          for (const l of links) {
            const txt = l.innerText ? l.innerText.trim() : '';
            if (txt && !txt.includes('\n') && txt.length < 50 && !/^\d+\s*[hmsd]/i.test(txt) && !/^(Carmay Outfit|Alvaro Ruiz|Seguir|Follow|Add Friend|Agregar|Ver|Log In)/i.test(txt)) {
              res.push(txt.toLowerCase());
            }
          }
          return res;
        });

        names.forEach(n => likersSet.add(n));

        if (likersSet.size === lastLikerCount) {
          noNewLikers++;
          if (noNewLikers >= 8) {
            console.log(`[Sistema Target] Modal de reacciones completo (${likersSet.size} usuarios con Like capturados).`);
            break;
          }
        } else {
          noNewLikers = 0;
          lastLikerCount = likersSet.size;
        }

        await page.waitForTimeout(200);
      }
    }

    console.log(`[Sistema Target] Reacciones capturadas en modal: ${likersSet.size}`);

    // Asignar campo dio_like a cada participante
    const finalResults = allComments.map(c => {
      const nombreLower = c.nombre.trim().toLowerCase();
      const dioLike = likersSet.has(nombreLower) ? 'Sí' : 'No';
      return {
        nombre: c.nombre,
        comentario: c.comentario,
        etiquetas_dom: c.etiquetas_dom || [],
        dio_like: dioLike
      };
    });

    console.log(`[Sistema Target] Extracción completada. Meta Target: ${targetComments} | Extraídos crudos: ${finalResults.length} | Personas únicas: ${uniquePersonsSet.size} | Con Like: ${finalResults.filter(r => r.dio_like === 'Sí').length}`);

    return {
      success: true,
      url,
      targetComments,
      extractedRawComments: finalResults.length,
      extractedUniquePersons: uniquePersonsSet.size,
      likesDetected: likersSet.size,
      comments: finalResults
    };

  } catch (error) {
    console.error('Error durante la extracción:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeFacebookComments };
