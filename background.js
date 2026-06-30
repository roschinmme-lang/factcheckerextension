/**
 * TRUTHLENS - BACKGROUND SERVICE WORKER v3.0
 * Features: Image fact-check, AI detection, URL/text fact-check,
 * history log, multi-language support, source credibility ratings.
 */

const MISTRAL_API_KEY = "MISTRALAPI";
const MISTRAL_URL    = "https://api.mistral.ai/v1/chat/completions";
const HISTORY_KEY    = "tl_history";
const MAX_HISTORY    = 20;

// ── SOURCE CREDIBILITY DATABASE ──────────────────────────────────────────────
// Tiers: "high" | "medium" | "low" | "satire"
const CREDIBILITY_DB = {
  // High credibility — established fact-checkers & wire services
  "snopes.com":           { tier: "high",   label: "Highly credible" },
  "reuters.com":          { tier: "high",   label: "Highly credible" },
  "apnews.com":           { tier: "high",   label: "Highly credible" },
  "bbc.com":              { tier: "high",   label: "Highly credible" },
  "bbc.co.uk":            { tier: "high",   label: "Highly credible" },
  "factcheck.org":        { tier: "high",   label: "Highly credible" },
  "politifact.com":       { tier: "high",   label: "Highly credible" },
  "fullfact.org":         { tier: "high",   label: "Highly credible" },
  "washingtonpost.com":   { tier: "high",   label: "Highly credible" },
  "nytimes.com":          { tier: "high",   label: "Highly credible" },
  "theguardian.com":      { tier: "high",   label: "Highly credible" },
  "npr.org":              { tier: "high",   label: "Highly credible" },
  "pbs.org":              { tier: "high",   label: "Highly credible" },
  "who.int":              { tier: "high",   label: "Highly credible" },
  "cdc.gov":              { tier: "high",   label: "Highly credible" },
  "nature.com":           { tier: "high",   label: "Highly credible" },
  "science.org":          { tier: "high",   label: "Highly credible" },
  "afp.com":              { tier: "high",   label: "Highly credible" },
  "verafiles.org":        { tier: "high",   label: "Highly credible" },
  "cnnphilippines.com":   { tier: "high",   label: "Highly credible" },
  "rappler.com":          { tier: "high",   label: "Highly credible" },
  "philstar.com":         { tier: "medium", label: "Generally reliable" },
  "inquirer.net":         { tier: "medium", label: "Generally reliable" },

  // Medium credibility — mainstream but sometimes partisan
  "cnn.com":              { tier: "medium", label: "Generally reliable" },
  "foxnews.com":          { tier: "medium", label: "Generally reliable" },
  "nbcnews.com":          { tier: "medium", label: "Generally reliable" },
  "cbsnews.com":          { tier: "medium", label: "Generally reliable" },
  "abcnews.go.com":       { tier: "medium", label: "Generally reliable" },
  "forbes.com":           { tier: "medium", label: "Generally reliable" },
  "time.com":             { tier: "medium", label: "Generally reliable" },
  "newsweek.com":         { tier: "medium", label: "Generally reliable" },
  "usatoday.com":         { tier: "medium", label: "Generally reliable" },
  "theatlantic.com":      { tier: "medium", label: "Generally reliable" },
  "vox.com":              { tier: "medium", label: "Generally reliable" },
  "vice.com":             { tier: "medium", label: "Generally reliable" },
  "buzzfeednews.com":     { tier: "medium", label: "Generally reliable" },
  "huffpost.com":         { tier: "medium", label: "Generally reliable" },

  // Low credibility — known for misinformation or bias
  "naturalnews.com":      { tier: "low",    label: "Low credibility" },
  "infowars.com":         { tier: "low",    label: "Low credibility" },
  "breitbart.com":        { tier: "low",    label: "Low credibility" },
  "beforeitsnews.com":    { tier: "low",    label: "Low credibility" },
  "worldnewsdailyreport.com": { tier: "low", label: "Low credibility" },

  // Satire sites
  "theonion.com":         { tier: "satire", label: "Satire site" },
  "thebabylonbee.com":    { tier: "satire", label: "Satire site" },
  "clickhole.com":        { tier: "satire", label: "Satire site" },
  "waterfordwhispersnews.com": { tier: "satire", label: "Satire site" },
};

/**
 * Look up credibility for a URL.
 * @param {string} url
 * @returns {{ tier: string, label: string } | null}
 */
function getCredibility(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (CREDIBILITY_DB[hostname]) return CREDIBILITY_DB[hostname];
    // Check parent domain (e.g. "news.bbc.co.uk" → "bbc.co.uk")
    const parts = hostname.split(".");
    if (parts.length > 2) {
      const parent = parts.slice(-2).join(".");
      if (CREDIBILITY_DB[parent]) return CREDIBILITY_DB[parent];
    }
    return null;
  } catch {
    return null;
  }
}

// ── MESSAGE LISTENER ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Image snip
  if (message.action === "captureAndAnalyze") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "showResult",
          data: { verdict: "Error", explanation: "Screen capture failed. Try refreshing the page.", references: [] }
        });
        return;
      }
      processMistral(dataUrl, message.rect, message.dpr, sender.tab.id, message.mode, message.lang);
    });
  }

  // Manual file upload
  if (message.action === "processManualUpload") {
    processMistralDirect(message.base64, sender.tab.id, message.mode, message.lang);
  }

  // URL / text fact-check (no image)
  if (message.action === "factCheckText") {
    sendToMistralText(message.content, message.contentType, sender.tab.id, message.lang);
  }

  // Fetch history
  if (message.action === "getHistory") {
    chrome.storage.local.get(HISTORY_KEY, (data) => {
      sendResponse({ history: data[HISTORY_KEY] || [] });
    });
    return true; // keep channel open for async sendResponse
  }

  // Clear history
  if (message.action === "clearHistory") {
    chrome.storage.local.remove(HISTORY_KEY, () => sendResponse({ ok: true }));
    return true;
  }

  return true;
});

// ── PROMPT BUILDERS ──────────────────────────────────────────────────────────
function getMistralPrompt(mode, lang) {
  const langNote = lang && lang !== "en"
    ? `IMPORTANT: Write your "explanation" field in the language with BCP-47 code "${lang}". All other JSON keys must remain in English.`
    : "";

  if (mode === "aidetection") {
    return `Analyze this image for signs of AI generation.
Look for: unnatural textures, artifacts, distorted backgrounds, impossible lighting, malformed hands or text, or inconsistencies.
${langNote}
Respond ONLY in flat JSON with these exact keys:
- "verdict": "Likely AI" or "Likely Real"
- "isAI": "AI Check"
- "confidence": number 0-100
- "explanation": concise 2-3 sentence summary of reasoning
- "tags": array of 2-4 short labels (e.g. ["Texture artifacts", "Distorted hands"])
- "references": empty array []`;
  }

  return `Fact-check this image thoroughly.
Determine: Is the claim or content True, Fake, or Misleading?
Also assess: Is the image itself AI-generated or a real photograph?
${langNote}
Respond ONLY in flat JSON with these exact keys:
- "verdict": "True", "Fake", or "Misleading"
- "isAI": "Likely AI" or "Likely Real"
- "confidence": number 0-100
- "explanation": concise 2-3 sentence plain-language summary
- "tags": array of 2-4 short category labels (e.g. ["Misinformation", "Altered image", "Out of context"])
- "references": array of objects with "source", "title", and "url" — use real, publicly accessible URLs. Include 2-3 if possible.`;
}

function getMistralTextPrompt(content, contentType, lang) {
  const langNote = lang && lang !== "en"
    ? `IMPORTANT: Write your "explanation" field in the language with BCP-47 code "${lang}". All other JSON keys must remain in English.`
    : "";

  const inputDesc = contentType === "url"
    ? `the article or page at this URL: ${content}`
    : `this text claim: "${content}"`;

  return `Fact-check ${inputDesc}.
Determine if it is True, Fake, or Misleading based on your knowledge and reasoning.
${langNote}
Respond ONLY in flat JSON with these exact keys:
- "verdict": "True", "Fake", or "Misleading"
- "isAI": null
- "confidence": number 0-100
- "explanation": concise 2-3 sentence plain-language summary of your finding
- "tags": array of 2-4 short category labels
- "references": array of objects with "source", "title", and "url" — real, publicly accessible fact-check or news URLs. Include 2-3 if possible.
- "inputType": "${contentType}"`;
}

// ── IMAGE PROCESSING ─────────────────────────────────────────────────────────
async function processMistral(dataUrl, rect, dpr, tabId, mode, lang) {
  try {
    const response = await fetch(dataUrl);
    const blob     = await response.blob();
    const bitmap   = await createImageBitmap(blob);
    const width    = Math.max(1, rect.w * dpr);
    const height   = Math.max(1, rect.h * dpr);
    const canvas   = new OffscreenCanvas(width, height);
    const ctx      = canvas.getContext("2d");
    ctx.drawImage(bitmap, rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr, 0, 0, width, height);
    const croppedBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
    const base64Data  = await blobToBase64(croppedBlob);
    await sendToMistral(base64Data, tabId, mode, lang);
  } catch (err) {
    console.error("Cropping error:", err);
    chrome.tabs.sendMessage(tabId, {
      action: "showResult",
      data: { verdict: "Error", explanation: err.message, references: [] }
    });
  }
}

async function processMistralDirect(base64Data, tabId, mode, lang) {
  await sendToMistral(base64Data, tabId, mode, lang);
}

// ── MISTRAL: IMAGE ────────────────────────────────────────────────────────────
async function sendToMistral(base64Data, tabId, mode, lang) {
  try {
    const prompt = getMistralPrompt(mode, lang);
    const aiRes  = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
      body: JSON.stringify({
        model: "pixtral-12b-2409",
        messages: [{
          role: "user",
          content: [
            { type: "text",      text: prompt },
            { type: "image_url", image_url: `data:image/jpeg;base64,${base64Data}` }
          ]
        }],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });
    const data = await aiRes.json();
    if (data.error) throw new Error(data.error.message);
    const result = parseAndEnrichResult(data.choices[0].message.content);
    await saveToHistory(result, "image");
    chrome.tabs.sendMessage(tabId, { action: "showResult", data: result });
  } catch (err) {
    console.error("Mistral API error:", err);
    chrome.tabs.sendMessage(tabId, {
      action: "showResult",
      data: { verdict: "Error", explanation: "Could not analyze this image. " + err.message, references: [], tags: [] }
    });
  }
}

// ── MISTRAL: TEXT / URL ───────────────────────────────────────────────────────
async function sendToMistralText(content, contentType, tabId, lang) {
  try {
    const prompt = getMistralTextPrompt(content, contentType, lang);
    const aiRes  = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });
    const data = await aiRes.json();
    if (data.error) throw new Error(data.error.message);
    const result = parseAndEnrichResult(data.choices[0].message.content);
    result.inputPreview = content.slice(0, 80);
    result.inputType    = contentType;
    await saveToHistory(result, contentType);
    chrome.tabs.sendMessage(tabId, { action: "showResult", data: result });
  } catch (err) {
    console.error("Text fact-check error:", err);
    chrome.tabs.sendMessage(tabId, {
      action: "showResult",
      data: { verdict: "Error", explanation: "Could not fact-check this content. " + err.message, references: [], tags: [] }
    });
  }
}

// ── RESULT PARSING & ENRICHMENT ───────────────────────────────────────────────
function parseAndEnrichResult(raw) {
  raw = raw.replace(/```json|```/gi, "").trim();
  let result = JSON.parse(raw);
  if (result.fact_check) result = result.fact_check;
  if (result.result)     result = result.result;

  result.references = Array.isArray(result.references) ? result.references : [];
  result.tags       = Array.isArray(result.tags)       ? result.tags       : [];
  result.confidence = typeof result.confidence === "number" ? result.confidence : null;

  // Enrich references with credibility data
  result.references = result.references.map(ref => ({
    ...ref,
    credibility: ref.url ? getCredibility(ref.url) : null
  }));

  return result;
}

// ── HISTORY ───────────────────────────────────────────────────────────────────
async function saveToHistory(result, inputType) {
  return new Promise((resolve) => {
    chrome.storage.local.get(HISTORY_KEY, (data) => {
      const history = data[HISTORY_KEY] || [];
      const entry = {
        id:          Date.now(),
        timestamp:   new Date().toISOString(),
        inputType:   inputType || "image",
        verdict:     result.verdict,
        confidence:  result.confidence,
        explanation: result.explanation,
        tags:        result.tags || [],
        references:  result.references || [],
        inputPreview: result.inputPreview || null
      };
      history.unshift(entry);
      if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
      chrome.storage.local.set({ [HISTORY_KEY]: history }, resolve);
    });
  });
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
}
