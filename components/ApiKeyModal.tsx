import React, { useEffect, useMemo, useState } from 'react';
import Button from './Button';
import { clearApiKey, saveApiKey, validateApiKey } from '../services/geminiService';
import { Language } from '../types';

interface ApiKeyModalProps {
  onSuccess: (apiKey: string) => void;
  onClose?: () => void;
  lang: Language;
  initialValue?: string;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  onSuccess,
  onClose,
  lang,
  initialValue = '',
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(initialValue);
  const [rememberKey, setRememberKey] = useState(true);

  const isZh = lang === 'zh';
  const trimmedKey = useMemo(() => inputKey.trim(), [inputKey]);

  useEffect(() => {
    setInputKey(initialValue);
    setError(null);
    setStatus(null);
  }, [initialValue]);

  const persistKey = (apiKey: string) => {
    if (rememberKey) {
      saveApiKey(apiKey);
      sessionStorage.removeItem('gemini_api_key');
      return;
    }
    clearApiKey();
    sessionStorage.setItem('gemini_api_key', apiKey);
  };

  const handleTest = async () => {
    if (!trimmedKey) {
      setError(isZh ? '請先輸入 API Key。' : 'Please enter API key first.');
      return;
    }
    setIsTesting(true);
    setError(null);
    setStatus(null);
    try {
      const ok = await validateApiKey(trimmedKey);
      if (!ok) {
        setError(isZh ? 'API Key 測試失敗，請確認 Key 是否有效。' : 'API key appears invalid.');
        return;
      }
      setStatus(isZh ? 'API Key 測試成功。' : 'API key looks valid.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || (isZh ? 'API Key 測試失敗，請稍後再試。' : 'API key test failed. Please retry.'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!trimmedKey) {
      setError(isZh ? '請輸入 API Key。' : 'Please enter your API key.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setStatus(null);
    try {
      persistKey(trimmedKey);
      onSuccess(trimmedKey);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || (isZh ? '儲存失敗，請再試一次。' : 'Save failed, please retry.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setInputKey('');
    setStatus(null);
    setError(null);
    clearApiKey();
    sessionStorage.removeItem('gemini_api_key');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-[460px] bg-[#F4F3F6] border border-[#E1DEE8] rounded-3xl p-7 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full border border-[#BBA8C9] text-[#9D79B9] flex items-center justify-center mx-auto">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-[34px] font-semibold text-[#4E445A] leading-tight">
            {isZh ? '輸入您的 Gemini API Key' : 'Enter your Gemini API Key'}
          </h2>
          <p className="text-sm text-[#6F647C] leading-6">
            {isZh
              ? '我們需要您的 Gemini API Key 來執行 AI 生成。金鑰僅儲存在您的瀏覽器。'
              : 'We need your Gemini API key for AI generation. Your key stays in your browser only.'}
          </p>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-[#8C73AD] text-sm underline underline-offset-4">
            {isZh ? '獲取 API Key' : 'Get API Key'}
          </a>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[#71657E]">Gemini API Key</label>
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="AIza..."
            className="w-full rounded-2xl border border-[#BFD5D2] bg-[#D4E3E2] px-4 py-3 text-[#3D3651] tracking-wide outline-none focus:ring-2 focus:ring-[#A98ABF]"
          />
        </div>

        <div className="space-y-1 text-sm text-[#5D536A]">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={rememberKey}
              onChange={(e) => setRememberKey(e.target.checked)}
              className="h-4 w-4 rounded border-[#7FA4AA] text-[#34859B] focus:ring-[#34859B]"
            />
            <span>{isZh ? '記住金鑰 (下次自動帶入)' : 'Remember Key (Auto-fill next time)'}</span>
          </label>
          <p className="text-[#7A7084] pl-6">
            {isZh
              ? '勾選後會存到 LocalStorage；若使用公用電腦，建議取消勾選（僅存於 SessionStorage）。'
              : 'Checked: save in LocalStorage. Unchecked: save in SessionStorage only.'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#D8D2E0] bg-[#F1EFF5] px-4 py-3">
          <div className="text-[#736281] font-medium mb-2">{isZh ? '安全聲明' : 'Security Notice'}</div>
          <ul className="list-disc pl-4 text-sm text-[#756A83] space-y-1">
            <li>{isZh ? '金鑰僅存在你的瀏覽器儲存空間，不會上傳到你的伺服器。' : 'Key is stored only in your browser storage, not uploaded to your server.'}</li>
            <li>{isZh ? '前端直接呼叫 Gemini API，請使用 HTTPS 環境。' : 'Frontend calls Gemini API directly; use HTTPS environment.'}</li>
            <li>{isZh ? '建議定期輪替金鑰，公用裝置使用後請清除。' : 'Rotate keys periodically and clear on shared devices.'}</li>
          </ul>
        </div>

        {status && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</div>}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <div className="grid grid-cols-1 gap-3">
          <Button onClick={handleTest} isLoading={isTesting} disabled={!trimmedKey || isSaving} variant="secondary" className="w-full rounded-xl">
            {isZh ? '測試 Key 有效性' : 'Test Key Validity'}
          </Button>
          <div className="flex gap-3">
            <Button onClick={handleSave} isLoading={isSaving} disabled={!trimmedKey || isTesting} className="flex-1 rounded-xl">
              {isZh ? '儲存金鑰' : 'Save Key'}
            </Button>
            <Button onClick={onClose} variant="secondary" disabled={isSaving || isTesting} className="rounded-xl px-5">
              {isZh ? '取消' : 'Cancel'}
            </Button>
            <Button onClick={handleClear} variant="outline" disabled={isSaving || isTesting} className="rounded-xl px-5 border-rose-300 text-rose-500 hover:bg-rose-50">
              {isZh ? '清除' : 'Clear'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
