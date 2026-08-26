import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useAppLanguage } from "@/lib/app-language";
import { getScamHistory, setSelectedHistoryItem, type ScamHistoryItem } from "@/lib/scam-history";

const riskColor = { Low: "#48D597", Suspicious: "#F5C451", High: "#FF9500", Critical: "#FF6B35" } as const;

function relativeDate(date: string): string {
  const delta = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.floor(delta / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<ScamHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { language, t } = useAppLanguage();
  const router = useRouter();
  const levelLabels = language === "hindi" ? { Low: "कम", Suspicious: "संदिग्ध", High: "उच्च", Critical: "गंभीर" } : language === "marathi" ? { Low: "कमी", Suspicious: "संशयास्पद", High: "उच्च", Critical: "गंभीर" } : { Low: "Low", Suspicious: "Suspicious", High: "High", Critical: "Critical" };
  const loadHistory = useCallback(async () => setEntries(await getScamHistory()), []);
  useFocusEffect(useCallback(() => { void loadHistory(); }, [loadHistory]));

  return <ScreenContainer className="px-5" containerClassName="bg-background">
    <View style={styles.header}><Text style={styles.eyebrow}>{t.activity}</Text><Text style={styles.title}>{t.checkHistory}</Text><Text style={styles.subtitle}>{t.historySub}</Text></View>
    <FlatList data={entries} keyExtractor={(item) => item.id} contentContainerStyle={entries.length ? styles.list : styles.emptyList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadHistory(); setRefreshing(false); }} tintColor="#FF9500" />} ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcons name="history" size={28} color="#FF9500" /></View><Text style={styles.emptyTitle}>{t.emptyHistory}</Text><Text style={styles.emptyText}>{t.emptyHistoryBody}</Text></View>} renderItem={({ item }) => {
      const color = riskColor[item.analysis.riskLevel];
      return <Pressable onPress={() => { setSelectedHistoryItem(item); router.navigate("/"); }} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}><View style={[styles.scoreBadge, { borderColor: color }]}><Text style={[styles.scoreText, { color }]}>{item.analysis.riskScore}</Text></View><View style={styles.rowCopy}><Text numberOfLines={2} style={styles.rowTitle}>{item.transcript ? `${t.transcript}: ${item.transcript.replace(/\s+/g, " ")}` : item.content.replace(/\s+/g, " ")}</Text><Text style={[styles.rowMeta, { color }]}>{levelLabels[item.analysis.riskLevel]} <Text style={styles.dot}>•</Text> <Text style={styles.time}>{relativeDate(item.createdAt)}</Text></Text></View><MaterialIcons name="chevron-right" size={22} color="#747281" /></Pressable>;
    }} />
  </ScreenContainer>;
}

const styles: Record<string, any> = StyleSheet.create({
  header: { paddingTop: 14, paddingBottom: 18 }, eyebrow: { color: "#FF9500", fontFamily: "Rajdhani_600SemiBold", fontSize: 11, letterSpacing: 1.35 }, title: { color: "#F5F5F7", fontFamily: "SpaceGrotesk_700Bold", fontSize: 31, lineHeight: 38, letterSpacing: -0.8, marginTop: 5 }, subtitle: { color: "#A8A6B3", fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, marginTop: 4 }, list: { paddingBottom: 104, gap: 10 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 110 }, empty: { alignItems: "center", paddingHorizontal: 32, marginBottom: 84 }, emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: "#241C12", justifyContent: "center", alignItems: "center", marginBottom: 16 }, emptyTitle: { color: "#F5F5F7", fontFamily: "SpaceGrotesk_700Bold", fontSize: 19 }, emptyText: { color: "#A8A6B3", fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 7 }, row: { backgroundColor: "#171720", borderWidth: 1, borderColor: "#292934", borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }, rowPressed: { opacity: 0.76, transform: [{ scale: 0.985 }] }, scoreBadge: { width: 45, height: 45, borderRadius: 14, borderWidth: 1.5, justifyContent: "center", alignItems: "center", backgroundColor: "#101017" }, scoreText: { fontFamily: "Rajdhani_700Bold", fontSize: 20 }, rowCopy: { flex: 1 }, rowTitle: { color: "#F5F5F7", fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 19 }, rowMeta: { fontFamily: "Rajdhani_600SemiBold", fontSize: 14, marginTop: 5 }, dot: { color: "#747281" }, time: { color: "#A8A6B3", fontFamily: "Inter_400Regular", fontSize: 11 },
});
