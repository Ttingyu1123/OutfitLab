import { Language } from '../types';

type PresetLabel = Record<Language, string>;

export interface StylePreset {
  label: PresetLabel;
  text: string;
  category: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    label: { zh: '俐落通勤 (Office)', en: 'Office Chic', ja: 'オフィスシック', ko: '오피스 시크' },
    text: 'Tailored beige blazer with a white silk blouse',
    category: 'Jacket/Blazer'
  },
  {
    label: { zh: '霓虹未來 (Cyber)', en: 'Cyber Neon', ja: 'サイバーネオン', ko: '사이버 네온' },
    text: 'Holographic transparent raincoat with neon trim',
    category: 'Coat'
  },
  {
    label: { zh: '復古優雅 (Vintage)', en: 'Vintage Elegance', ja: 'ヴィンテージエレガンス', ko: '빈티지 엘레강스' },
    text: '1950s red polka dot midi dress with white collar',
    category: 'Dress'
  },
  {
    label: { zh: '街頭休閒 (Street)', en: 'Street Casual', ja: 'ストリートカジュアル', ko: '스트리트 캐주얼' },
    text: 'Oversized black graphic hoodie with white logo',
    category: 'Sweater/Knitwear'
  },
  {
    label: { zh: '波西米亞 (Boho)', en: 'Boho Vibes', ja: 'ボヘミアン', ko: '보헤미안' },
    text: 'Floral embroidered denim vest with fringe details',
    category: 'Jacket/Blazer'
  },
  {
    label: { zh: '晚宴華麗 (Gala)', en: 'Gala Glam', ja: 'ガラグラム', ko: '갈라 글램' },
    text: 'Floor-length gold sequin evening gown',
    category: 'Dress'
  }
];
