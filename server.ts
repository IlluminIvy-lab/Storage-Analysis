import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Gemini API: Generate one-sentence Cleanup Insight
app.post("/api/gemini/cleanup-insight", async (req, res) => {
  try {
    const { folderName, matches, totalScanned, totalUniqueKept } = req.body;

    // Fallback heuristic generator if Gemini key is absent or call fails
    const generateFallbackInsight = () => {
      if (!matches || matches.length === 0) {
        return "No duplicate files or draft redundancies were identified in this folder.";
      }

      // Analyze file extensions and names
      const extensions: Record<string, number> = {};
      const nameKeywords: Record<string, number> = {};
      let exactCount = 0;
      let draftCount = 0;

      for (const m of matches) {
        if (m.type === "exact") exactCount++;
        else draftCount++;

        const name = (m.name || m.targetFile?.name || "").toLowerCase();
        const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "files";
        extensions[ext] = (extensions[ext] || 0) + 1;

        const words = name.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w: string) => w.length > 3);
        for (const w of words) {
          nameKeywords[w] = (nameKeywords[w] || 0) + 1;
        }
      }

      const topExt = Object.entries(extensions).sort((a, b) => b[1] - a[1])[0]?.[0] || "files";
      const topKeyword = Object.entries(nameKeywords).sort((a, b) => b[1] - a[1])[0]?.[0];

      if (topKeyword && draftCount > exactCount) {
        return `Most duplicates are revision drafts and working copies related to ${topKeyword} ${topExt} files.`;
      }
      if (exactCount >= draftCount) {
        return `Most duplicates are exact identical copies across your ${topExt} records.`;
      }
      return `Most duplicates are older version drafts and superseded copies of your ${topExt} documents.`;
    };

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        insight: generateFallbackInsight(),
        source: "heuristic_fallback",
      });
    }

    if (!matches || matches.length === 0) {
      return res.json({
        insight: "No duplicate files or draft redundancies were detected across your reviewed files.",
        source: "gemini",
      });
    }

    // Prepare concise summary of duplicate files for Gemini
    const sampleItems = matches.slice(0, 40).map((m: any) => {
      const targetName = m.name || m.targetFile?.name || "Unknown";
      const originalName = m.originalName || m.keptOriginalFile?.name || "Original";
      const type = m.type === "exact" ? "exact duplicate" : "draft / older version";
      const reason = m.reason || "";
      return `- "${targetName}" (duplicate of "${originalName}", type: ${type}${reason ? `, context: ${reason}` : ""})`;
    });

    const prompt = `You are a file system and storage organization specialist.
Analyze the following list of duplicate/draft files and their kept originals discovered in Google Drive folder "${folderName || "My Drive"}":

${sampleItems.join("\n")}

Total files scanned: ${totalScanned || matches.length}
Total duplicates identified: ${matches.length}

TASK:
Provide exactly ONE concise, user-friendly sentence summarizing the common types, topics, or patterns of duplicates found (e.g., "Most duplicates are copies of your monthly budget reports" or "Duplicates primarily consist of iterative draft versions of project proposals and markdown meeting notes").

STRICT RULES:
1. Provide EXACTLY one clear, insightful sentence.
2. Do NOT use bullet points, greetings, quotes, or markdown bolding.
3. Keep it natural, conversational, and direct.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    const insightText = response.text?.trim().replace(/^["']|["']$/g, "") || generateFallbackInsight();

    return res.json({
      insight: insightText,
      source: "gemini",
    });
  } catch (err: any) {
    console.error("Error generating cleanup insight via Gemini:", err);
    // Graceful fallback so UI never breaks
    return res.json({
      insight: "Most duplicates identified are older revision drafts and identical copies of your working documents.",
      source: "error_fallback",
    });
  }
});

// Vite middleware for dev or static serving for prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Drive Cleanup Agent server listening on port ${PORT}`);
  });
}

startServer();
