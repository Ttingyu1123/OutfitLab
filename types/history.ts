import { GarmentItem, TryOnConfig } from '../types';

export interface HistoryItem {
  id: string;
  resultImage: string;
  config: TryOnConfig | null;
  items: GarmentItem[];
  timestamp: number;
  type: 'extracted' | 'generated' | 'edited';
}
