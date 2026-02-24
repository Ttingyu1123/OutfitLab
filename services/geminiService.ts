import { TryOnConfig, GarmentItem, Language } from "../types";
import { MODEL_IMAGE_EDIT, MODEL_ANALYSIS } from "../constants";

const API_KEY_STORAGE_KEY = "gemini_api_key";

const normalizeBase64 = (value: string): string =>
  value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

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
  return (
    status === 401 ||
    status === 403 ||
    code === 401 ||
    code === 403 ||
    message.includes("401") ||
    message.includes("403")
  );
};

export const validateApiKey = async (apiKey: string, timeoutMs = 12000): Promise<boolean> => {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;

  const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
    Promise.race<T>([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Validation timeout. Please try again.")), ms)
      ),
    ]);

  try {
    const ai = await getClient(trimmed);
    await withTimeout(
      ai.models.generateContent({
        model: MODEL_ANALYSIS,
        contents: [{ parts: [{ text: "Reply with OK." }] }],
      }),
      timeoutMs
    );
    return true;
  } catch (error) {
    if (isAuthError(error)) return false;
    throw error;
  }
};

async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, baseDelay = 2000): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isTransient =
        error?.status === 429 ||
        error?.code === 429 ||
        error?.status === 503 ||
        error?.code === 503 ||
        error?.status === "UNAVAILABLE" ||
        (error?.message &&
          (error.message.includes("high demand") ||
            error.message.includes("temporarily overloaded") ||
            error.message.includes("503") ||
            error.message.includes("429") ||
            error.message.toLowerCase().includes("rate limit")));

      if (isTransient && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 400);
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export const analyzeOutfit = async (
  apiKey: string,
  base64Image: string,
  lang: Language = "zh",
  abortSignal?: AbortSignal
): Promise<string> => {
  return withRetry(async () => {
    const ai = await getClient(apiKey);

    const langMap = {
      zh: "Traditional Chinese (繁體中文)",
      en: "English",
      ja: "Japanese (日本語)",
      ko: "Korean (한국어)",
    };

    const targetLang = langMap[lang] || langMap.zh;
    const prompt = `
      You are a top-tier celebrity fashion stylist and image consultant.
      Analyze the outfit worn by the person in this image.
      Provide a structured critique in ${targetLang} with:
      1. Style Analysis
      2. Color Palette
      3. Highlights
      4. Pro Tips (3 specific tips)
      At the end, output a JSON block:
      \`\`\`json
      { "recommendations": ["item1", "item2", "item3"] }
      \`\`\`
    `;

    const response = await ai.models.generateContent({
      model: MODEL_ANALYSIS,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: normalizeBase64(base64Image) } },
          { text: prompt },
        ],
      },
      config: { abortSignal },
    });

    return response.text || "Unable to generate analysis right now. Please try again.";
  });
};

export const extractClothingItem = async (
  apiKey: string,
  base64Image: string,
  targetDescription: string,
  abortSignal?: AbortSignal
): Promise<string> => {
  return withRetry(async () => {
    const ai = await getClient(apiKey);
    const prompt = `
      Identify "${targetDescription}" from the person image and generate a standalone product image.
      Use pure white background (#FFFFFF), preserve texture/pattern details, no person body parts.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_EDIT,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: normalizeBase64(base64Image) } },
          { text: prompt },
        ],
      },
      config: { abortSignal },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated by the model.");
  });
};

export const editModelImage = async (
  apiKey: string,
  base64Image: string,
  promptText: string,
  abortSignal?: AbortSignal
): Promise<string> => {
  return withRetry(async () => {
    const ai = await getClient(apiKey);
    const prompt = `
      Edit image by instruction: "${promptText}".
      Keep identity, pose, and unaffected details unchanged. Keep photorealism.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_EDIT,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: normalizeBase64(base64Image) } },
          { text: prompt },
        ],
      },
      config: { abortSignal },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated by the model.");
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
    const imageItems = garmentItems.filter((item) => item.type === "image" && item.image);
    const textItems = garmentItems.filter((item) => item.type === "text");

    let prompt = `
      Edit Image 1 (person) to wear all provided clothing items.
      Keep identity/face/pose unchanged. Ensure realistic fabric drape and shadows.
    `;

    if (textItems.length > 0) {
      prompt += `\nAdditional text-described items:\n`;
      textItems.forEach((item) => {
        prompt += `- ${item.customDescription} (Category: ${item.category})\n`;
      });
    }

    if (!config.keepBackground && config.backgroundPrompt && config.backgroundPrompt !== "original") {
      prompt += `\nUse background: ${config.backgroundPrompt}`;
    }

    const parts: any[] = [
      { inlineData: { mimeType: "image/jpeg", data: normalizeBase64(personImageBase64) } },
    ];

    imageItems.forEach((item) => {
      if (item.image) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: normalizeBase64(item.image) } });
      }
    });
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_EDIT,
      contents: { parts },
      config: {
        abortSignal,
        imageConfig: { aspectRatio: config.aspectRatio || "3:4" },
      },
    });

    const resultParts = response.candidates?.[0]?.content?.parts;
    if (resultParts) {
      for (const part of resultParts) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated by the model.");
  });
};
