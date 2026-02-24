import React, { Suspense, lazy, useEffect, useState, useRef } from 'react';
import ApiKeyModal from './components/ApiKeyModal';
import ImageUploader from './components/ImageUploader';
import Button from './components/Button';
import ToastContainer, { ToastMessage, ToastType } from './components/Toast';
import { AppMode, TryOnConfig, GarmentItem, Language, AIProvider } from './types';
import { HistoryItem } from './types/history';
import { checkApiKey, extractClothingItem, generateTryOn, analyzeOutfit, editModelImage, getStoredApiKey, clearApiKey, isAuthError, getStoredProvider, saveProvider } from './services/geminiService';
import { loadHistoryFromDb, saveHistoryToDb } from './services/historyStorage';
import { CLOTHING_CATEGORIES, STUDIO_STYLES, ASPECT_RATIOS, CUSTOM_BG_KEY, TRANSLATIONS } from './constants';
import { STYLE_PRESETS } from './locales/stylePresets';

const AnalysisModal = lazy(() => import('./components/AnalysisModal'));
type UiTextSize = 'normal' | 'comfortable' | 'large';
const UI_TEXT_SIZE_STORAGE_KEY = 'outfitlab_ui_text_size';
const UI_TEXT_SIZE_MAP: Record<UiTextSize, string> = {
  normal: '16px',
  comfortable: '17px',
  large: '18px'
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('zh');
  const t = TRANSLATIONS[lang];
  const [uiTextSize, setUiTextSize] = useState<UiTextSize>('comfortable');

  const [isKeySet, setIsKeySet] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState<AIProvider>('gemini');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // Reset Key used to force re-render of components with internal state (like ImageUploader)
  const [resetKey, setResetKey] = useState(0);

  // Images
  const [baseImage, setBaseImage] = useState<string | null>(null); // Person
  
  // Garment State
  const [garmentItems, setGarmentItems] = useState<GarmentItem[]>([]);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const hasLoadedHistoryRef = useRef(false);
  const [showOriginal, setShowOriginal] = useState(false); // For Compare feature
  
  // Track what is currently being displayed in the result panel
  const [lastSubmittedItems, setLastSubmittedItems] = useState<GarmentItem[]>([]);
  const [lastSubmittedConfig, setLastSubmittedConfig] = useState<TryOnConfig | null>(null);
  const [showDetails, setShowDetails] = useState(false); // Toggle for redundant details
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<'extract' | 'try-on' | 'analysis' | 'edit' | null>(null);
  const [loadingStep, setLoadingStep] = useState(0); // For Loading Messages
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultType, setResultType] = useState<'extracted' | 'generated' | 'edited' | null>(null);
  
  // Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Analysis Modal State
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  // Configuration States
  const [col1ToolMode, setCol1ToolMode] = useState<'extract' | 'edit' | 'recolor'>('extract');
  const [selectedExtractCategory, setSelectedExtractCategory] = useState(CLOTHING_CATEGORIES[0].id);
  const [customExtractInput, setCustomExtractInput] = useState("");
  const [magicEditInput, setMagicEditInput] = useState("");
  // Recolor States
  const [recolorTarget, setRecolorTarget] = useState("");
  const [recolorValue, setRecolorValue] = useState("");

  const [customBgInput, setCustomBgInput] = useState("");
  
  // New Garment Input States
  const [inputMode, setInputMode] = useState<'image' | 'text'>('image');
  const [textGarmentInput, setTextGarmentInput] = useState("");
  const [textGarmentCategory, setTextGarmentCategory] = useState(CLOTHING_CATEGORIES[1].id);
  
  const [tryOnConfig, setTryOnConfig] = useState<TryOnConfig>({
    keepBackground: true,
    backgroundPrompt: STUDIO_STYLES[0].prompt,
    aspectRatio: '3:4'
  });

  // Toasts State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const savedTextSize = localStorage.getItem(UI_TEXT_SIZE_STORAGE_KEY);
    if (savedTextSize === 'normal' || savedTextSize === 'comfortable' || savedTextSize === 'large') {
      setUiTextSize(savedTextSize);
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = UI_TEXT_SIZE_MAP[uiTextSize];
    localStorage.setItem(UI_TEXT_SIZE_STORAGE_KEY, uiTextSize);
  }, [uiTextSize]);

  useEffect(() => {
    const provider = getStoredProvider();
    setApiProvider(provider);
    checkApiKey(provider).then((hasKey) => {
      setIsKeySet(hasKey);
      if (hasKey) {
        setApiKey(getStoredApiKey(provider));
      }
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const bootstrapHistory = async () => {
      const stored = await loadHistoryFromDb();
      if (!alive) return;
      setHistory(stored);
      hasLoadedHistoryRef.current = true;
    };
    bootstrapHistory();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedHistoryRef.current) return;
    saveHistoryToDb(history);
  }, [history]);

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, []);

  // Loading Steps Effect
  useEffect(() => {
    let interval: any;
    if (isProcessing && processingType === 'try-on') {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % t.loading_steps.length);
      }, 3000); // Change message every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isProcessing, processingType, lang]);

  // --- Helpers for Display ---
  
  const getBackgroundLabel = (config: TryOnConfig | null) => {
    if (!config) return "";
    if (config.keepBackground) return `${t.col2_bg_keep}`;
    
    // Try to match prompt to STUDIO_STYLES
    const matchedStyle = STUDIO_STYLES.find(s => s.prompt === config.backgroundPrompt);
    if (matchedStyle) {
      // Access the label in the current language, default to zh or first available if missing
      return (matchedStyle.label as any)[lang] || (matchedStyle.label as any)['zh'];
    }

    // Check if it looks like a custom prompt
    if (config.backgroundPrompt?.startsWith("Shot on location/studio. The environment is:")) {
      return `${t.col2_bg_custom}`;
    }

    return "Custom";
  };

  const getAspectRatioLabel = (ratioId?: string) => {
    if (!ratioId) return "";
    const ratio = ASPECT_RATIOS.find(r => r.id === ratioId);
    return ratio ? ratio.label : ratioId;
  };

  const textSizeLabel = '文字大小';
  const textSizeNormal = '標準';
  const textSizeComfortable = '舒適';
  const textSizeLarge = '較大';
  const providerLabel = apiProvider === 'gemini' ? 'Google Gemini' : 'OpenAI';

  const isRequestAbortError = (error: unknown) => {
    const message = String((error as any)?.message || '').toLowerCase();
    return (error as any)?.name === 'AbortError' || message.includes('aborted') || message.includes('abort');
  };

  const startRequestController = () => {
    activeRequestControllerRef.current?.abort();
    const controller = new AbortController();
    activeRequestControllerRef.current = controller;
    return controller;
  };

  const releaseRequestController = (controller: AbortController) => {
    if (activeRequestControllerRef.current === controller) {
      activeRequestControllerRef.current = null;
    }
  };

  const handleAuthFailure = (fallbackMessage: string) => {
    clearApiKey(apiProvider);
    setApiKey('');
    setIsKeySet(false);
    setShowApiKeyModal(false);
    addToast(fallbackMessage, 'error');
  };

  const ensureApiKeyReady = () => {
    if (apiKey.trim()) return true;
    setShowApiKeyModal(true);
    addToast("Please connect API key first.", "warning");
    return false;
  };

  // --- Handlers ---

  const handleAnalyze = async () => {
    if (!baseImage) {
      addToast(t.toast_upload_warning, 'warning');
      return;
    }
    if (!ensureApiKeyReady()) return;
    
    setIsAnalysisOpen(true);
    setAnalysisResult(null);
    setRecommendations([]); 
    setIsProcessing(true);
    setProcessingType('analysis');
    const controller = startRequestController();

    try {
      const result = await analyzeOutfit(apiKey, baseImage, lang, controller.signal, apiProvider);
      setAnalysisResult(result);

      const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
            setRecommendations(parsed.recommendations);
          }
        } catch (e) {
          console.warn("Failed to parse recommendations JSON", e);
        }
      }
    } catch (e) {
      if (isRequestAbortError(e)) {
        return;
      }
      if (isAuthError(e)) {
        handleAuthFailure("API key is invalid or expired. Please reconnect.");
      } else {
        addToast("Analysis failed", 'error');
      }
      setAnalysisResult("Error during analysis. Please try again.");
      console.error(e);
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
      releaseRequestController(controller);
    }
  };

  const handleExtract = async () => {
    if (!baseImage) {
      addToast(t.toast_upload_warning, 'warning');
      return;
    }
    if (!ensureApiKeyReady()) return;
    
    setIsProcessing(true);
    setProcessingType('extract');
    setResultImage(null);
    const controller = startRequestController();

    let targetDescription = selectedExtractCategory;
    if (selectedExtractCategory === 'Full-body') {
      targetDescription = "full outfit including top, bottom, shoes, and all accessories";
    } else if (selectedExtractCategory === 'Other') {
      targetDescription = customExtractInput.trim() || "clothing item";
    }

    try {
      const result = await extractClothingItem(apiKey, baseImage, targetDescription, controller.signal, apiProvider);
      setResultImage(result);
      setResultType('extracted');

      // Add to History
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        resultImage: result,
        config: null,
        items: [], // No specific input items for extraction
        timestamp: Date.now(),
        type: 'extracted'
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 10));

      addToast(t.toast_extract_success, 'success');
    } catch (e) {
      if (isRequestAbortError(e)) {
        return;
      }
      if (isAuthError(e)) {
        handleAuthFailure("API key is invalid or expired. Please reconnect.");
      } else {
        addToast(t.toast_extract_fail, 'error');
      }
      console.error(e);
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
      releaseRequestController(controller);
    }
  };

  const handleMagicEdit = async () => {
    if (!baseImage) {
      addToast(t.toast_upload_warning, 'warning');
      return;
    }
    if (!magicEditInput.trim()) return;
    if (!ensureApiKeyReady()) return;

    setIsProcessing(true);
    setProcessingType('edit');
    setResultImage(null);
    const controller = startRequestController();

    try {
      const result = await editModelImage(apiKey, baseImage, magicEditInput, controller.signal, apiProvider);
      // const rawBase64 = result.replace(/^data:image\/[a-z]+;base64,/, "");
      
      // Removed auto-update of baseImage
      // setBaseImage(rawBase64); 
      setResultImage(result);  
      setResultType('edited');
      
      // Add to History
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        resultImage: result,
        config: null,
        items: [],
        timestamp: Date.now(),
        type: 'edited'
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 10));

      setMagicEditInput("");
      addToast(t.toast_edit_success, 'success');
    } catch (e) {
      if (isRequestAbortError(e)) {
        return;
      }
      if (isAuthError(e)) {
        handleAuthFailure("API key is invalid or expired. Please reconnect.");
      } else {
        addToast(t.toast_edit_fail, 'error');
      }
      console.error(e);
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
      releaseRequestController(controller);
    }
  };

  const handleRecolor = async () => {
    if (!baseImage) {
      addToast(t.toast_upload_warning, 'warning');
      return;
    }
    if (!recolorTarget.trim() || !recolorValue.trim()) return;
    if (!ensureApiKeyReady()) return;

    setIsProcessing(true);
    setProcessingType('edit'); // Reuse edit type for loading message
    setResultImage(null);
    const controller = startRequestController();

    const prompt = `Change the color of the ${recolorTarget} to ${recolorValue}. IMPORTANT: Keep the original material texture, shading, and lighting exact. Only change the hue/saturation.`;

    try {
      const result = await editModelImage(apiKey, baseImage, prompt, controller.signal, apiProvider);
      // const rawBase64 = result.replace(/^data:image\/[a-z]+;base64,/, "");
      
      // Removed auto-update of baseImage
      // setBaseImage(rawBase64); 
      setResultImage(result);  
      setResultType('edited');
      
      // Add to History
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        resultImage: result,
        config: null,
        items: [],
        timestamp: Date.now(),
        type: 'edited'
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 10));

      addToast(t.toast_edit_success, 'success');
    } catch (e) {
      if (isRequestAbortError(e)) {
        return;
      }
      if (isAuthError(e)) {
        handleAuthFailure("API key is invalid or expired. Please reconnect.");
      } else {
        addToast(t.toast_edit_fail, 'error');
      }
      console.error(e);
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
      releaseRequestController(controller);
    }
  };

  const handleAddGarmentImage = (base64: string) => {
    const newItem: GarmentItem = {
      id: Date.now().toString(),
      type: 'image',
      image: base64,
      category: CLOTHING_CATEGORIES[1].id,
      customDescription: ""
    };
    setGarmentItems(prev => [...prev, newItem]);
    addToast(t.toast_add_image, 'success');
  };

  const handleAddGarmentText = () => {
    if (!textGarmentInput.trim()) {
      addToast(t.toast_add_text_warning, 'warning');
      return;
    }
    const newItem: GarmentItem = {
      id: Date.now().toString(),
      type: 'text',
      category: textGarmentCategory,
      customDescription: textGarmentInput.trim()
    };
    setGarmentItems(prev => [...prev, newItem]);
    setTextGarmentInput(""); 
    addToast(t.toast_add_text, 'success');
  };

  const handleRemoveGarment = (id: string) => {
    setGarmentItems(prev => prev.filter(item => item.id !== id));
  };
  
  const handleUpdateGarmentCategory = (id: string, newCategory: string) => {
    setGarmentItems(prev => prev.map(item => 
      item.id === id ? { ...item, category: newCategory } : item
    ));
  };

  const handleUpdateGarmentDescription = (id: string, newDescription: string) => {
    setGarmentItems(prev => prev.map(item => 
      item.id === id ? { ...item, customDescription: newDescription } : item
    ));
  };

  const handleTryOn = async () => {
    if (!baseImage) {
      addToast(t.toast_upload_warning, 'warning');
      return;
    }
    if (garmentItems.length === 0) {
      addToast(t.toast_garment_warning, 'warning');
      return;
    }
    if (!ensureApiKeyReady()) return;

    for (const item of garmentItems) {
      if (item.category === 'Other' && !item.customDescription?.trim()) {
        addToast(t.toast_desc_warning, 'warning');
        return;
      }
    }

    setIsProcessing(true);
    setProcessingType('try-on');
    setResultImage(null);
    setShowDetails(false); // Hide details for new result
    const controller = startRequestController();
    
    // Store snapshot
    const currentItems = [...garmentItems];
    let finalConfig = { ...tryOnConfig };
    
    // Handle Custom Background Logic
    if (!tryOnConfig.keepBackground && tryOnConfig.backgroundPrompt === CUSTOM_BG_KEY) {
      if (!customBgInput.trim()) {
         addToast(t.toast_custom_bg_warning, 'warning');
         setIsProcessing(false);
         setProcessingType(null);
         return;
      }
      finalConfig.backgroundPrompt = `Shot on location/studio. The environment is: ${customBgInput.trim()}. The lighting and shadows must realistically match this environment.`;
    }
    
    setLastSubmittedItems(currentItems);
    setLastSubmittedConfig(finalConfig);

    try {
      const result = await generateTryOn(apiKey, baseImage, currentItems, finalConfig, controller.signal, apiProvider);
      setResultImage(result);
      setResultType('generated');
      
      // Add to History
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        resultImage: result,
        config: finalConfig,
        items: currentItems,
        timestamp: Date.now(),
        type: 'generated'
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 10)); // Keep last 10

      addToast(t.toast_tryon_success, 'success');
    } catch (e) {
      if (isRequestAbortError(e)) {
        return;
      }
      if (isAuthError(e)) {
        handleAuthFailure("API key is invalid or expired. Please reconnect.");
      } else {
        addToast(t.toast_tryon_fail, 'error');
      }
      console.error(e);
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
      releaseRequestController(controller);
    }
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    setResultImage(item.resultImage);
    setLastSubmittedConfig(item.config);
    setLastSubmittedItems(item.items);
    setResultType(item.type); // Restore type
    setShowDetails(false);
    
    // Previous logic was to update base image automatically for edits, 
    // now we keep it manual for restoration too, unless user explicitly applies it.
    // However, if the user restores an edit history, they might expect to see the "Apply" button again.
    // Since we set resultType to 'edited', the Apply button will show up.
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleApplyResultToModel = () => {
    if (resultImage) {
        const rawBase64 = resultImage.replace(/^data:image\/[a-z]+;base64,/, "");
        setBaseImage(rawBase64);
        addToast(t.toast_applied_to_model, 'success');
    }
  };

  const handleUseResultAsGarment = () => {
    if (resultImage) {
      const rawBase64 = resultImage.replace(/^data:image\/[a-z]+;base64,/, "");
      let category = CLOTHING_CATEGORIES[1].id;
      if (selectedExtractCategory !== 'Full-body' && selectedExtractCategory !== 'Other') {
        category = selectedExtractCategory;
      }
      
      const newItem: GarmentItem = {
        id: Date.now().toString(),
        type: 'image',
        image: rawBase64,
        category: category,
        customDescription: selectedExtractCategory === 'Other' ? customExtractInput : ""
      };
      
      setGarmentItems(prev => [...prev, newItem]);
      setResultImage(null); 
      setResultType(null);
      addToast(t.toast_added_result, 'success');
    }
  };

  const handleDownloadComparison = async () => {
    if (!baseImage || !resultImage) return;
    
    addToast(t.toast_download_compare.replace('!', '...'), 'success');

    try {
        const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });

        const [img1, img2] = await Promise.all([
            loadImg(`data:image/jpeg;base64,${baseImage}`),
            loadImg(resultImage)
        ]);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate dimensions (side by side with margin)
        const gap = 40;
        const margin = 40;
        const textHeight = 80;
        
        // Scale height to match if needed (simple approach: maintain aspect ratio of individual images but max height matches)
        const height = Math.max(img1.height, img2.height);
        const scale1 = height / img1.height;
        const scale2 = height / img2.height;
        
        const w1 = img1.width * scale1;
        const w2 = img2.width * scale2;
        
        const totalWidth = w1 + w2 + gap + (margin * 2);
        const totalHeight = height + (margin * 2) + textHeight;

        canvas.width = totalWidth;
        canvas.height = totalHeight;

        // Background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Draw Images
        ctx.drawImage(img1, margin, margin + textHeight, w1, height);
        ctx.drawImage(img2, margin + w1 + gap, margin + textHeight, w2, height);

        // Labels
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        
        ctx.fillText(`${t.col3_original_label}`, margin + (w1 / 2), margin + 50);
        ctx.fillText("OutfitLab (After)", margin + w1 + gap + (w2 / 2), margin + 50);

        // Branding
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText("Generated by OutfitLab", totalWidth / 2, totalHeight - 15);

        // Download
        const link = document.createElement('a');
        link.download = `outfitlab-compare-${Date.now()}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
        
        addToast(t.toast_download_compare, 'success');
    } catch (e) {
        console.error(e);
        addToast("Failed to create comparison", 'error');
    }
  };

  // Helper to filter items for display in Result
  const usedTextItems = lastSubmittedItems.filter(item => item.type === 'text');
  const usedImageItems = lastSubmittedItems.filter(item => item.type === 'image');

  // --- Render Components ---
  return (
    <div className="min-h-screen bg-page text-slate-700 font-sans selection:bg-brand-200 flex flex-col">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {showApiKeyModal && (
        <ApiKeyModal
          onSuccess={(nextKey, nextProvider) => {
            saveProvider(nextProvider);
            setApiProvider(nextProvider);
            setApiKey(nextKey);
            setIsKeySet(true);
            setShowApiKeyModal(false);
            addToast("API key updated.", "success");
          }}
          onClose={() => setShowApiKeyModal(false)}
          provider={apiProvider}
          onProviderChange={(nextProvider) => {
            saveProvider(nextProvider);
            setApiProvider(nextProvider);
            const nextKey = getStoredApiKey(nextProvider);
            setApiKey(nextKey);
            setIsKeySet(Boolean(nextKey));
          }}
          lang={lang}
          initialValue={apiKey}
        />
      )}
      
      <Suspense fallback={null}>
        <AnalysisModal 
          isOpen={isAnalysisOpen} 
          onClose={() => setIsAnalysisOpen(false)} 
          result={analysisResult} 
          isLoading={isProcessing && processingType === 'analysis'} 
          lang={lang}
        />
      </Suspense>
      
      {/* Lightbox Overlay */}
      {isLightboxOpen && resultImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-w-5xl max-h-screen w-full h-full flex flex-col items-center justify-center">
             <img 
               src={resultImage} 
               alt="Full size result" 
               className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
               onClick={(e) => e.stopPropagation()} 
             />
             <div className="mt-6 flex gap-4" onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" onClick={() => setIsLightboxOpen(false)}>{t.col3_close}</Button>
                <a 
                   href={resultImage} 
                   download={`outfitlab-full-${Date.now()}.png`}
                   className="inline-flex items-center justify-center px-6 py-3 rounded-full font-medium transition-all duration-200 bg-brand-500 hover:bg-brand-600 text-white shadow-lg"
                 >
                   {t.col3_download_original}
                 </a>
             </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-6 py-5 bg-[#F4F6F7] backdrop-blur-md sticky top-0 z-40 flex justify-between items-center shadow-sm border-b border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-brand-200">
            {/* Beaker Icon for OutfitLab */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
              <path fillRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 004.25 22.5h15.5a1.875 1.875 0 001.865-2.071l-1.263-12a1.875 1.875 0 00-1.865-1.679H16.5V6a4.5 4.5 0 10-9 0zM12 3a3 3 0 00-3 3v.75h6V6a3 3 0 00-3-3zm-3 8.25a3 3 0 106 0v-.75a.75.75 0 01.75-.75h1.381c.533 0 .927.46.882.988l-1.263 12a.375.375 0 01-.374.336H4.25a.375.375 0 01-.374-.336l-1.263-12a.875.875 0 01.882-.988h1.381a.75.75 0 01.75.75v.75z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">{t.title}</h1>
            <p className="text-sm text-slate-500">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <label className="text-sm text-slate-500 hidden md:block">{textSizeLabel}</label>
          <select
            value={uiTextSize}
            onChange={(e) => setUiTextSize(e.target.value as UiTextSize)}
            className="bg-white/80 border border-slate-200 text-slate-600 text-sm rounded-lg p-2 shadow-sm outline-none focus:ring-1 focus:ring-brand-500 hover:bg-white"
            aria-label={textSizeLabel}
          >
            <option value="normal">{textSizeNormal}</option>
            <option value="comfortable">{textSizeComfortable}</option>
            <option value="large">{textSizeLarge}</option>
          </select>

          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="bg-white/80 border border-slate-200 text-slate-600 text-sm rounded-lg p-2 shadow-sm outline-none focus:ring-1 focus:ring-brand-500 hover:bg-white"
          >
            <option value="zh">繁體中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>

          <span className="hidden md:inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600">
            Provider: {providerLabel}
          </span>

          <button
            type="button"
            onClick={() => setShowApiKeyModal(true)}
            className="relative text-slate-500 hover:text-brand-600 hover:bg-white/50 p-2 rounded-xl transition-all duration-200 border border-transparent hover:border-slate-200"
            title="API Key Settings"
          >
            <span className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-white ${apiKey ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M15.75 1.5a.75.75 0 01.75.75V4.5h.75a3.75 3.75 0 013.75 3.75v2.432a1.5 1.5 0 01-.44 1.06l-5.25 5.25a1.5 1.5 0 01-1.06.44H11.25a3.75 3.75 0 01-3.75-3.75V9.75A3.75 3.75 0 0111.25 6h.75V2.25a.75.75 0 01.75-.75h3zm-2.25 4.5h1.5V3h-1.5v3zm-2.25 1.5A2.25 2.25 0 009 9.75v3.932c0 .596.237 1.169.659 1.591a2.25 2.25 0 001.591.659h3.932a.75.75 0 00.53-.22l5.038-5.038V8.25A2.25 2.25 0 0018.5 6h-7.25z" clipRule="evenodd" />
              <path d="M5.03 13.97a.75.75 0 011.06 0l2.94 2.94a.75.75 0 11-1.06 1.06l-2.94-2.94a.75.75 0 010-1.06z" />
              <path d="M2.25 16.5a.75.75 0 00-.75.75v1.5A3.75 3.75 0 005.25 22.5h1.5a.75.75 0 000-1.5h-1.5A2.25 2.25 0 013 18.75v-1.5a.75.75 0 00-.75-.75z" />
            </svg>
          </button>

          <a
            href="https://tingyusdeco.com"
            className="text-slate-500 hover:text-brand-600 hover:bg-white/50 p-2 rounded-xl transition-all duration-200 border border-transparent hover:border-slate-200"
            title="Home"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
              <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
            </svg>
          </a>
        </div>
      </header>
      
      {/* Main Dashboard Grid */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto h-full">
          
          {/* Column 1: The Model (Source) - Span 3 */}
          <div className="lg:col-span-3 flex flex-col gap-4 animate-fade-in">
             <div className="flex items-center gap-2 mb-1">
                <span className="bg-panel text-slate-500 shadow-sm w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border border-slate-200">1</span>
                <h2 className="font-bold text-slate-800">{t.col1_title}</h2>
             </div>
             
             <div className="bg-panel rounded-2xl p-4 border border-slate-200 flex flex-col gap-4 h-full shadow-soft">
                <ImageUploader 
                  key={`model-${resetKey}`}
                  label={t.upload_label} 
                  dragText={t.upload_drag}
                  changeText={t.upload_change}
                  onImageSelected={setBaseImage}
                  currentImage={baseImage}
                  className="w-full aspect-[3/4]"
                  aspectRatio="aspect-[3/4]"
                />

                {/* AI Analysis Button */}
                <div className="border-b border-slate-200 pb-4">
                  <Button 
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white shadow-md border-0"
                    onClick={handleAnalyze}
                    disabled={!baseImage || isProcessing}
                    icon={<span className="text-lg">AI</span>}
                  >
                    {t.col1_analyze_btn}
                  </Button>
                  <p className="text-sm text-center text-slate-400 mt-2">
                    {t.col1_analyze_desc}
                  </p>
                </div>
                
                {/* TOOLBOX PANEL (Tabs) */}
                <div className="mt-auto flex flex-col h-[280px]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-brand-600">{t.col1_tool_label}</h3>
                  </div>

                  {/* Tabs */}
                  <div className="flex p-1 bg-input rounded-xl border border-slate-200 shadow-inner-light mb-3">
                    <button 
                      onClick={() => setCol1ToolMode('extract')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all truncate px-1 ${col1ToolMode === 'extract' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t.col1_tab_extract}
                    </button>
                    <button 
                      onClick={() => setCol1ToolMode('edit')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all truncate px-1 ${col1ToolMode === 'edit' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t.col1_tab_edit}
                    </button>
                    <button 
                      onClick={() => setCol1ToolMode('recolor')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all truncate px-1 ${col1ToolMode === 'recolor' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t.col1_tab_recolor}
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 flex flex-col gap-3">
                     {col1ToolMode === 'extract' ? (
                       <div className="flex flex-col gap-3 animate-fade-in h-full">
                          <p className="text-sm text-slate-500 h-8 line-clamp-2">{t.col1_extract_desc}</p>
                          <select 
                            className="w-full bg-input border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm"
                            value={selectedExtractCategory}
                            onChange={(e) => setSelectedExtractCategory(e.target.value)}
                          >
                            {CLOTHING_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{(cat as any)[lang]}</option>)}
                          </select>

                          {selectedExtractCategory === 'Other' && (
                            <input 
                              type="text" 
                              className="w-full bg-input border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm placeholder:text-slate-300"
                              placeholder={t.col1_extract_placeholder}
                              value={customExtractInput}
                              onChange={(e) => setCustomExtractInput(e.target.value)}
                            />
                          )}

                          <Button 
                            variant="secondary" 
                            className="w-full text-sm py-2 bg-white mt-auto" 
                            onClick={handleExtract}
                            disabled={!baseImage || isProcessing}
                            isLoading={isProcessing && processingType === 'extract'}
                          >
                            {t.col1_extract_btn}
                          </Button>
                       </div>
                     ) : col1ToolMode === 'edit' ? (
                       <div className="flex flex-col gap-3 h-full animate-fade-in">
                          <p className="text-sm text-slate-500 h-8 line-clamp-2">{t.col1_edit_desc}</p>
                          <textarea 
                            className="w-full bg-input border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm placeholder:text-slate-300 resize-none flex-1"
                            placeholder={t.col1_edit_placeholder}
                            value={magicEditInput}
                            onChange={(e) => setMagicEditInput(e.target.value)}
                          />
                          <Button 
                            variant="secondary" 
                            className="w-full text-sm py-2 bg-white mt-auto" 
                            onClick={handleMagicEdit}
                            disabled={!baseImage || !magicEditInput.trim() || isProcessing}
                            isLoading={isProcessing && processingType === 'edit'}
                            icon={<span className="text-sm">Edit</span>}
                          >
                            {t.col1_edit_btn}
                          </Button>
                       </div>
                     ) : (
                       <div className="flex flex-col gap-3 h-full animate-fade-in">
                          <p className="text-sm text-slate-500 line-clamp-2">{t.col1_recolor_desc}</p>
                          
                          <input 
                            type="text" 
                            className="w-full bg-input border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm placeholder:text-slate-300"
                            placeholder={t.col1_recolor_target_placeholder}
                            value={recolorTarget}
                            onChange={(e) => setRecolorTarget(e.target.value)}
                          />

                          {/* Color Picker & Text Input Combo */}
                          <div className="flex items-center gap-3">
                             <label className="cursor-pointer group">
                                <div 
                                  className="w-10 h-10 rounded-full border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden relative transition-transform group-hover:scale-105"
                                  style={{ backgroundColor: recolorValue.startsWith('#') ? recolorValue : '#ffffff' }}
                                >
                                  {/* Fallback icon if no color selected or text entered */}
                                  {!recolorValue.startsWith('#') && <span className="text-sm text-slate-400">Color</span>}
                                  
                                  <input 
                                    type="color" 
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                    onChange={(e) => setRecolorValue(e.target.value)}
                                  />
                                </div>
                             </label>
                             <div className="flex-1">
                                <input 
                                  type="text" 
                                  className="w-full bg-input border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm placeholder:text-slate-300"
                                  placeholder={t.col1_recolor_color_placeholder}
                                  value={recolorValue}
                                  onChange={(e) => setRecolorValue(e.target.value)}
                                />
                             </div>
                          </div>

                          <Button 
                            variant="secondary" 
                            className="w-full text-sm py-2 bg-white mt-auto" 
                            onClick={handleRecolor}
                            disabled={!baseImage || !recolorTarget.trim() || !recolorValue.trim() || isProcessing}
                            isLoading={isProcessing && processingType === 'edit'}
                            icon={<span className="text-sm">Color</span>}
                          >
                            {t.col1_recolor_btn}
                          </Button>
                       </div>
                     )}
                  </div>
                </div>
             </div>
          </div>

          {/* Column 2: The Look (Garment & Config) - Span 4 */}
          <div className="lg:col-span-4 flex flex-col gap-4 animate-fade-in" style={{animationDelay: '0.1s'}}>
             <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <span className="bg-panel text-slate-500 shadow-sm w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border border-slate-200">2</span>
                    <h2 className="font-bold text-slate-800">{t.col2_title}</h2>
                </div>
             </div>

             <div className="bg-panel rounded-2xl p-4 border border-slate-200 flex flex-col gap-5 h-full shadow-soft">
                
                {/* Mode Switcher for Adding Items */}
                <div className="flex p-1 bg-input rounded-xl border border-slate-200 shadow-inner-light">
                  <button 
                    onClick={() => setInputMode('image')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${inputMode === 'image' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t.col2_tab_image}
                  </button>
                  <button 
                    onClick={() => setInputMode('text')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${inputMode === 'text' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t.col2_tab_text}
                  </button>
                </div>

                {/* Input Area */}
                <div className="relative min-h-[140px]">
                   {inputMode === 'image' ? (
                      <ImageUploader 
                        key={`add-garment-${garmentItems.length}-${resetKey}`} 
                        label={t.col2_tab_image}
                        dragText={t.upload_drag}
                        changeText={t.upload_change}
                        onImageSelected={handleAddGarmentImage} 
                        className="w-full h-32"
                        aspectRatio="h-full" 
                      />
                   ) : (
                      <div className="flex flex-col gap-3 h-full animate-fade-in">
                         {/* Quick Style Presets */}
                         <div className="mb-1">
                            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                              <span>{t.col2_quick_styles}</span>
                              <span className="h-px bg-slate-200 flex-1"></span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {STYLE_PRESETS.map((preset) => (
                                <button
                                  key={`${preset.category}-${preset.text}`}
                                  onClick={() => {
                                    setTextGarmentInput(preset.text);
                                    setTextGarmentCategory(preset.category);
                                  }}
                                  className="text-sm px-2.5 py-1.5 bg-white border border-slate-200 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all shadow-sm text-slate-600 whitespace-nowrap"
                                >
                                  {(preset.label as any)[lang] || preset.label.en}
                                </button>
                              ))}
                            </div>
                         </div>

                         {/* Category Select for Text Item */}
                         <div className="flex gap-2">
                           <select 
                              className="w-1/3 bg-input border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none"
                              value={textGarmentCategory}
                              onChange={(e) => setTextGarmentCategory(e.target.value)}
                           >
                              {CLOTHING_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{(cat as any)[lang]}</option>)}
                           </select>
                           <input 
                              type="text"
                              className="flex-1 bg-input border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none placeholder:text-slate-400"
                              placeholder={t.col2_desc_placeholder}
                              value={textGarmentInput}
                              onChange={(e) => setTextGarmentInput(e.target.value)}
                           />
                         </div>

                         {/* AI Recommendations Chips */}
                         {recommendations.length > 0 && (
                           <div className="flex flex-wrap gap-2 mt-1">
                             <span className="text-sm text-slate-400 flex items-center">{t.col2_ai_rec}</span>
                             {recommendations.map((rec, idx) => (
                               <button 
                                 key={idx}
                                 onClick={() => {
                                   setTextGarmentInput(rec);
                                   // Try to guess category or default to 'Other'
                                   setTextGarmentCategory('Other');
                                 }}
                                 className="text-sm bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 rounded-full px-2 py-1 transition-colors text-left"
                               >
                                 + {rec}
                               </button>
                             ))}
                           </div>
                         )}

                         <Button 
                            variant="secondary" 
                            className="w-full h-9 text-sm mt-auto"
                            onClick={handleAddGarmentText}
                         >
                            {t.col2_add_btn}
                         </Button>
                      </div>
                   )}
                </div>

                {/* Scrollable List of Items */}
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4 min-h-[200px] border-t border-slate-100 pt-4">
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t.col2_selected} ({garmentItems.length})</h3>
                   
                   {/* List of uploaded items */}
                   {garmentItems.map((item, index) => (
                     <div key={item.id} className="bg-input rounded-xl p-3 border border-slate-200 flex gap-4 items-start animate-fade-in shadow-sm">
                        {/* Thumbnail or Text Icon */}
                        <div className="w-20 h-24 bg-white/50 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100 flex items-center justify-center">
                           {item.type === 'image' && item.image ? (
                             <img src={`data:image/jpeg;base64,${item.image}`} className="w-full h-full object-contain mix-blend-multiply" alt="Item" />
                           ) : (
                             <div className="text-center p-2">
                               <span className="text-2xl">??</span>
                               <p className="text-[9px] text-slate-400 mt-1 leading-tight">Text<br/>Item</p>
                             </div>
                           )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                           <div className="flex justify-between items-start">
                             <span className="text-sm font-bold text-slate-400">Item #{index + 1}</span>
                             <button 
                               onClick={() => handleRemoveGarment(item.id)}
                               className="text-slate-400 hover:text-red-400 p-1"
                             >
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                           </div>
                           
                           <div>
                             <label className="text-sm text-slate-500 block mb-1">{t.col2_item_label}</label>
                             <select 
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none"
                                value={item.category}
                                onChange={(e) => handleUpdateGarmentCategory(item.id, e.target.value)}
                              >
                                {CLOTHING_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{(cat as any)[lang]}</option>)}
                              </select>
                           </div>

                           {/* Custom Description Input */}
                           {(item.type === 'text' || item.category === 'Other') && (
                              <input 
                                type="text"
                                placeholder={t.col2_desc_placeholder}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none mt-1 animate-fade-in placeholder:text-slate-300"
                                value={item.customDescription || ""}
                                onChange={(e) => handleUpdateGarmentDescription(item.id, e.target.value)}
                              />
                           )}
                        </div>
                     </div>
                   ))}

                   {garmentItems.length === 0 && (
                     <div className="text-center py-8 text-slate-400 text-sm whitespace-pre-wrap">
                       {t.col2_empty}
                     </div>
                   )}

                </div>

                {/* Configuration Area */}
                <div className="pt-4 border-t border-slate-200 flex-shrink-0 space-y-4">
                   
                   {/* Background Config */}
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                         <label className="text-sm font-medium text-slate-500">{t.col2_bg_title}</label>
                         <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTryOnConfig(c => ({...c, keepBackground: !c.keepBackground}))}>
                            <span className="text-sm text-slate-500">{tryOnConfig.keepBackground ? t.col2_bg_keep : t.col2_bg_change}</span>
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${tryOnConfig.keepBackground ? 'bg-brand-400' : 'bg-slate-300'}`}>
                              <div className={`w-3 h-3 rounded-full bg-white transition-transform shadow-sm ${tryOnConfig.keepBackground ? 'translate-x-4' : ''}`} />
                            </div>
                         </div>
                      </div>

                      {!tryOnConfig.keepBackground && (
                        <div className="space-y-2 animate-fade-in">
                          <select 
                            className="w-full bg-input border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm"
                            value={tryOnConfig.backgroundPrompt}
                            onChange={(e) => setTryOnConfig({...tryOnConfig, backgroundPrompt: e.target.value})}
                          >
                            <option value={CUSTOM_BG_KEY}>{t.col2_bg_custom}</option>
                            <optgroup label="專業棚景 (Studio)">
                              {STUDIO_STYLES.filter(s => s.category === 'STUDIO').map((style, idx) => (
                                <option key={`studio-${idx}`} value={style.prompt}>{(style.label as any)[lang]}</option>
                              ))}
                            </optgroup>
                            <optgroup label="真實場景 (Location)">
                              {STUDIO_STYLES.filter(s => s.category === 'LOCATION').map((style, idx) => (
                                <option key={`loc-${idx}`} value={style.prompt}>{(style.label as any)[lang]}</option>
                              ))}
                            </optgroup>
                          </select>

                          {tryOnConfig.backgroundPrompt === CUSTOM_BG_KEY && (
                            <textarea
                              className="w-full bg-input border border-brand-200 rounded-lg px-3 py-2 text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none text-sm min-h-[60px] shadow-sm placeholder:text-slate-300"
                              placeholder={t.col2_bg_custom_placeholder}
                              value={customBgInput}
                              onChange={(e) => setCustomBgInput(e.target.value)}
                            />
                          )}
                        </div>
                      )}
                   </div>
                   
                   {/* Aspect Ratio */}
                   <div className="space-y-2">
                       <label className="text-sm font-medium text-slate-500">{t.col2_ratio}</label>
                       <select 
                          className="w-full bg-input border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm"
                          value={tryOnConfig.aspectRatio}
                          onChange={(e) => setTryOnConfig({...tryOnConfig, aspectRatio: e.target.value})}
                        >
                          {ASPECT_RATIOS.map((ratio) => (
                            <option key={ratio.id} value={ratio.id}>{ratio.label}</option>
                          ))}
                        </select>
                   </div>

                   {/* Primary Action */}
                   <div className="pt-2">
                      <Button 
                        className="w-full py-4 text-base shadow-lg shadow-brand-500/20" 
                        onClick={handleTryOn} 
                        disabled={!baseImage || garmentItems.length === 0 || isProcessing}
                        isLoading={isProcessing && processingType === 'try-on'}
                      >
                        {t.col2_start_btn}
                      </Button>
                   </div>
                </div>
             </div>
          </div>

          {/* Column 3: The Studio (Result) - Span 5 */}
          <div className="lg:col-span-5 flex flex-col gap-4 animate-fade-in" style={{animationDelay: '0.2s'}}>
             <div className="flex items-center gap-2 mb-1">
                <span className="bg-panel text-slate-500 shadow-sm w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border border-slate-200">3</span>
                <h2 className="font-bold text-slate-800">{t.col3_title}</h2>
             </div>

             <div className="bg-panel rounded-2xl p-1 border border-slate-200 h-full shadow-soft relative flex flex-col overflow-hidden">
                {/* Result Display Area */}
                <div className="flex-1 bg-white rounded-xl m-3 border border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group shadow-inner-light select-none">
                   {isProcessing ? (
                      <div className="text-center p-8 flex flex-col items-center">
                         <div className="w-20 h-20 relative mb-6">
                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-brand-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">??</div>
                         </div>
                         
                         {/* Dynamic Loading Message */}
                         <p className="text-lg font-bold text-slate-700 animate-fade-in min-h-[28px]">
                           {processingType === 'try-on' 
                              ? t.loading_steps[loadingStep] 
                              : processingType === 'analysis' 
                                ? t.col3_loading_titles[0]
                                : processingType === 'edit'
                                  ? t.col3_loading_titles[2]
                                  : t.col3_loading_titles[1]}
                         </p>
                         <p className="text-sm text-slate-400 mt-2">AI requires 10-15s</p>
                      </div>
                   ) : resultImage ? (
                      <>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
                        
                        {/* Compare Logic: Show Base Image if pressing, else show Result */}
                        <img 
                          src={(showOriginal && baseImage) ? `data:image/jpeg;base64,${baseImage}` : resultImage} 
                          className="w-full h-full object-contain z-10 animate-fade-in cursor-zoom-in" 
                          alt="Result" 
                          onClick={() => setIsLightboxOpen(true)}
                        />

                        {/* Compare Button Overlay */}
                        {baseImage && (
                           <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                              <button
                                className={`
                                  flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold shadow-lg transition-all
                                  ${showOriginal 
                                     ? 'bg-brand-500 text-white scale-105' 
                                     : 'bg-white/80 backdrop-blur text-slate-600 hover:bg-white'
                                  }
                                `}
                                onMouseDown={() => setShowOriginal(true)}
                                onMouseUp={() => setShowOriginal(false)}
                                onMouseLeave={() => setShowOriginal(false)}
                                onTouchStart={() => setShowOriginal(true)}
                                onTouchEnd={() => setShowOriginal(false)}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                {showOriginal ? t.col3_original_label : t.col3_compare_label}
                              </button>
                           </div>
                        )}

                        {/* Hover Actions */}
                        <div className={`absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-20 backdrop-blur-sm ${showOriginal ? 'hidden' : ''}`}>
                           <Button variant="primary" className="shadow-lg" onClick={() => setIsLightboxOpen(true)} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>}>
                             {t.col3_zoom}
                           </Button>
                        </div>
                      </>
                   ) : (
                      <div className="text-center text-slate-400 p-8">
                         <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                           <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                         </div>
                         <p>{t.col3_waiting}</p>
                         <p className="text-sm mt-1">{t.col3_waiting_desc}</p>
                      </div>
                   )}
                </div>

                {/* Result Meta / Actions */}
                {resultImage && !isProcessing && (
                  <div className="px-6 py-4 bg-white border-t border-slate-100 animate-fade-in flex flex-col gap-4">
                     
                     {/* Minimalist Action Bar */}
                     <div className="flex flex-col items-center justify-center gap-4">
                       
                       <div className="flex gap-2 w-full">
                          <a 
                             href={resultImage} 
                             download={`outfitlab-${resultType}-${Date.now()}.png`}
                             className="flex-1 bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-md"
                          >
                             <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                             {t.col3_btn_download}
                          </a>
                          
                          {/* Generic Compare Button for all types */}
                          {baseImage && (
                             <button
                               onClick={handleDownloadComparison}
                               className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                             >
                               <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                               {t.col3_btn_compare}
                             </button>
                          )}

                          {resultType === 'extracted' && (
                             <Button variant="ghost" className="flex-1 text-sm h-10 px-3" onClick={handleUseResultAsGarment}>
                               {t.col3_btn_use} &rarr;
                             </Button>
                          )}

                          {resultType === 'edited' && (
                             <Button variant="ghost" className="flex-1 text-sm h-10 px-3" onClick={handleApplyResultToModel}>
                               {t.col3_btn_apply_model}
                             </Button>
                          )}
                       </div>

                       {/* Compact Meta Data Pills */}
                       {resultType === 'generated' && lastSubmittedConfig && (
                         <div className="flex flex-wrap gap-2 justify-center w-full">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-500 border border-slate-200">
                               背景：{getBackgroundLabel(lastSubmittedConfig)}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-500 border border-slate-200">
                               比例：{getAspectRatioLabel(lastSubmittedConfig.aspectRatio)}
                            </span>
                         </div>
                       )}
                     </div>
                     
                     {/* Collapsible Design Specs */}
                     {resultType === 'generated' && lastSubmittedConfig && (usedImageItems.length > 0 || usedTextItems.length > 0) && (
                        <div className="border-t border-slate-100 pt-2 animate-fade-in">
                           <button 
                             onClick={() => setShowDetails(!showDetails)}
                             className="w-full text-center text-sm text-brand-500 hover:text-brand-600 font-medium py-2 flex items-center justify-center gap-1 transition-colors"
                           >
                              {showDetails ? t.col3_hide_details : t.col3_view_details}
                              <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                           </button>

                           {showDetails && (
                             <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shadow-inner-light animate-fade-in-down">
                               <div className="divide-y divide-slate-100">
                                 {usedImageItems.map((item) => (
                                   <div key={item.id} className="flex items-center gap-3 p-3 bg-white">
                                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 relative">
                                         {item.image && <img src={`data:image/jpeg;base64,${item.image}`} className="w-full h-full object-cover" alt="item" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                         <p className="text-sm font-bold text-slate-700">
                                           {CLOTHING_CATEGORIES.find(c => c.id === item.category)?.zh || item.category}
                                         </p>
                                      </div>
                                   </div>
                                 ))}
                                 {usedTextItems.map((item) => (
                                   <div key={item.id} className="flex items-center gap-3 p-3 bg-white">
                                      <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-500 flex-shrink-0">
                                         <span className="text-sm font-bold">Aa</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                         <p className="text-sm font-bold text-slate-700 break-words line-clamp-1">
                                           {item.customDescription}
                                         </p>
                                      </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                        </div>
                     )}

                     {/* HISTORY GALLERY - Minimalist */}
                     {history.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 animate-fade-in">
                          <div className="flex items-center justify-between px-1 pb-1">
                            <p className="text-sm uppercase tracking-wider text-slate-400">History</p>
                            <button
                              type="button"
                              onClick={handleClearHistory}
                              className="text-sm text-rose-500 hover:text-rose-600"
                            >
                              Clear All
                            </button>
                          </div>
                          <div className="flex gap-2 overflow-x-auto py-2 custom-scrollbar no-scrollbar">
                            {history.map((item) => (
                              <div key={item.id} className="relative flex-shrink-0">
                                <button 
                                  onClick={() => handleRestoreHistory(item)}
                                  className={`
                                    relative w-12 h-16 rounded-md overflow-hidden border transition-all opacity-80 hover:opacity-100
                                    ${resultImage === item.resultImage ? 'border-brand-500 ring-1 ring-brand-500 opacity-100' : 'border-slate-200'}
                                  `}
                                >
                                  <img src={item.resultImage} className="w-full h-full object-cover" alt="History" />
                                  {item.type !== 'generated' && (
                                    <div className="absolute top-0 right-0 p-0.5 bg-black/40 rounded-bl-md">
                                      <span className="text-sm text-white px-1">
                                        {item.type === 'extracted' ? 'Cut' : 'Edit'}
                                      </span>
                                    </div>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHistoryItem(item.id)}
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-rose-300 text-rose-500 text-sm leading-none"
                                  aria-label="Delete history item"
                                >
                                  ?
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                     )}
                  </div>
                )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;





