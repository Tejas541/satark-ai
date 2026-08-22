import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useFocusEffect } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { RiskGauge } from "@/components/risk-gauge";
import { SatarkMark } from "@/components/satark-mark";
import { ScreenContainer } from "@/components/screen-container";
import { consumeSelectedHistoryItem, saveScamHistory } from "@/lib/scam-history";
import { trpc } from "@/lib/trpc";
import type { AnalysisLanguage, ScamAnalysis } from "@/shared/scam-analysis";

const sampleText = "Congratulations! Your KYC will be blocked today. Click bit.ly/update-kyc-now and enter your OTP to avoid account suspension.";

const levelColor = { Safe: "#48D597", Suspicious: "#F5C451", "High Risk": "#FF6B35" } as const;
const languageOptions: { value: AnalysisLanguage; label: string }[] = [
  { value: "hindi", label: "हिंदी" },
  { value: "hinglish", label: "Hinglish" },
  { value: "english", label: "English" },
];
const localizedRiskLevel: Record<AnalysisLanguage, Record<ScamAnalysis["riskLevel"], string>> = {
  hindi: { Safe: "सुरक्षित", Suspicious: "संदिग्ध", "High Risk": "उच्च जोखिम" },
  hinglish: { Safe: "Safe", Suspicious: "Suspicious", "High Risk": "High Risk" },
  english: { Safe: "Safe", Suspicious: "Suspicious", "High Risk": "High Risk" },
};

export default function CheckScreen() {
  const [content, setContent] = useState("");
  const [analysis, setAnalysis] = useState<ScamAnalysis | null>(null);
  const [language, setLanguage] = useState<AnalysisLanguage>("hinglish");
  const [formError, setFormError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const mutation = trpc.scam.analyze.useMutation();

  useFocusEffect(useCallback(() => {
    const selected = consumeSelectedHistoryItem();
    if (selected) {
      setContent(selected.content);
      setAnalysis(selected.analysis);
      setLanguage(selected.analysis.language ?? "hinglish");
      setFormError("");
    }
  }, []));

  useEffect(() => {
    if (!analysis) return;
    cardOpacity.setValue(0);
    Animated.timing(cardOpacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [analysis, cardOpacity]);

  useEffect(() => () => { void Speech.stop(); }, []);

  const haptic = (type: "light" | "success" | "error") => {
    if (Platform.OS === "web") return;
    if (type === "light") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (type === "error") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const analyze = async () => {
    const value = content.trim();
    if (value.length < 6) {
      setFormError("Paste a message or link with a little more detail.");
      haptic("error");
      return;
    }
    haptic("light");
    setFormError("");
    try {
      const nextAnalysis = await mutation.mutateAsync({ content: value, language });
      setAnalysis(nextAnalysis);
      await saveScamHistory({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, content: value, analysis: nextAnalysis, createdAt: new Date().toISOString() });
      haptic("success");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We could not check that message. Please try again.");
      haptic("error");
    }
  };

  const scoreColor = analysis ? levelColor[analysis.riskLevel] : "#FF9500";
  const outputLanguage = analysis?.language ?? language;
  const outputTextStyle = outputLanguage === "hindi" ? styles.devanagariOutput : undefined;
  const speakExplanation = async () => {
    if (!analysis) return;
    haptic("light");
    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }
    await Speech.stop();
    setIsSpeaking(true);
    Speech.speak(`${localizedRiskLevel[outputLanguage][analysis.riskLevel]}. ${analysis.explanation} ${analysis.recommendedAction}`, {
      language: outputLanguage === "hindi" ? "hi-IN" : "en-IN",
      rate: 0.88,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.brandRow}><SatarkMark size={38} /><Text style={styles.brand}>Satark <Text style={styles.brandAI}>AI</Text></Text></View>
            <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>SAFETY CHECK</Text></View>
          </View>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>See the Risk.{"\n"}Stay <Text style={styles.heroHindi}>सतर्क.</Text></Text>
            <Text style={styles.heroText}>Paste a suspicious message, link, or call transcript. We will surface the pressure tactics hidden inside.</Text>
          </View>
          <View style={styles.inputCard}>
            <View style={styles.inputHeading}><View style={styles.inputIcon}><MaterialIcons name="content-paste-search" color="#FF9500" size={20} /></View><View><Text style={styles.inputTitle}>What do you want to check?</Text><Text style={styles.inputSubtitle}>Message, link, or call transcript</Text></View></View>
            <TextInput
              value={content}
              onChangeText={(text) => { setContent(text); setFormError(""); }}
              placeholder="Paste it here…"
              placeholderTextColor="#747281"
              multiline
              textAlignVertical="top"
              style={styles.input}
              maxLength={5000}
              returnKeyType="done"
              onSubmitEditing={analyze}
            />
            <View style={styles.languageRow}>
              <Text style={styles.languageLabel}>OUTPUT LANGUAGE</Text>
              <View style={styles.languageOptions}>
                {languageOptions.map((option) => (
                  <Pressable key={option.value} onPress={() => { setLanguage(option.value); setAnalysis(null); }} style={({ pressed }) => [styles.languageOption, language === option.value && styles.languageOptionActive, pressed && styles.smallPressed]}>
                    <Text style={[styles.languageOptionText, option.value === "hindi" && styles.devanagariToggle, language === option.value && styles.languageOptionTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.inputFooter}><Text style={styles.count}>{content.length}/5000</Text><Pressable onPress={() => { setContent(sampleText); setFormError(""); }} style={({ pressed }) => [styles.sample, pressed && styles.smallPressed]}><MaterialIcons name="auto-awesome" size={13} color="#FFB451" /><Text style={styles.sampleText}>Try an example</Text></Pressable></View>
          </View>
          {formError ? <View style={styles.error}><MaterialIcons name="info-outline" size={17} color="#FF8F70" /><Text style={styles.errorText}>{formError}</Text></View> : null}
          <Pressable disabled={mutation.isPending} onPress={analyze} style={({ pressed }) => [styles.analyzeButton, (pressed || mutation.isPending) && styles.buttonPressed]}>
            {mutation.isPending ? <><ActivityIndicator color="#0A0A0F" size="small" /><Text style={styles.analyzeText}>Scanning for signals…</Text></> : <><MaterialIcons name="radar" color="#0A0A0F" size={21} /><Text style={styles.analyzeText}>Analyze message</Text><MaterialIcons name="arrow-forward" color="#0A0A0F" size={19} /></>}
          </Pressable>
          <Text style={styles.disclaimer}>Satark AI identifies patterns, not certainty. Verify important requests through official channels.</Text>
          {analysis ? <Animated.View style={[styles.resultCard, { opacity: cardOpacity, transform: [{ translateY: cardOpacity.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
            <View style={styles.resultTop}><View><Text style={styles.resultEyebrow}>ANALYSIS COMPLETE</Text><Text style={[styles.resultLevel, outputTextStyle, { color: scoreColor }]}>{localizedRiskLevel[outputLanguage][analysis.riskLevel]}</Text></View><View style={[styles.levelDot, { backgroundColor: scoreColor }]} /></View>
            <RiskGauge score={analysis.riskScore} level={analysis.riskLevel} />
            <View style={styles.recommendation}><MaterialIcons name="verified-user" size={19} color={scoreColor} /><Text style={[styles.recommendationText, outputTextStyle]}>{analysis.recommendedAction}</Text></View>
            <View style={styles.explanationHeading}><Text style={styles.dividerLabel}>WHY THIS STOOD OUT</Text><Pressable accessibilityRole="button" accessibilityLabel={isSpeaking ? "Stop listening" : "Listen to this explanation"} onPress={speakExplanation} style={({ pressed }) => [styles.listenButton, isSpeaking && styles.listenButtonActive, pressed && styles.smallPressed]}><MaterialIcons name={isSpeaking ? "stop-circle" : "volume-up"} size={16} color={isSpeaking ? "#0A0A0F" : "#FFB451"} /><Text style={[styles.listenText, isSpeaking && styles.listenTextActive]}>{isSpeaking ? "Stop" : "Listen"}</Text></Pressable></View><Text style={[styles.explanation, outputTextStyle]}>{analysis.explanation}</Text>
            {analysis.tactics.length ? <View style={styles.section}><Text style={styles.dividerLabel}>DETECTED TACTICS</Text><View style={styles.chips}>{analysis.tactics.map((tactic) => <View key={tactic} style={styles.chip}><Text style={styles.chipText}>{tactic}</Text></View>)}</View></View> : null}
            {analysis.urlFindings.length ? <View style={styles.section}><Text style={styles.dividerLabel}>LINK SIGNALS</Text>{analysis.urlFindings.map((finding) => <View key={finding} style={styles.finding}><MaterialIcons name="link" size={16} color="#F5C451" /><Text style={[styles.findingText, outputTextStyle]}>{finding}</Text></View>)}</View> : null}
          </Animated.View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 112 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { color: "#F5F5F7", fontFamily: "Manrope_800ExtraBold", fontSize: 23, letterSpacing: -0.6 },
  brandAI: { color: "#FF9500" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: "#171720", borderWidth: 1, borderColor: "#302E38" },
  liveDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#48D597" },
  liveText: { color: "#A8A6B3", fontFamily: "Manrope_800ExtraBold", fontSize: 8.5, letterSpacing: 0.8 },
  hero: { marginTop: 33, marginBottom: 24 },
  heroTitle: { color: "#F5F5F7", fontFamily: "Manrope_800ExtraBold", fontSize: 39, lineHeight: 45, letterSpacing: -1.4 },
  heroHindi: { color: "#FF9500", fontFamily: "NotoSansDevanagari_700Bold" },
  heroText: { color: "#A8A6B3", fontFamily: "Manrope_400Regular", fontSize: 15, lineHeight: 22, marginTop: 11, maxWidth: 340 },
  inputCard: { backgroundColor: "#171720", borderRadius: 22, padding: 15, borderWidth: 1, borderColor: "#302E38", shadowColor: "#FF9500", shadowOpacity: 0.04, shadowRadius: 22 },
  inputHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputIcon: { width: 36, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: "#251C11" },
  inputTitle: { color: "#F5F5F7", fontFamily: "Manrope_800ExtraBold", fontSize: 14 },
  inputSubtitle: { color: "#A8A6B3", fontFamily: "Manrope_400Regular", fontSize: 12, marginTop: 1 },
  input: { color: "#F5F5F7", fontFamily: "Manrope_400Regular", fontSize: 15, lineHeight: 22, minHeight: 138, marginTop: 14, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: "#30303A", backgroundColor: "#101017" },
  languageRow: { marginTop: 12, gap: 8 },
  languageLabel: { color: "#A8A6B3", fontFamily: "Manrope_800ExtraBold", fontSize: 9, letterSpacing: 1.05 },
  languageOptions: { flexDirection: "row", gap: 7 },
  languageOption: { flex: 1, minHeight: 33, justifyContent: "center", alignItems: "center", borderRadius: 10, backgroundColor: "#101017", borderWidth: 1, borderColor: "#30303A", paddingHorizontal: 4 },
  languageOptionActive: { backgroundColor: "#2A1D0A", borderColor: "#FF9500" },
  languageOptionText: { color: "#A8A6B3", fontFamily: "Manrope_600SemiBold", fontSize: 11 },
  devanagariToggle: { fontFamily: "NotoSansDevanagari_500Medium" },
  languageOptionTextActive: { color: "#FFB451", fontFamily: "Manrope_800ExtraBold" },
  inputFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 9 },
  count: { color: "#747281", fontFamily: "Manrope_400Regular", fontSize: 11.5 },
  sample: { flexDirection: "row", alignItems: "center", gap: 4 },
  sampleText: { color: "#FFB451", fontFamily: "Manrope_700Bold", fontSize: 11.5 },
  smallPressed: { opacity: 0.65 },
  error: { flexDirection: "row", gap: 7, padding: 11, borderRadius: 13, backgroundColor: "#2A1917", marginTop: 10, alignItems: "center" },
  errorText: { color: "#FFC2B4", fontFamily: "Manrope_500Medium", fontSize: 12.5, lineHeight: 18, flex: 1 },
  analyzeButton: { marginTop: 13, minHeight: 54, backgroundColor: "#FF9500", borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, shadowColor: "#FF9500", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 6 } },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.975 }] },
  analyzeText: { color: "#0A0A0F", fontFamily: "Manrope_800ExtraBold", fontSize: 15.5 },
  disclaimer: { color: "#777582", fontFamily: "Manrope_400Regular", fontSize: 11.5, lineHeight: 17, textAlign: "center", paddingHorizontal: 14, marginTop: 12 },
  resultCard: { marginTop: 25, backgroundColor: "#171720", borderRadius: 23, padding: 17, borderWidth: 1, borderColor: "#363542" },
  resultTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultEyebrow: { color: "#A8A6B3", fontFamily: "Manrope_800ExtraBold", fontSize: 9.5, letterSpacing: 1.2 },
  resultLevel: { fontFamily: "Manrope_800ExtraBold", fontSize: 22, marginTop: 3, letterSpacing: -0.4 },
  levelDot: { width: 10, height: 10, borderRadius: 10, marginRight: 4 },
  recommendation: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#101017", borderRadius: 14, padding: 12, marginTop: 12 },
  recommendationText: { color: "#D2D0D8", fontFamily: "Manrope_500Medium", fontSize: 13.5, lineHeight: 19, flex: 1 },
  explanationHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 15 },
  dividerLabel: { color: "#A8A6B3", fontFamily: "Manrope_800ExtraBold", fontSize: 9.5, letterSpacing: 1.15, marginTop: 21, marginBottom: 7 },
  explanation: { color: "#E0DEE5", fontFamily: "Manrope_400Regular", fontSize: 14.5, lineHeight: 22 },
  devanagariOutput: { fontFamily: "NotoSansDevanagari_400Regular", lineHeight: 24 },
  listenButton: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#594426", backgroundColor: "#271F13", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  listenButtonActive: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  listenText: { color: "#FFB451", fontFamily: "Manrope_700Bold", fontSize: 10.5 },
  listenTextActive: { color: "#0A0A0F" },
  section: { marginTop: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "#594426", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#271F13" },
  chipText: { color: "#FFD28A", fontFamily: "Manrope_700Bold", fontSize: 11.5 },
  finding: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8, borderTopColor: "#292934", borderTopWidth: 1 },
  findingText: { color: "#D2D0D8", fontFamily: "Manrope_400Regular", fontSize: 13, lineHeight: 18, flex: 1 },
});
