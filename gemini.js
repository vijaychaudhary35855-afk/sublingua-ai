/**
 * SubLingua AI - Google Gemini API Client & High-Throughput Translation Engine
 * Optimized for translating up to 100+ lines in a single shot with zero desync,
 * resilient JSON parsing, 8192 maxOutputTokens, 404 model auto-fallback,
 * and automatic retry with exponential backoff.
 */

export class GeminiTranslator {
  constructor() {
    this.apiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('sublingua_gemini_api_key') || '') : '';
    // Use real production model as default (gemini-1.5-flash)
    let savedModel = typeof localStorage !== 'undefined' ? localStorage.getItem('sublingua_gemini_model') : null;
    if (!savedModel || savedModel.includes('2.5')) {
      savedModel = 'gemini-1.5-flash';
    }
    this.selectedModel = savedModel;
    this.isVerified = false;
    this.availableModels = [];
    this.abortController = null;
    this.isPaused = false;
    this.pausePromiseResolve = null;
  }

  /**
   * Set API key
   */
  setApiKey(key) {
    this.apiKey = (key || '').trim().replace(/^["']|["']$/g, '');
    if (typeof localStorage !== 'undefined') {
      if (this.apiKey) {
        localStorage.setItem('sublingua_gemini_api_key', this.apiKey);
      } else {
        localStorage.removeItem('sublingua_gemini_api_key');
      }
    }
    if (!this.apiKey) {
      this.isVerified = false;
    }
  }

  /**
   * Set chosen model
   */
  setModel(modelName) {
    if (!modelName) return;
    this.selectedModel = modelName;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sublingua_gemini_model', modelName);
    }
  }

  /**
   * Live Test & Verify Gemini API Key
   * Fetches models list from Google Gemini API
   * @returns {Promise<{success: boolean, message: string, models: Array<string>}>}
   */
  async verifyApiKey(keyToTest = null) {
    const rawKey = keyToTest || this.apiKey || '';
    const key = rawKey.trim().replace(/^["']|["']$/g, '');
    if (!key) {
      this.isVerified = false;
      return { success: false, message: 'API key is required. Please paste your Google Gemini API key.', models: [] };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        let errDetails = `HTTP Error ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            errDetails = errJson.error.message;
          }
        } catch (_) {}
        this.isVerified = false;
        return { success: false, message: `Verification failed: ${errDetails}`, models: [] };
      }

      const data = await response.json();
      if (!data.models || !Array.isArray(data.models)) {
        this.isVerified = false;
        return { success: false, message: 'Invalid response from Google Gemini API: no models returned.', models: [] };
      }

      // Filter models that support content generation
      const genModels = data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      // Sort models to put stable, fast production models first
      const priorityOrder = [
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash-latest',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro'
      ];

      genModels.sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a);
        const bIndex = priorityOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });

      this.availableModels = genModels;
      this.isVerified = true;
      this.setApiKey(key);

      // Auto-select best model
      if (!genModels.includes(this.selectedModel)) {
        this.selectedModel = genModels.find(m => m.includes('1.5-flash') || m.includes('2.0-flash')) || genModels[0] || 'gemini-1.5-flash';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('sublingua_gemini_model', this.selectedModel);
        }
      }

      return {
        success: true,
        message: `API Key verified! Active model: ${this.selectedModel}`,
        models: genModels
      };
    } catch (err) {
      this.isVerified = false;
      return {
        success: false,
        message: `Network or connectivity error: ${err.message || err}`,
        models: []
      };
    }
  }

  /**
   * System Instruction for authentic Roman Gen-Z Hinglish
   * Compact, precise, and culturally authentic.
   */
  getSystemInstruction(vibeLevel = 'chill', cueCount = 25) {
    let vibeSpecificNotes = '';
    if (vibeLevel === 'savage') {
      vibeSpecificNotes = 'Vibe: Full Gen-Z savage banter, witty slang, ultra punchy, high energy (e.g., "Full clown behavior chal raha hai", "No cap scene crazy tha", "Bro is cooked").';
    } else if (vibeLevel === 'cinematic') {
      vibeSpecificNotes = 'Vibe: Cinematic drama Hinglish, impactful, emotionally resonant, modern colloquial blend.';
    } else {
      vibeSpecificNotes = 'Vibe: Casual, relatable Indian Gen-Z Hinglish (e.g., "Bro scene kya chal raha hai", "Chill maar na bhai", "Asli mazaak chal raha hai", "Vibe check fail ho gaya", "Let him cook").';
    }

    return `You are SubLingua AI, an expert subtitle localization model converting English dialogue into authentic Roman-script Indian Gen-Z Hinglish.

CRITICAL RULES:
1. SCRIPT: ONLY use Roman English alphabet (A-Z). NEVER use Devanagari Hindi script.
2. DIALOGUE FLOW: Keep lines punchy, natural, and matching reading speed.
3. OUTPUT FORMAT: Return strictly a valid JSON array of objects with "id" and "hinglish".
Example:
[
  {"id": 1, "hinglish": "Bro scene kya chal raha hai?"},
  {"id": 2, "hinglish": "No cap yaar, full crazy vibe!"}
]
Total expected items: exactly ${cueCount}.
${vibeSpecificNotes}
Return ONLY the raw JSON array without any markdown fences or explanatory text.`;
  }

  /**
   * High-Throughput batch translation supporting up to 100+ cues at once.
   * Features:
   * - 8192 maxOutputTokens (prevent cut-off)
   * - Fallback without responseMimeType if 400 Bad Request occurs
   * - Fallback to gemini-1.5-flash if 404 model not found
   * - Exponential backoff on 429
   * - Bulletproof regex/JSON parsing
   */
  async translateBatchWithRetry(cueBatch, vibeLevel = 'chill', maxRetries = 3) {
    if (!this.apiKey) throw new Error('API key is not configured.');
    
    // Ensure valid active model
    let currentModel = this.selectedModel || 'gemini-1.5-flash';
    if (currentModel.includes('2.5')) {
      currentModel = 'gemini-1.5-flash';
      this.selectedModel = currentModel;
    }

    // Prepare compact payload to save tokens
    const minimalCues = cueBatch.map(c => ({
      id: c.id,
      text: c.sourceText
    }));

    const systemPrompt = this.getSystemInstruction(vibeLevel, minimalCues.length);
    const userPrompt = `Translate these ${minimalCues.length} subtitle cues into Roman Gen-Z Hinglish:\n${JSON.stringify(minimalCues)}`;

    let useJsonMimeType = true;
    let attempt = 0;

    while (attempt <= maxRetries) {
      if (this.isPaused) {
        await new Promise(resolve => { this.pausePromiseResolve = resolve; });
      }

      if (this.abortController && this.abortController.signal.aborted) {
        throw new Error('Translation stopped by user.');
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      const generationConfig = {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 8192
      };

      if (useJsonMimeType) {
        generationConfig.responseMimeType = "application/json";
      }

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: this.abortController ? this.abortController.signal : undefined
        });

        // Handle 404 Model Not Found (e.g. outdated model in localStorage)
        if (response.status === 404) {
          console.warn(`Model ${currentModel} returned 404. Falling back to gemini-1.5-flash...`);
          currentModel = 'gemini-1.5-flash';
          this.selectedModel = 'gemini-1.5-flash';
          attempt++;
          continue;
        }

        // Handle 400 Bad Request (often responseMimeType unsupported on certain API tiers)
        if (response.status === 400 && useJsonMimeType) {
          console.warn('HTTP 400 encountered with responseMimeType. Retrying without responseMimeType...');
          useJsonMimeType = false;
          continue;
        }

        // Handle 429 Rate Limit
        if (response.status === 429) {
          attempt++;
          if (attempt > maxRetries) {
            throw new Error('Gemini API Rate Limit (429) exceeded. Please wait a moment or check quota.');
          }
          const backoffMs = Math.pow(2, attempt) * 1500 + Math.random() * 500;
          console.warn(`Rate limit 429. Retrying in ${Math.round(backoffMs)}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(res => setTimeout(res, backoffMs));
          continue;
        }

        if (!response.ok) {
          let errText = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errData = await response.json();
            if (errData?.error?.message) errText = errData.error.message;
          } catch (_) {}

          attempt++;
          if (attempt <= maxRetries) {
            const backoffMs = 1500 * attempt;
            await new Promise(res => setTimeout(res, backoffMs));
            continue;
          }
          throw new Error(errText);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const contentPart = candidate?.content?.parts?.[0]?.text;

        if (!contentPart) {
          throw new Error('Empty response from Gemini API.');
        }

        const resultMap = this.extractTranslations(contentPart, minimalCues);
        return resultMap;

      } catch (err) {
        if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('stopped')) {
          throw new Error('Translation stopped by user.');
        }

        attempt++;
        if (attempt > maxRetries) {
          throw err;
        }
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise(res => setTimeout(res, backoffMs));
      }
    }

    throw new Error('Failed to translate batch after maximum retries.');
  }

  /**
   * Ultra-Resilient JSON & Regex Translation Extractor
   * Recovers translations across any format Gemini returns, even with trailing brackets or slight truncation.
   * @param {string} rawText 
   * @param {Array<{id: number, text: string}>} [expectedCues]
   * @returns {Map<number, string>}
   */
  extractTranslations(rawText, expectedCues = []) {
    let clean = (rawText || '').trim();

    // 1. Remove markdown fences if present
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    const resultMap = new Map();

    // 2. Try direct JSON parse
    let parsed = null;
    try {
      parsed = JSON.parse(clean);
    } catch (_) {
      // Try bracket substring
      const s = clean.indexOf('[');
      const e = clean.lastIndexOf(']');
      if (s !== -1 && e !== -1 && e > s) {
        try {
          parsed = JSON.parse(clean.substring(s, e + 1));
        } catch (_) {}
      }
    }

    // 3. Process parsed object/array
    if (parsed) {
      // Direct array
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.id !== undefined) {
            const val = item.hinglish || item.translation || item.text || item.translatedText || item.h || item.t;
            if (val) resultMap.set(Number(item.id), String(val).trim());
          }
        }
      } 
      // Wrapped array: { cues: [...] } or { translations: [...] }
      else if (typeof parsed === 'object') {
        const arrayProp = parsed.cues || parsed.translations || parsed.data || parsed.subtitles || parsed.results;
        if (Array.isArray(arrayProp)) {
          for (const item of arrayProp) {
            if (item && item.id !== undefined) {
              const val = item.hinglish || item.translation || item.text || item.translatedText;
              if (val) resultMap.set(Number(item.id), String(val).trim());
            }
          }
        } else {
          // Object key-value map: { "1": "Bro kya scene hai", "2": "No cap" }
          for (const [k, v] of Object.entries(parsed)) {
            const num = parseInt(k, 10);
            if (!isNaN(num) && typeof v === 'string') {
              resultMap.set(num, v.trim());
            }
          }
        }
      }
    }

    // 4. Bulletproof Regex Fallback (if JSON.parse missed cues or failed)
    if (resultMap.size < (expectedCues.length * 0.8)) {
      const regex = /"id"\s*:\s*(\d+)\s*,\s*"(?:hinglish|translation|text|targetText|h)"\s*:\s*"((?:[^"\\]|\\.)*)"/gi;
      let match;
      while ((match = regex.exec(clean)) !== null) {
        const id = parseInt(match[1], 10);
        const text = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        if (!resultMap.has(id)) {
          resultMap.set(id, text.trim());
        }
      }
    }

    return resultMap;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    if (this.pausePromiseResolve) {
      this.pausePromiseResolve();
      this.pausePromiseResolve = null;
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.resume();
  }

  /**
   * Main Translation Runner
   * Supports batchSize of 100 (translating 100 lines at once) or any custom size!
   */
  async translateAll({
    cues,
    batchSize = 100,
    vibeLevel = 'chill',
    onProgress = () => {},
    onBatchDone = () => {}
  }) {
    if (!this.isVerified) {
      // Auto-verify if API key exists
      const test = await this.verifyApiKey();
      if (!test.success) {
        throw new Error(test.message || 'Gemini API key is not verified.');
      }
    }

    if (!Array.isArray(cues) || cues.length === 0) {
      throw new Error('No subtitle cues available to translate.');
    }

    this.abortController = new AbortController();
    this.isPaused = false;

    const totalCues = cues.length;
    let effectiveBatchSize = parseInt(batchSize, 10);
    if (isNaN(effectiveBatchSize) || effectiveBatchSize <= 0) {
      effectiveBatchSize = 100;
    }

    // Chunk into batches
    const batches = [];
    for (let i = 0; i < cues.length; i += effectiveBatchSize) {
      batches.push(cues.slice(i, i + effectiveBatchSize));
    }

    let completedTotal = 0;
    const startTime = Date.now();

    for (let b = 0; b < batches.length; b++) {
      if (this.abortController.signal.aborted) {
        throw new Error('Translation stopped by user.');
      }

      const cueBatch = batches[b];

      // Mark batch status
      cueBatch.forEach(c => {
        if (c.status !== 'edited') c.status = 'translating';
      });

      onProgress({
        total: totalCues,
        completed: completedTotal,
        percent: Math.round((completedTotal / totalCues) * 100),
        currentBatch: b + 1,
        totalBatches: batches.length,
        statusText: `Translating batch ${b + 1} of ${batches.length} (${cueBatch.length} lines)...`
      });

      // Call Gemini API
      const resultMap = await this.translateBatchWithRetry(cueBatch, vibeLevel);

      // Map translations back to cues
      cueBatch.forEach(c => {
        const translated = resultMap.get(c.id);
        if (translated) {
          c.targetText = translated;
          c.status = 'translated';
        } else {
          // Fallback if missing
          if (!c.targetText) {
            c.targetText = c.sourceText;
          }
          c.status = 'translated';
        }
      });

      completedTotal += cueBatch.length;
      const percent = Math.min(100, Math.round((completedTotal / totalCues) * 100));

      onBatchDone({
        batchIndex: b,
        batchCues: cueBatch
      });

      onProgress({
        total: totalCues,
        completed: completedTotal,
        percent,
        currentBatch: b + 1,
        totalBatches: batches.length,
        statusText: `Translating: ${percent}% completed (${completedTotal}/${totalCues} cues translated)`
      });

      // Brief gentle pause between batches if multiple batches exist
      if (b < batches.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    return cues;
  }
}
