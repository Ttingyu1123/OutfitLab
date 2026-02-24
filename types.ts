
export interface ClothingCategory {
  id: string;
  zh: string;
  en: string;
  ja: string;
  ko: string;
}

export type Language = 'zh' | 'en' | 'ja' | 'ko';
export type AIProvider = 'gemini' | 'openai';

export enum AppMode {
  UPLOAD_BASE = 'UPLOAD_BASE',
  SELECT_ACTION = 'SELECT_ACTION',
  EXTRACT = 'EXTRACT',
  TRY_ON = 'TRY_ON',
  RESULT = 'RESULT',
}

export interface GarmentItem {
  id: string;
  type: 'image' | 'text';
  image?: string;
  category: string; 
  customDescription?: string;
}

export interface TryOnConfig {
  keepBackground: boolean;
  backgroundPrompt?: string;
  aspectRatio: string;
}
