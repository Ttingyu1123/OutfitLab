interface AiStudioBridge {
  hasSelectedApiKey?: () => Promise<boolean>;
  openSelectKey?: () => Promise<void>;
}

interface Window {
  aistudio?: AiStudioBridge;
}
