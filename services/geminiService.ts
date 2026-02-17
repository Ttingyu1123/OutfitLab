
import { TryOnConfig, GarmentItem, Language } from "../types";
import { MODEL_IMAGE_EDIT, MODEL_ANALYSIS } from "../constants";

const API_KEY_STORAGE_KEY = "gemini_api_key";

const normalizeBase64 = (value: string): string => value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

// Lazy-load SDK to keep initial bundle smaller.
const getClient = async (apiKey: string) => {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey });
};

export const getStoredApiKey = (): string => {
  if (typeof window === "undefined") return "";
  const localKey = window.localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  if (localKey) return localKey;
  return window.sessionStorage.getItem(API_KEY_STORAGE_KEY) || "";
};

export const saveApiKey = (apiKey: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
};

export const clearApiKey = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  window.sessionStorage.removeItem(API_KEY_STORAGE_KEY);
};

export const checkApiKey = async (): Promise<boolean> => {
  return Boolean(getStoredApiKey());
};

export const isAuthError = (error: unknown): boolean => {
  const message = String((error as any)?.message || "").toLowerCase();
  const status = (error as any)?.status;
  const code = (error as any)?.code;
  return status === 401 || status === 403 || code === 401 || code === 403 || message.includes("401") || message.includes("403");
};

export const validateApiKey = async (apiKey: string, timeoutMs = 12000): Promise<boolean> => {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;
  const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
    Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Validation timeout. Please try again.")), ms))
    ]);
  try {
    const ai = await getClient(trimmed);
    await withTimeout(ai.models.generateContent({
      model: MODEL_ANALYSIS,
      contents: [{ parts: [{ text: "Reply with OK." }] }]
    }), timeoutMs);
    return true;
  } catch (error) {
    if (isAuthError(error)) return false;
    throw error;
  }
};

/**
 * Retry helper for transient API failures (503/429/high demand).
 */
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, baseDelay = 2000): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check for transient overload / rate-limit cases.
      const isTransient = 
        error?.status === 429 ||
        error?.code === 429 ||
        error?.status === 503 || 
        error?.code === 503 ||
        error?.status === 'UNAVAILABLE' ||
        (error?.message && (
          error.message.includes('high demand') || 
          error.message.includes('temporarily overloaded') ||
          error.message.includes('503') ||
          error.message.includes('429') ||
          error.message.toLowerCase().includes('rate limit')
        ));

      if (isTransient && attempt < maxRetries) {
        // Exponential backoff with jitter to avoid synchronized retries.
        const jitter = Math.floor(Math.random() * 400);
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        console.warn(`Transient API error. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not retriable or max retries reached, throw
      throw error;
    }
  }
  throw lastError;
}

/**
 * Analyzes the outfit in the image and provides fashion advice.
 */
export const analyzeOutfit = async (
  apiKey: string,
  base64Image: string,
  lang: Language = 'zh',
  abortSignal?: AbortSignal
): Promise<string> => {
  return withRetry(async () => {
    const ai = await getClient(apiKey);
    
    const langMap = {
      zh: "Traditional Chinese (繁體中文)",
      en: "English",
      ja: "Japanese (日本語)",
      ko: "Korean (한국어)"
    };
  
    const targetLang = langMap[lang] || langMap.zh;
  
    const prompt = `
      You are a top-tier celebrity fashion stylist and image consultant.
      Analyze the outfit worn by the person in this image.
      
      Provide a structured critique in ${targetLang} with the following sections:
      
      1. **Style Analysis**: Briefly describe the overall vibe.
      2. **Color Palette**: Comment on the color choices.
      3. **Highlights**: What is working well?
      4. **Pro Tips**: Give 3 specific, actionable tips.
      
      IMPORTANT: At the very end of your response, strictly output a JSON block containing 3-5 specific item recommendations based on your advice. 
      Format:
      \`\`\`json
      {
        "recommendations": ["Red silk scarf", "Wide-leg beige trousers", "Silver statement necklace"]
      }
      \`\`\`
      (Translate the items in the JSON to the requested language (${targetLang}) so they are easy to understand).
      
      Tone: Encouraging, professional, chic, and honest. 
      Format: Use Markdown for headers and bullet points.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: MODEL_ANALYSIS, // Using the same model as it handles vision well
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: normalizeBase64(base64Image) } },
            { text: prompt }
          ]
        },
        config: { abortSignal }
      });
  
      return response.text || "Unable to generate analysis right now. Please try again.";
    } catch (error) {
      console.error("Analysis failed:", error);
      throw error;
    }
  });
};

/**
 * Extracts a specific clothing item or outfit from the image.
 */
export const extractClothingItem = async (
  apiKey: string,
  base64Image: string,
  targetDescription: string,
  abortSignal?: AbortSignal
): Promise<string> => {
  return withRetry(async () => {
    const ai = await getClient(apiKey);
    
    const prompt = `
      You are a professional product photographer and editor.
      Task: Identify the "${targetDescription}" worn by the person in this image.
      Output: Generate a high-quality, standalone product image of ONLY the requested item(s).
      
      Requirements:
      1. The background MUST be pure white (#FFFFFF).
      2. The item(s) should be shown clearly.
         - If it's a single item: use flat lay or ghost mannequin style.
         - If it's a full outfit or multiple accessories: arrange them in a clean, organized 'knolling' or fashion flat lay composition so every item (shoes, bags, jewelry, hats) is visible.
      3. Preserve the original color, texture, material details, and patterns of the garment(s) found in the source image exactly.
      4. Do not include the person, limbs, skin, or hair. Only the apparel and accessories.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: MODEL_IMAGE_EDIT,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: normalizeBase64(base64Image) } },
            { text: prompt }
          ]
        },
        config: { abortSignal }
      });
  
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        }
      }
      throw new Error("No image generated by the model.");
    } catch (error) {
      console.error("Extraction failed:", error);
      throw error;
    }
  });
};

/**
 * Edits the model image based on a text prompt (Magic Edit).
 */
export const editModelImage = async (
  apiKey: string,
  base64Image: string,
  promptText: string,
  abortSignal?: AbortSignal
): Promise<string> => {
  return withRetry(async () => {
    const ai = await getClient(apiKey);
  
    const prompt = `
      You are a professional photo retoucher.
      Image 1 is the source image.
      
      Task: Edit the image according to this instruction: "${promptText}".
      
      Constraints:
      1. Maintain high photorealism.
      2. Only modify the parts of the image relevant to the instruction.
      3. Keep the person's identity, pose, and other unaffected details exactly the same.
      4. Do not change the image resolution or aspect ratio significantly.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: MODEL_IMAGE_EDIT,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: normalizeBase64(base64Image) } },
            { text: prompt }
          ]
        },
        config: { abortSignal }
      });
  
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        }
      }
      throw new Error("No image generated by the model.");
    } catch (error) {
      console.error("Magic Edit failed:", error);
      throw error;
    }
  });
};

export const generateTryOn = async (
  apiKey: string,
  personImageBase64: string,
  garmentItems: GarmentItem[],
  config: TryOnConfig,
  abortSignal?: AbortSignal
): Promise<string> => {
  return withRetry(async () => {
    const ai = await getClient(apiKey);
  
    // Construct the prompt based on multiple items
    let prompt = `
      You are a professional virtual fashion editor for a high-end fashion magazine.
      Image 1 is the 'Person' (the model).
    `;
  
    // Filter out text-only items for image indexing
    const imageItems = garmentItems.filter(item => item.type === 'image' && item.image);
    
    // Dynamically list the garment images in the prompt
    imageItems.forEach((item, index) => {
      // If category is 'Other' and user provided a description, use that.
      // Otherwise use the category ID.
      const itemLabel = (item.category === 'Other' && item.customDescription) 
        ? item.customDescription 
        : item.category;
  
      prompt += `\nImage ${index + 2} is a '${itemLabel}'.`;
    });
  
    prompt += `\n
      Task: Edit the 'Person' image (Image 1) to wear ALL the provided clothing items.
      
      CLOTHING INSTRUCTIONS:
    `;
  
    // 1. Add instructions for Image-based items
    if (imageItems.length > 0) {
       prompt += `\n   - Apply the garments shown in Images 2-${imageItems.length + 1} to the person. Match their texture and style exactly.`;
    }
  
    // 2. Add instructions for Text-based items
    const textItems = garmentItems.filter(item => item.type === 'text');
    if (textItems.length > 0) {
      prompt += `\n   - GENERATE and Apply the following items described by text:`;
      textItems.forEach(item => {
         prompt += `\n     * ${item.customDescription} (Category: ${item.category})`;
      });
    }
  
    prompt += `\n
      Critical Instructions:
      1. OUTFIT COMPOSITION:
         - Apply EVERY item provided (both image-based and text-based).
         - Handle layering logically (e.g., Jackets go over Shirts, Belts go on Trousers/Dresses, Hats go on head).
         - Replace the person's original clothes with these new items where they overlap.
      2. IDENTITY PRESERVATION (HIGH PRIORITY):
         - Maintain the person's exact pose, body shape, skin tone, facial features, and hair style. The face MUST look identical to Image 1.
      3. PHOTOREALISM & TEXTURE:
         - The clothing must look like real fabric, not a flat sticker. 
         - Ensure natural folding and draping around the body's curves.
    `;
  
    if (!config.keepBackground && config.backgroundPrompt && config.backgroundPrompt !== 'original') {
      prompt += `\n4. ENVIRONMENT & LIGHTING HARMONIZATION:
         - Place the person into the following environment: "${config.backgroundPrompt}".
         - RELIGHT THE PERSON: You MUST change the lighting on the person's skin and clothes to match the new environment. 
         - CAST SHADOWS: Ensure the person casts a realistic shadow.`;
    } else {
      prompt += `\n4. Keep the original background exactly as it is. Ensure lighting on the new clothes matches the original scene.`;
    }
  
    prompt += `\nReturn ONLY the generated image in high resolution.`;
  
    // Construct payload parts
    const parts: any[] = [
      { inlineData: { mimeType: 'image/jpeg', data: normalizeBase64(personImageBase64) } }
    ];
  
    // Add only the image-based garment images to payload
    imageItems.forEach(item => {
      if (item.image) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: normalizeBase64(item.image) } });
      }
    });
  
    // Add prompt text at the end
    parts.push({ text: prompt });
  
    try {
      const response = await ai.models.generateContent({
        model: MODEL_IMAGE_EDIT,
        contents: { parts },
        config: {
          abortSignal,
          imageConfig: {
            aspectRatio: config.aspectRatio || "3:4"
          }
        }
      });
  
      const resultParts = response.candidates?.[0]?.content?.parts;
      if (resultParts) {
        for (const part of resultParts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        }
      }
      
      throw new Error("No image generated by the model.");
  
    } catch (error) {
      console.error("Try-on generation failed:", error);
      throw error;
    }
  });
};
