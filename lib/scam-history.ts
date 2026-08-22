import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ScamAnalysis } from "@/shared/scam-analysis";

const HISTORY_KEY = "satark-ai-history-v1";

export type ScamHistoryItem = {
  id: string;
  content: string;
  analysis: ScamAnalysis;
  createdAt: string;
};

let selectedHistoryItem: ScamHistoryItem | null = null;

export async function getScamHistory(): Promise<ScamHistoryItem[]> {
  try {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    const entries = stored ? (JSON.parse(stored) as ScamHistoryItem[]) : [];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export async function saveScamHistory(item: ScamHistoryItem): Promise<void> {
  const current = await getScamHistory();
  const next = [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 25);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function setSelectedHistoryItem(item: ScamHistoryItem): void {
  selectedHistoryItem = item;
}

export function consumeSelectedHistoryItem(): ScamHistoryItem | null {
  const item = selectedHistoryItem;
  selectedHistoryItem = null;
  return item;
}
