export { TRANSLATIONS } from './locales/translations';

export const MODEL_IMAGE_EDIT = 'gemini-3-pro-image-preview';
export const MODEL_ANALYSIS = 'gemini-3-pro-image-preview';
export const CUSTOM_BG_KEY = 'custom-user-wish';

export const CLOTHING_CATEGORIES = [
  { id: 'Full-body', zh: '全身套裝', en: 'Full-body', ja: 'Full-body', ko: 'Full-body' },
  { id: 'Blouse/Shirt', zh: '襯衫 / 上衣', en: 'Blouse/Shirt', ja: 'Blouse/Shirt', ko: 'Blouse/Shirt' },
  { id: 'Trousers/Pants', zh: '褲子', en: 'Trousers/Pants', ja: 'Trousers/Pants', ko: 'Trousers/Pants' },
  { id: 'Skirt', zh: '裙子', en: 'Skirt', ja: 'Skirt', ko: 'Skirt' },
  { id: 'Dress', zh: '洋裝', en: 'Dress', ja: 'Dress', ko: 'Dress' },
  { id: 'Jacket/Blazer', zh: '外套 / 西裝外套', en: 'Jacket/Blazer', ja: 'Jacket/Blazer', ko: 'Jacket/Blazer' },
  { id: 'Coat', zh: '大衣', en: 'Coat', ja: 'Coat', ko: 'Coat' },
  { id: 'Sweater/Knitwear', zh: '毛衣 / 針織', en: 'Sweater/Knitwear', ja: 'Sweater/Knitwear', ko: 'Sweater/Knitwear' },
  { id: 'Footwear', zh: '鞋類', en: 'Footwear', ja: 'Footwear', ko: 'Footwear' },
  { id: 'Handbag/Clutch', zh: '手提包 / 晚宴包', en: 'Handbag/Clutch', ja: 'Handbag/Clutch', ko: 'Handbag/Clutch' },
  { id: 'Jewelry', zh: '飾品', en: 'Jewelry', ja: 'Jewelry', ko: 'Jewelry' },
  { id: 'Hat', zh: '帽子', en: 'Hat', ja: 'Hat', ko: 'Hat' },
  { id: 'Scarf', zh: '圍巾', en: 'Scarf', ja: 'Scarf', ko: 'Scarf' },
  { id: 'Belt', zh: '腰帶', en: 'Belt', ja: 'Belt', ko: 'Belt' },
  { id: 'Glasses', zh: '眼鏡', en: 'Glasses', ja: 'Glasses', ko: 'Glasses' },
  { id: 'Gloves', zh: '手套', en: 'Gloves', ja: 'Gloves', ko: 'Gloves' },
  { id: 'Other', zh: '其他', en: 'Other', ja: 'Other', ko: 'Other' }
];

export const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 (Square)' },
  { id: '3:4', label: '3:4 (Portrait)' },
  { id: '4:3', label: '4:3 (Landscape)' },
  { id: '9:16', label: '9:16 (Story)' },
  { id: '16:9', label: '16:9 (Widescreen)' }
];

const styleLabel = (zh: string, en: string) => ({ zh, en, ja: en, ko: en });

export const STUDIO_STYLES = [
  {
    label: styleLabel('極簡白棚', 'Minimalist White (Studio)'),
    prompt: 'Professional fashion studio setup. Infinite white cyclorama background. High-key lighting, soft and even illumination from large softboxes. The subject casts realistic soft shadows on the white floor. Commercial e-commerce look, clean and crisp.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('經典灰棚', 'Classic Grey (Studio)'),
    prompt: 'Professional studio portrait. Medium grey seamless paper background. Rembrandt lighting setup creating subtle dimension on the face and clothes. Sharp focus, elegant and timeless aesthetic.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('全黑戲劇棚', 'Pitch Black (Studio)'),
    prompt: 'Professional studio photography. Pitch black background. Rim lighting (backlight) highlighting the edges of the subject and the texture of the garment. Low-key, dramatic, and mysterious.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('柔布背景', 'Soft Drapery (Elegant)'),
    prompt: 'Studio setup with draped fabric background (neutral beige or silk). Soft, diffused window-style lighting. Romantic and ethereal atmosphere. Shallow depth of field.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('聚光焦點', 'Spotlight (Artistic)'),
    prompt: 'High-fashion studio editorial. Dark environment with a single sharp spotlight hitting the subject (butterfly lighting). High contrast, dramatic shadows, focusing entirely on the outfit.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('高飽和彩色棚', 'Color Pop (Vibrant)'),
    prompt: 'Creative studio photography. Vibrant solid color background (e.g., electric blue or coral). Hard flash lighting with strong shadows behind the subject. Pop-art fashion style, energetic and bold.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('霓虹未來感', 'Neon Cyber (Futuristic)'),
    prompt: 'Futuristic studio setup. Dark background with glowing neon light tubes (pink and teal). Cyberpunk aesthetic. Colored lighting reflecting on the subject skin and clothes.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('大地色畫布', 'Earth Tones (Artistic)'),
    prompt: 'Artistic studio shot. Hand-painted canvas background in muted earth tones (olive, terracotta, beige). Soft ambient lighting. Painterly texture, sophisticated and calm.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('幾何光影', 'Geometric Shadows (Modern)'),
    prompt: 'Modern studio set. White walls with sharp geometric shadows cast by gobos. Hard sunlight simulation. Minimalist architecture vibe, clean lines and shapes.',
    category: 'STUDIO'
  },
  {
    label: styleLabel('時裝伸展台', 'Fashion Runway'),
    prompt: 'Professional fashion runway show. The subject is walking on a sleek, reflective catwalk. Darkened audience in the background with camera flashes. Bright, focused spotlights on the model. High-fashion week atmosphere, energetic and grand.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('復古紅磚街景', 'Vintage Brick (Street)'),
    prompt: 'Shot on location: A vintage urban alleyway with a weathered red brick wall. Natural daylight (overcast). Realistic depth of field (blurred background). The subject is standing on the pavement, lighting is soft and natural, blending seamlessly with the environment.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('工業風 Loft', 'Industrial Loft'),
    prompt: 'Shot on location: Inside a converted industrial loft. Raw concrete walls and polished concrete floors. Large factory windows letting in cool natural daylight. Spacious, airy, and modern. Realistic shadows on the floor.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('居家日光', 'Cozy Home (Sunlight)'),
    prompt: 'Shot on location: A cozy, modern living room interior. Sunlight streaming through sheer white curtains, creating a soft glow. Warm atmosphere. Background furniture is out of focus (bokeh). Authentic lifestyle photography.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('都會街拍', 'Urban City (Chic)'),
    prompt: 'Shot on location: A busy city street crossing during the day. Blurred background of buildings and traffic (bokeh). Natural urban lighting. Street style fashion photography. The subject looks like they are walking in the city.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('自然公園', 'Nature Park (Green)'),
    prompt: 'Shot on location: A lush green park or garden. Dappled sunlight filtering through tree leaves onto the subject. Soft, blurry nature background. Fresh, organic, and airy feel.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('奢華大廳', 'Luxury Lobby'),
    prompt: 'Shot on location: A luxury hotel lobby or museum hall. Marble floors, high ceilings, warm chandelier lighting. Sophisticated and opulent background. Depth and reflection on the floor.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('海邊夕陽', 'Beach Sunset'),
    prompt: 'Shot on location: An open beach at golden hour (sunset). Warm orange sun behind the subject (backlit), creating a glow and lens flare. Soft ocean horizon in the distance. Dreamy and romantic.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('現代辦公', 'Modern Office'),
    prompt: 'Shot on location: A modern corporate office with glass walls and steel elements. Cool, professional lighting. Blurred office background. Clean, sharp business look.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('夜城市光斑', 'Night City (Bokeh)'),
    prompt: 'Shot on location: City street at night. Background is a wash of colorful out-of-focus city lights (bokeh). Subject is lit by street lamps and shop windows. Moody and cinematic.',
    category: 'LOCATION'
  },
  {
    label: styleLabel('藝術畫廊', 'Art Gallery'),
    prompt: 'Shot on location: A minimalist art gallery space. White walls, light wood floors. Soft, diffused gallery lighting. Very clean and spacious. The focus is purely on the style.',
    category: 'LOCATION'
  }
];
