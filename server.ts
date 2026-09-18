import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(express.json({ limit: '10mb' }));
const getGeminiClient = () => process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } }) : null;

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.post('/api/gemini/cleanup-insight', async (req, res) => {
  try {
    const { folderName, matches, totalScanned, totalUniqueKept } = req.body || {};
    const items = Array.isArray(matches) ? matches.slice(0, 25) : [];
    const fallback = items.length ? `I found ${items.length} proposed organization or cleanup item${items.length === 1 ? '' : 's'} in ${folderName || 'your Drive'}.` : 'No duplicate or draft redundancies were identified.';
    const ai = getGeminiClient();
    if (!ai || items.length === 0) return res.json({ insight: fallback, source: ai ? 'heuristic_fallback' : 'heuristic_fallback' });
    const prompt = `You are a Google Drive organization assistant. Summarize this non-destructive scan in exactly one concise sentence. Do not recommend an action, select files, or claim byte equality unless the supplied type says byte-exact. Folder: ${String(folderName || 'My Drive').slice(0, 200)}. Scanned: ${Number(totalScanned) || 0}. Kept: ${Number(totalUniqueKept) || 0}. Items: ${items.map((m: any) => `name=${String(m.name || '').slice(0, 120)}, original=${String(m.originalName || '').slice(0, 120)}, type=${String(m.type || '')}`).join('; ')}`;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const result = await ai.models.generateContent({ model, contents: prompt });
    const insight = result.text?.trim().replace(/^['"]|['"]$/g, '');
    return res.json({ insight: insight || fallback, source: insight ? 'gemini' : 'heuristic_fallback' });
  } catch (err) { console.warn('Gemini insight unavailable:', err instanceof Error ? err.message : err); return res.json({ insight: 'Cleanup analysis completed; review the proposed plan for details.', source: 'heuristic_fallback' }); }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') { const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); }
  else { const distPath = path.join(process.cwd(), 'dist'); app.use(express.static(distPath)); app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html'))); }
  app.listen(PORT, '0.0.0.0', () => console.log(`Drive Cleanup Agent server listening on ${PORT}`));
}
startServer();
