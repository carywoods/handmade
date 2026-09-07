import 'dotenv/config';

export interface PictureEvaluationResult {
  has_valid_picture: boolean;
  is_handmade: boolean;
  confidence: number;
  category: string;
  reason: string;
  enhanced_image_url: string;
}

function getGeminiApiKey(): string | null {
  // @ts-ignore
  return (typeof import.meta !== 'undefined' && import.meta.env?.GEMINI_API_KEY) || process.env.GEMINI_API_KEY || null;
}

/**
 * Normalizes and upgrades Amazon product images to high-definition resolution
 */
export function enhanceImageUrl(url: string): string {
  if (!url) return '';
  let clean = url.trim();

  // Upgrade Amazon thumbnail patterns (e.g. ._AC_UL320_.jpg -> ._AC_SL1200_.jpg)
  if (clean.includes('media-amazon.com') || clean.includes('images-amazon.com')) {
    clean = clean.replace(/\._AC_[A-Z0-9_,]+_\.jpg$/i, '._AC_SL1200_.jpg');
    clean = clean.replace(/\._SX[0-9]+_\.jpg$/i, '._AC_SL1200_.jpg');
    clean = clean.replace(/\._SY[0-9]+_\.jpg$/i, '._AC_SL1200_.jpg');
  }

  return clean;
}

/**
 * Verifies that the picture exists, is reachable, and has valid image bytes
 */
export async function validatePicture(url: string): Promise<{
  valid: boolean;
  buffer?: Buffer;
  mimeType?: string;
  error?: string;
}> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return { valid: false, error: 'Missing or malformed image URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { valid: false, error: `Image fetch returned HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return { valid: false, error: `Invalid content type: ${contentType}` };
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Reject placeholder or corrupt 1x1 pixels (< 3KB)
    if (buffer.length < 3000) {
      return { valid: false, error: `Image size too small (${buffer.length} bytes), possible tracking pixel` };
    }

    return {
      valid: true,
      buffer,
      mimeType: contentType.split(';')[0].trim(),
    };
  } catch (err: any) {
    return { valid: false, error: `Network error verifying image: ${err?.message || err}` };
  }
}

/**
 * Immediate rejection patterns: Tools, Machines, Equipment, DIY Supplies, Multi-Packs
 */
const FORBIDDEN_PATTERNS = [
  /\btools?\b/i,
  /\bmachines?\b/i,
  /\bshapers?\b/i,
  /\bscrapers?\b/i,
  /\bmolds?\b/i,
  /\btemplates?\b/i,
  /\bchisels?\b/i,
  /\bbranding irons?\b/i,
  /\bstamps?\b/i,
  /\bdrill bits?\b/i,
  /\bpottery wheels?\b/i,
  /\bwheel machines?\b/i,
  /\b[0-9]+w\b/i, // watt (450W, 350W, etc.)
  /\b[0-9]+\s*pack\b/i, // 2pack, 5 pack, etc.
  /\bpack of [0-9]+\b/i,
  /\bwholesale\b/i,
  /\bdiy\b/i,
  /\brfid\b/i,
  /\blaser engraver\b/i,
  /\bcnc\b/i,
  /\bairbrush\b/i,
  /\brotary\b/i,
  /\bburnisher\b/i,
  /\btrimming\b/i,
];

export function checkHeuristicHardFilter(title: string, description?: string): { pass: boolean; reason?: string } {
  const combined = `${title} ${description || ''}`;

  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = combined.match(pattern);
    if (match) {
      return {
        pass: false,
        reason: `Flagged as tool, machine, accessory, or multi-pack: matches "${match[0]}"`,
      };
    }
  }

  return { pass: true };
}

/**
 * Evaluates picture and listing using Gemini 2.5 Flash Multimodal Vision
 */
export async function evaluateWithGeminiVision(
  title: string,
  imageBuffer: Buffer,
  mimeType: string,
  targetCategory?: string
): Promise<{ is_handmade: boolean; confidence: number; category: string; reason: string }> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    // Fallback if no API key is present
    return {
      is_handmade: true,
      confidence: 0.6,
      category: targetCategory || 'Home & Living',
      reason: 'Heuristic verified (Gemini API key not configured)',
    };
  }

  const prompt = `You are the master curator for "itsmadebyhand.com", an elite marketplace exclusively showcasing genuine, finished handmade artisan goods.

Analyze this product picture and title:
Title: "${title}"
Proposed Category: "${targetCategory || 'Auto-Detect'}"

STRICT EVALUATION CRITERIA:
1. MUST BE A FINISHED ARTISAN CRAFT:
   - The picture must show a finished, tangible handcrafted piece (e.g. a hand-thrown ceramic mug/vase/bowl, hand-carved cutting board or wooden spoon, hand-stitched leather wallet/journal/bag, handwoven or knit blanket/pillow/throw, hand-poured beeswax candle or blacksmith forged iron hook).
2. IMMEDIATE REJECTIONS (Set is_handmade = false):
   - Any tool, machine, electrical appliance, motor, or device used to MAKE things (e.g. pottery wheels, branding irons, stamps, chisels, molds, laser engravers, 3D printers, rotary tools).
   - Any raw materials, blanks, DIY parts, or craft assembly kits.
   - Any multi-packs, wholesale lots, or obvious factory mass-produced items.
   - Irrelevant, blank, or broken pictures.

Respond ONLY with this JSON structure:
{
  "is_handmade": true or false,
  "confidence": 0.0 to 1.0,
  "category": "Woodworking" | "Pottery & Ceramics" | "Leather Goods" | "Textiles" | "Home & Living" | "Rejected",
  "reason": "Clear concise rationale explaining whether the item is a finished artisan piece or a rejected tool/machine/mass-produced product"
}`;

  try {
    const base64Data = imageBuffer.toString('base64');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (res.status === 429 && attempt < 2) {
        console.log(`[VISION] 429 rate limit, waiting ${2000 * (attempt + 1)}ms before retry...`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      console.warn(`[VISION] Gemini API responded with status ${res?.status}`);
      return {
        is_handmade: true,
        confidence: 0.5,
        category: targetCategory || 'Home & Living',
        reason: 'Gemini API throttled or unavailable; passed heuristic check',
      };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini Vision');
    }

    const parsed = JSON.parse(text);
    return {
      is_handmade: Boolean(parsed.is_handmade),
      confidence: Number(parsed.confidence) || 0.8,
      category: parsed.category || targetCategory || 'Home & Living',
      reason: parsed.reason || 'Evaluated by Gemini Vision',
    };
  } catch (err: any) {
    console.error('[VISION] Gemini evaluation error:', err?.message || err);
    return {
      is_handmade: true,
      confidence: 0.5,
      category: targetCategory || 'Home & Living',
      reason: 'Vision evaluation exception fallback',
    };
  }
}

/**
 * Complete evaluation pipeline: Image Validation + Heuristic Hard-Shield + Vision AI
 */
export async function evaluateProductPictureAndCraft(
  imageUrl: string,
  title: string,
  description?: string,
  targetCategory?: string
): Promise<PictureEvaluationResult> {
  const enhancedUrl = enhanceImageUrl(imageUrl);

  // 1. Picture Presence & Network Verification
  const picCheck = await validatePicture(enhancedUrl);
  if (!picCheck.valid) {
    return {
      has_valid_picture: false,
      is_handmade: false,
      confidence: 1.0,
      category: 'Rejected',
      reason: `Rejected: ${picCheck.error || 'Picture is missing, broken, or unreadable'}`,
      enhanced_image_url: enhancedUrl,
    };
  }

  // 2. Heuristic Hard-Shield (Immediate rejection for tools/machines/multi-packs)
  const hardFilter = checkHeuristicHardFilter(title, description);
  if (!hardFilter.pass) {
    return {
      has_valid_picture: true,
      is_handmade: false,
      confidence: 1.0,
      category: 'Rejected',
      reason: hardFilter.reason || 'Rejected by tool & machine filter',
      enhanced_image_url: enhancedUrl,
    };
  }

  // 3. Gemini Multimodal Vision Evaluation
  const visionResult = await evaluateWithGeminiVision(
    title,
    picCheck.buffer!,
    picCheck.mimeType || 'image/jpeg',
    targetCategory
  );

  return {
    has_valid_picture: true,
    is_handmade: visionResult.is_handmade,
    confidence: visionResult.confidence,
    category: visionResult.is_handmade ? visionResult.category : 'Rejected',
    reason: visionResult.reason,
    enhanced_image_url: enhancedUrl,
  };
}
