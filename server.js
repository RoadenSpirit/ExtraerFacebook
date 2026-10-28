const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3050;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'facebook-comment-scraper' });
});

app.post('/extract', async (req, res) => {
  const { url, maxComments } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Se requiere el parámetro "url" en el cuerpo JSON' });
  }

  console.log(`[${new Date().toISOString()}] Petición recibida para extraer comentarios de: ${url}`);

  try {
    const scraperPath = path.resolve(__dirname, 'scraper.js');
    delete require.cache[scraperPath];
    const { scrapeFacebookComments } = require(scraperPath);

    const result = await scrapeFacebookComments(url, maxComments || 5000);
    console.log(`[${new Date().toISOString()}] Extracción completada. Total personas únicas: ${result.extractedUniquePersons}`);
    res.json(result);
  } catch (error) {
    console.error('Error al procesar la extracción:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno al extraer comentarios'
    });
  }
});

/**
 * Función auxiliar para consultar a la API de Omniroute IA
 */
async function evaluateCommentWithIA(commentText, authorName = '') {
  const apiKey = "sk-5383286d638b3ab0-8a9a3b-3517f5ec";
  const prompt = `Analiza el siguiente comentario de un concurso de Facebook:
Autor del comentario: "${authorName}"
Comentario: "${commentText}"

Reglas:
1. FRASE: ¿El texto expresa la intención o idea semántica de estar listo para el regreso a clases / colegio / escuela? (Ejemplos válidos: "De vuelta al cole", "Listo para la escuela", "Preparados para las clases", "Listo para volver al Cole").
2. AMIGOS: Extrae los nombres reales de personas mencionadas o etiquetadas como amigos en el comentario. Ignora palabras comunes, ciudades o la frase del sorteo.
3. EXCLUSIÓN IMPORTANTE: NUNCA incluyas el nombre del propio autor ("${authorName}") en la lista de amigos detectados.

Responde ÚNICAMENTE un JSON válido con este formato:
{
  "cumple_frase": true/false,
  "nombres_detectados": ["Nombre 1", "Nombre 2"],
  "cantidad_amigos": 2,
  "cumple_todo": true/false
}`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "auto/best-chat",
      stream: false,
      messages: [{ role: "user", content: prompt }]
    });

    const hostTargets = ["172.16.1.1", "127.0.0.1", "localhost"];
    let targetHost = "172.16.1.1";

    const req = http.request({
      hostname: targetHost,
      port: 5091,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(data)
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const match = body.match(/data:\s*({"type":"text-delta".*)/g);
          let fullText = "";
          if (match) {
            match.forEach(m => {
              const jsonStr = m.replace(/^data:\s*/, "");
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === "text-delta" && parsed.delta) fullText += parsed.delta;
            });
          }
          const cleanJson = fullText.replace(/```json|```/g, "").trim();
          const parsedRes = JSON.parse(cleanJson);

          // Filtrar autor si se coló en los nombres detectados
          if (authorName && Array.isArray(parsedRes.nombres_detectados)) {
            const autorLower = authorName.trim().toLowerCase();
            parsedRes.nombres_detectados = parsedRes.nombres_detectados.filter(n => {
              const nLower = n.trim().toLowerCase();
              return nLower !== autorLower && !nLower.includes(autorLower) && !autorLower.includes(nLower);
            });
            parsedRes.cantidad_amigos = parsedRes.nombres_detectados.length;
            parsedRes.cumple_todo = (parsedRes.cumple_frase === true && parsedRes.cantidad_amigos >= 2);
          }

          resolve(parsedRes);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

app.post('/evaluate-ia', async (req, res) => {
  const { comentario, autor, cumple_anterior } = req.body;

  if (!comentario || typeof comentario !== 'string' || !comentario.trim()) {
    return res.json({
      success: true,
      nombre: autor || '',
      comentario: comentario || '',
      cumple_anterior: cumple_anterior || '',
      evaluation: {
        cumple_frase: false,
        nombres_detectados: [],
        cantidad_amigos: 0,
        cumple_todo: false
      }
    });
  }

  try {
    const evaluation = await evaluateCommentWithIA(comentario, autor || '');
    res.json({
      success: true,
      nombre: autor || '',
      comentario: comentario || '',
      cumple_anterior: cumple_anterior || '',
      evaluation
    });
  } catch (error) {
    console.error('Error al evaluar comentario con IA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor microservicio de extracción de Facebook corriendo en http://localhost:${PORT}`);
});
