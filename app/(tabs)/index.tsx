import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useFocusEffect } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { RiskGauge } from "@/components/risk-gauge";
import { SatarkMark } from "@/components/satark-mark";
import { ScreenContainer } from "@/components/screen-container";
import { useAppLanguage } from "@/lib/app-language";
import { consumeSelectedHistoryItem, saveScamHistory } from "@/lib/scam-history";
import { trpc } from "@/lib/trpc";
import { shouldShowEmergencyGuidance, type AnalysisLanguage, type ScamAnalysis } from "@/shared/scam-analysis";

const sampleText = "Congratulations! Your KYC will be blocked today. Click bit.ly/update-kyc-now and enter your OTP to avoid account suspension.";
const levelColor = { Safe: "#48D597", Suspicious: "#F5C451", "High Risk": "#FF6B35" } as const;
const analysisOptions: { value: AnalysisLanguage; label: string }[] = [{ value: "hindi", label: "हिंदी" }, { value: "marathi", label: "मराठी" }, { value: "english", label: "English" }];
const speechOptions = [{ value: "hi", label: "हिंदी" }, { value: "mr", label: "मराठी" }, { value: "en", label: "English" }] as const;
const riskLabels: Record<AnalysisLanguage, Record<ScamAnalysis["riskLevel"], string>> = {
  hindi: { Safe: "सुरक्षित", Suspicious: "संदिग्ध", "High Risk": "उच्च जोखिम" },
  marathi: { Safe: "सुरक्षित", Suspicious: "संशयास्पद", "High Risk": "उच्च धोका" },
  english: { Safe: "Safe", Suspicious: "Suspicious", "High Risk": "High Risk" },
};

type InputMode = "text" | "audio";
type AudioSource = { uri: string; name: string; mimeType: string; size?: number };
type PhoneType = "android" | "iphone" | "unsure" | null;

function toSpeechLanguage(language: AnalysisLanguage): string {
  return language === "hindi" ? "hi-IN" : language === "marathi" ? "mr-IN" : "en-IN";
}

function cleanBase64(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, "");
}

export default function CheckScreen() {
  const { t } = useAppLanguage();
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [content, setContent] = useState("");
  const [analysis, setAnalysis] = useState<ScamAnalysis | null>(null);
  const [transcript, setTranscript] = useState("");
  const [analysisLanguage, setAnalysisLanguage] = useState<AnalysisLanguage>("english");
  const [speechLanguage, setSpeechLanguage] = useState<"hi" | "mr" | "en">("en");
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [formError, setFormError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [readOpen, setReadOpen] = useState(true);
  const [phoneType, setPhoneType] = useState<PhoneType>(null);
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const textMutation = trpc.scam.analyze.useMutation();
  const audioMutation = trpc.audio.transcribeAndAnalyze.useMutation();

  useFocusEffect(useCallback(() => {
    const selected = consumeSelectedHistoryItem();
    if (selected) {
      setContent(selected.content);
      setTranscript(selected.transcript ?? "");
      setAnalysis(selected.analysis);
      setAnalysisLanguage(selected.analysis.language === "hindi" || selected.analysis.language === "marathi" ? selected.analysis.language : "english");
      setInputMode(selected.transcript ? "audio" : "text");
      setReadOpen(true);
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

  const clearResult = () => {
    setAnalysis(null);
    setTranscript("");
    setReadOpen(true);
    setPhoneType(null);
  };

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["audio/*", "video/*"], copyToCacheDirectory: true, multiple: false, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 12 * 1024 * 1024) {
        setFormError(t.audioLimit);
        return;
      }
      setAudioSource({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "audio/mpeg", size: asset.size });
      setFormError("");
      clearResult();
    } catch {
      setFormError(t.transcriptionFailed);
    }
  };

  const toggleRecording = async () => {
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (!uri) throw new Error("No recording available");
        const file = new File(uri);
        if (file.size > 12 * 1024 * 1024) {
          file.delete();
          setFormError(t.audioLimit);
          return;
        }
        setAudioSource({ uri, name: "call-recording.m4a", mimeType: "audio/m4a", size: file.size });
        setFormError("");
        clearResult();
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setFormError(t.transcriptionFailed);
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      haptic("light");
    } catch {
      setFormError(t.transcriptionFailed);
    }
  };

  const deleteAudio = () => {
    if (!audioSource?.uri) return;
    try { new File(audioSource.uri).delete(); } catch { /* The original selected file is never deleted. */ }
    setAudioSource(null);
  };

  const saveResult = async (nextAnalysis: ScamAnalysis, nextContent: string, nextTranscript = "") => {
    setAnalysis(nextAnalysis);
    setTranscript(nextTranscript);
    setReadOpen(true);
    setPhoneType(null);
    await saveScamHistory({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, content: nextContent, analysis: nextAnalysis, transcript: nextTranscript || undefined, createdAt: new Date().toISOString() });
  };

  const analyzeText = async () => {
    const value = content.trim();
    if (value.length < 6) {
      setFormError(t.retryAnalysis);
      haptic("error");
      return;
    }
    haptic("light");
    setFormError("");
    try {
      const nextAnalysis = await textMutation.mutateAsync({ content: value, language: analysisLanguage });
      await saveResult(nextAnalysis, value);
      haptic("success");
    } catch {
      setFormError(t.retryAnalysis);
      haptic("error");
    }
  };

  const analyzeAudio = async () => {
    if (!audioSource) {
      setFormError(t.transcriptionFailed);
      return;
    }
    haptic("light");
    setFormError("");
    try {
      const file = new File(audioSource.uri);
      if (file.size > 12 * 1024 * 1024) {
        setFormError(t.audioLimit);
        return;
      }
      const audioBase64 = cleanBase64(await file.base64());
      const result = await audioMutation.mutateAsync({ audioBase64, mimeType: audioSource.mimeType, speechLanguage, analysisLanguage });
      if (!result.success) {
        setFormError(t.transcriptionFailed);
        return;
      }
      setContent(result.transcript);
      await saveResult(result.analysis, result.transcript, result.transcript);
      haptic("success");
    } catch {
      setFormError(t.transcriptionFailed);
      haptic("error");
    } finally {
      deleteAudio();
    }
  };

  const scoreColor = analysis ? levelColor[analysis.riskLevel] : "#FF9500";
  const outputLanguage = analysis?.language ?? analysisLanguage;
  const outputTextStyle = outputLanguage === "english" ? undefined : styles.devanagariOutput;
  const busy = textMutation.isPending || audioMutation.isPending;
  const highRisk = analysis ? shouldShowEmergencyGuidance(analysis.riskScore) : false;

  const speakResult = async () => {
    if (!analysis) return;
    haptic("light");
    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }
    await Speech.stop();
    setIsSpeaking(true);
    const spoken = [
      riskLabels[outputLanguage][analysis.riskLevel],
      transcript ? `${t.transcript}. ${transcript}` : "",
      analysis.explanation,
      analysis.recommendedAction,
      highRisk ? [t.blockNumber, t.doNotShare, t.doNotClick, t.reportFraud].join(" ") : t.lowRiskAdvice,
    ].filter(Boolean).join(". ");
    Speech.speak(spoken, { language: toSpeechLanguage(outputLanguage), rate: 0.86, onDone: () => setIsSpeaking(false), onStopped: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
  };

  const guideSteps = (phoneType === "android" ? t.blockAndroid : phoneType === "iphone" ? t.blockIphone : t.blockUnsure) as readonly string[];

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.brandRow}><SatarkMark size={38} /><Text style={styles.brand}>SATARK <Text style={styles.brandAI}>AI</Text></Text></View>
            <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>{t.safetyCheck}</Text></View>
          </View>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>See the Risk.{"\n"}Stay <Text style={styles.heroHindi}>सतर्क.</Text></Text>
            <Text style={styles.heroText}>{t.hero}</Text>
          </View>
          <View style={styles.inputCard}>
            <View style={styles.inputHeading}><View style={styles.inputIcon}><MaterialIcons name={inputMode === "text" ? "content-paste-search" : "graphic-eq"} color="#FF9500" size={20} /></View><View><Text style={styles.inputTitle}>{t.whatCheck}</Text><Text style={styles.inputSubtitle}>{t.messageLink}</Text></View></View>
            <View style={styles.modeRow}>
              <Pressable onPress={() => { setInputMode("text"); setFormError(""); }} style={({ pressed }) => [styles.modeButton, inputMode === "text" && styles.modeButtonActive, pressed && styles.smallPressed]}><MaterialIcons name="text-fields" size={16} color={inputMode === "text" ? "#FFB451" : "#A8A6B3"} /><Text style={[styles.modeText, inputMode === "text" && styles.modeTextActive]}>{t.text}</Text></Pressable>
              <Pressable onPress={() => { setInputMode("audio"); setFormError(""); }} style={({ pressed }) => [styles.modeButton, inputMode === "audio" && styles.modeButtonActive, pressed && styles.smallPressed]}><MaterialIcons name="mic-none" size={16} color={inputMode === "audio" ? "#FFB451" : "#A8A6B3"} /><Text style={[styles.modeText, inputMode === "audio" && styles.modeTextActive]}>{t.callRecording}</Text></Pressable>
            </View>
            {inputMode === "text" ? <>
              <TextInput value={content} onChangeText={(text) => { setContent(text); setFormError(""); clearResult(); }} placeholder={t.pasteHere} placeholderTextColor="#747281" multiline textAlignVertical="top" style={styles.input} maxLength={5000} returnKeyType="done" onSubmitEditing={analyzeText} />
              <View style={styles.inputFooter}><Text style={styles.count}>{content.length}/5000</Text><Pressable onPress={() => { setContent(sampleText); setFormError(""); clearResult(); }} style={({ pressed }) => [styles.sample, pressed && styles.smallPressed]}><MaterialIcons name="auto-awesome" size={13} color="#FFB451" /><Text style={styles.sampleText}>{t.example}</Text></Pressable></View>
            </> : <>
              <View style={styles.audioBox}>
                <MaterialIcons name="privacy-tip" size={19} color="#FFB451" /><Text style={styles.audioPrivacy}>{t.audioPrivacy}</Text>
                {audioSource ? <View style={styles.audioSelected}><MaterialIcons name="audiotrack" size={18} color="#FFB451" /><View style={styles.audioSelectedCopy}><Text numberOfLines={1} style={styles.audioName}>{audioSource.name}</Text><Text style={styles.audioMeta}>{t.selectedAudio}{audioSource.size ? ` · ${(audioSource.size / 1024 / 1024).toFixed(1)} MB` : ""}</Text></View><Pressable onPress={deleteAudio} accessibilityLabel="Remove selected audio"><MaterialIcons name="close" size={19} color="#A8A6B3" /></Pressable></View> : null}
                <View style={styles.audioButtons}><Pressable onPress={pickAudio} style={({ pressed }) => [styles.secondaryButton, pressed && styles.smallPressed]}><MaterialIcons name="upload-file" size={18} color="#FFB451" /><Text style={styles.secondaryButtonText}>{t.uploadCall}</Text></Pressable><Pressable onPress={toggleRecording} style={({ pressed }) => [styles.secondaryButton, recorderState.isRecording && styles.recordingButton, pressed && styles.smallPressed]}><MaterialIcons name={recorderState.isRecording ? "stop-circle" : "mic"} size={18} color={recorderState.isRecording ? "#0A0A0F" : "#FFB451"} /><Text style={[styles.secondaryButtonText, recorderState.isRecording && styles.recordingText]}>{recorderState.isRecording ? t.stopRecording : t.recordLive}</Text></Pressable></View>
              </View>
              <View style={styles.languageRow}><Text style={styles.languageLabel}>{t.speechLanguage}</Text><View style={styles.languageOptions}>{speechOptions.map((option) => <Pressable key={option.value} onPress={() => setSpeechLanguage(option.value)} style={({ pressed }) => [styles.languageOption, speechLanguage === option.value && styles.languageOptionActive, pressed && styles.smallPressed]}><Text style={[styles.languageOptionText, option.value !== "en" && styles.devanagariToggle, speechLanguage === option.value && styles.languageOptionTextActive]}>{option.label}</Text></Pressable>)}</View></View>
            </>}
            <View style={styles.languageRow}><Text style={styles.languageLabel}>{t.outputLanguage}</Text><View style={styles.languageOptions}>{analysisOptions.map((option) => <Pressable key={option.value} onPress={() => { setAnalysisLanguage(option.value); clearResult(); }} style={({ pressed }) => [styles.languageOption, analysisLanguage === option.value && styles.languageOptionActive, pressed && styles.smallPressed]}><Text style={[styles.languageOptionText, option.value !== "english" && styles.devanagariToggle, analysisLanguage === option.value && styles.languageOptionTextActive]}>{option.label}</Text></Pressable>)}</View></View>
          </View>
          {formError ? <View style={styles.error}><MaterialIcons name="info-outline" size={17} color="#FF8F70" /><Text style={styles.errorText}>{formError}</Text></View> : null}
          <Pressable disabled={busy || recorderState.isRecording} onPress={inputMode === "text" ? analyzeText : analyzeAudio} style={({ pressed }) => [styles.analyzeButton, (pressed || busy || recorderState.isRecording) && styles.buttonPressed]}>
            {busy ? <><ActivityIndicator color="#0A0A0F" size="small" /><Text style={styles.analyzeText}>{inputMode === "audio" ? t.transcribing : t.scanning}</Text></> : <><MaterialIcons name={inputMode === "audio" ? "record-voice-over" : "radar"} color="#0A0A0F" size={21} /><Text style={styles.analyzeText}>{inputMode === "audio" ? t.transcribeAnalyze : t.analyzeMessage}</Text><MaterialIcons name="arrow-forward" color="#0A0A0F" size={19} /></>}
          </Pressable>
          <Text style={styles.disclaimer}>{t.disclaimer}</Text>
          {analysis ? <Animated.View style={[styles.resultCard, { opacity: cardOpacity, transform: [{ translateY: cardOpacity.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
            <View style={styles.resultTop}><View><Text style={styles.resultEyebrow}>{t.analysisComplete}</Text><Text style={[styles.resultLevel, outputTextStyle, { color: scoreColor }]}>{riskLabels[outputLanguage][analysis.riskLevel]}</Text></View><View style={[styles.levelDot, { backgroundColor: scoreColor }]} /></View>
            <RiskGauge score={analysis.riskScore} level={analysis.riskLevel} />
            <View style={styles.resultActionRow}><Pressable accessibilityRole="button" accessibilityLabel={isSpeaking ? t.stop : t.hear} onPress={speakResult} style={({ pressed }) => [styles.hearButton, isSpeaking && styles.listenButtonActive, pressed && styles.smallPressed]}><MaterialIcons name={isSpeaking ? "stop-circle" : "volume-up"} size={18} color="#0A0A0F" /><Text style={styles.hearText}>{isSpeaking ? t.stop : t.hear}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={readOpen ? t.hide : t.read} onPress={() => setReadOpen((open) => !open)} style={({ pressed }) => [styles.readButton, pressed && styles.smallPressed]}><MaterialIcons name="article" size={17} color="#FFB451" /><Text style={styles.readText}>{readOpen ? t.hide : t.read}</Text></Pressable></View>
            {readOpen ? <>
              {transcript ? <View style={styles.transcriptCard}><Text style={styles.dividerLabel}>{t.transcript}</Text><Text style={[styles.transcriptText, outputTextStyle]}>{transcript}</Text><Text style={[styles.transcriptNotice, outputTextStyle]}>{t.transcriptBased} {t.transcriptionNotice}</Text></View> : null}
              <View style={styles.recommendation}><MaterialIcons name="verified-user" size={19} color={scoreColor} /><Text style={[styles.recommendationText, outputTextStyle]}>{analysis.recommendedAction}</Text></View>
              <Text style={styles.dividerLabel}>{t.why}</Text><Text style={[styles.explanation, outputTextStyle]}>{analysis.explanation}</Text>
              {analysis.tactics.length ? <View style={styles.section}><Text style={styles.dividerLabel}>{t.tactics}</Text><View style={styles.chips}>{analysis.tactics.map((tactic) => <View key={tactic} style={styles.chip}><Text style={styles.chipText}>{tactic}</Text></View>)}</View></View> : null}
              {analysis.urlFindings.length ? <View style={styles.section}><Text style={styles.dividerLabel}>{t.links}</Text>{analysis.urlFindings.map((finding) => <View key={finding} style={styles.finding}><MaterialIcons name="link" size={16} color="#F5C451" /><Text style={[styles.findingText, outputTextStyle]}>{finding}</Text></View>)}</View> : null}
              <View style={styles.actionGuidance}><Text style={styles.actionTitle}>{highRisk ? t.whatNow : t.lowRiskAdvice}</Text>{highRisk ? <><View style={styles.actionLine}><MaterialIcons name="block" size={18} color="#FFB451" /><Text style={styles.actionLineText}>{t.blockNumber}</Text></View><View style={styles.actionLine}><MaterialIcons name="lock-outline" size={18} color="#FFB451" /><Text style={styles.actionLineText}>{t.doNotShare}</Text></View><View style={styles.actionLine}><MaterialIcons name="link-off" size={18} color="#FFB451" /><Text style={styles.actionLineText}>{t.doNotClick}</Text></View><View style={styles.actionLine}><MaterialIcons name="report-problem" size={18} color="#FFB451" /><Text style={styles.actionLineText}>{t.reportFraud}</Text></View><Pressable onPress={() => setPhoneType((value) => value ?? "unsure")} style={({ pressed }) => [styles.blockHelpButton, pressed && styles.smallPressed]}><Text style={styles.blockHelpText}>{t.blockHelp}</Text><MaterialIcons name="chevron-right" size={18} color="#FFB451" /></Pressable>{phoneType ? <View style={styles.guide}><Text style={styles.guideTitle}>{t.whichPhone}</Text><View style={styles.phoneChoices}>{(["android", "iphone", "unsure"] as const).map((phone) => <Pressable key={phone} onPress={() => setPhoneType(phone)} style={({ pressed }) => [styles.phoneChoice, phoneType === phone && styles.phoneChoiceActive, pressed && styles.smallPressed]}><Text style={[styles.phoneChoiceText, phoneType === phone && styles.phoneChoiceTextActive]}>{phone === "android" ? t.android : phone === "iphone" ? t.iphone : t.notSure}</Text></Pressable>)}</View><View style={styles.guideSteps}>{guideSteps.map((step, index) => <View key={step} style={styles.guideStep}><Text style={styles.guideNumber}>{index + 1}</Text><Text style={styles.guideText}>{step}</Text></View>)}</View></View> : null}</> : null}</View>
            </> : null}
          </Animated.View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 112 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { color: "#F5F5F7", fontFamily: "SpaceGrotesk_700Bold", fontSize: 22, letterSpacing: -0.4 },
  brandAI: { color: "#FF9500" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: "#171720", borderWidth: 1, borderColor: "#302E38" },
  liveDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#48D597" },
  liveText: { color: "#A8A6B3", fontFamily: "Rajdhani_600SemiBold", fontSize: 10, letterSpacing: 1.1 },
  hero: { marginTop: 33, marginBottom: 24 },
  heroTitle: { color: "#F5F5F7", fontFamily: "SpaceGrotesk_700Bold", fontSize: 39, lineHeight: 45, letterSpacing: -1.4 },
  heroHindi: { color: "#FF9500", fontFamily: "NotoSansDevanagari_700Bold" },
  heroText: { color: "#A8A6B3", fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, marginTop: 11, maxWidth: 340 },
  inputCard: { backgroundColor: "#171720", borderRadius: 22, padding: 15, borderWidth: 1, borderColor: "#302E38", shadowColor: "#FF9500", shadowOpacity: 0.04, shadowRadius: 22 },
  inputHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputIcon: { width: 36, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: "#251C11" },
  inputTitle: { color: "#F5F5F7", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 14 },
  inputSubtitle: { color: "#A8A6B3", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  modeButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: "#101017", borderWidth: 1, borderColor: "#30303A" },
  modeButtonActive: { borderColor: "#FF9500", backgroundColor: "#2A1D0A" },
  modeText: { color: "#A8A6B3", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  modeTextActive: { color: "#FFB451" },
  input: { color: "#F5F5F7", fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, minHeight: 138, marginTop: 12, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: "#30303A", backgroundColor: "#101017" },
  languageRow: { marginTop: 12, gap: 8 },
  languageLabel: { color: "#A8A6B3", fontFamily: "Rajdhani_600SemiBold", fontSize: 10, letterSpacing: 1.2 },
  languageOptions: { flexDirection: "row", gap: 7 },
  languageOption: { flex: 1, minHeight: 33, justifyContent: "center", alignItems: "center", borderRadius: 10, backgroundColor: "#101017", borderWidth: 1, borderColor: "#30303A", paddingHorizontal: 4 },
  languageOptionActive: { backgroundColor: "#2A1D0A", borderColor: "#FF9500" },
  languageOptionText: { color: "#A8A6B3", fontFamily: "Inter_600SemiBold", fontSize: 11 },
  devanagariToggle: { fontFamily: "NotoSansDevanagari_500Medium" },
  languageOptionTextActive: { color: "#FFB451" },
  inputFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 9 },
  count: { color: "#747281", fontFamily: "Inter_400Regular", fontSize: 11.5 },
  sample: { flexDirection: "row", alignItems: "center", gap: 4 },
  sampleText: { color: "#FFB451", fontFamily: "Inter_700Bold", fontSize: 11.5 },
  smallPressed: { opacity: 0.65 },
  audioBox: { marginTop: 12, padding: 12, borderRadius: 15, backgroundColor: "#101017", borderWidth: 1, borderColor: "#30303A" },
  audioPrivacy: { color: "#D2D0D8", fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, marginLeft: 27, marginTop: -20 },
  audioButtons: { flexDirection: "row", gap: 8, marginTop: 12 },
  secondaryButton: { flex: 1, minHeight: 43, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#594426", backgroundColor: "#271F13", borderRadius: 12, paddingHorizontal: 7 },
  secondaryButtonText: { color: "#FFB451", fontFamily: "Inter_600SemiBold", fontSize: 11.5, textAlign: "center" },
  recordingButton: { borderColor: "#FF9500", backgroundColor: "#FF9500" },
  recordingText: { color: "#0A0A0F" },
  audioSelected: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: "#1B1B24", borderRadius: 11 },
  audioSelectedCopy: { flex: 1 },
  audioName: { color: "#F5F5F7", fontFamily: "Inter_600SemiBold", fontSize: 12.5 },
  audioMeta: { color: "#A8A6B3", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  error: { flexDirection: "row", gap: 7, padding: 11, borderRadius: 13, backgroundColor: "#2A1917", marginTop: 10, alignItems: "center" },
  errorText: { color: "#FFC2B4", fontFamily: "Inter_500Medium", fontSize: 12.5, lineHeight: 18, flex: 1 },
  analyzeButton: { marginTop: 13, minHeight: 54, backgroundColor: "#FF9500", borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, shadowColor: "#FF9500", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 6 } },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.975 }] },
  analyzeText: { color: "#0A0A0F", fontFamily: "SpaceGrotesk_700Bold", fontSize: 15.5 },
  disclaimer: { color: "#777582", fontFamily: "Inter_400Regular", fontSize: 11.5, lineHeight: 17, textAlign: "center", paddingHorizontal: 14, marginTop: 12 },
  resultCard: { marginTop: 25, backgroundColor: "#171720", borderRadius: 23, padding: 17, borderWidth: 1, borderColor: "#363542" },
  resultTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultEyebrow: { color: "#A8A6B3", fontFamily: "Rajdhani_600SemiBold", fontSize: 11, letterSpacing: 1.3 },
  resultLevel: { fontFamily: "Rajdhani_600SemiBold", fontSize: 25, marginTop: 3, letterSpacing: 0.2 },
  levelDot: { width: 10, height: 10, borderRadius: 10, marginRight: 4 },
  resultActionRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  hearButton: { flex: 1, minHeight: 44, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, borderRadius: 13, backgroundColor: "#FF9500" },
  hearText: { color: "#0A0A0F", fontFamily: "SpaceGrotesk_700Bold", fontSize: 13 },
  readButton: { flex: 1, minHeight: 44, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, borderRadius: 13, borderWidth: 1, borderColor: "#594426", backgroundColor: "#271F13" },
  readText: { color: "#FFB451", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 13 },
  listenButtonActive: { backgroundColor: "#F5C451" },
  transcriptCard: { marginTop: 16, padding: 13, borderRadius: 14, backgroundColor: "#101017", borderWidth: 1, borderColor: "#30303A" },
  transcriptText: { color: "#E0DEE5", fontFamily: "Inter_400Regular", fontSize: 14.5, lineHeight: 22 },
  transcriptNotice: { color: "#D2C99B", fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 10 },
  recommendation: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#101017", borderRadius: 14, padding: 12, marginTop: 14 },
  recommendationText: { color: "#D2D0D8", fontFamily: "Inter_500Medium", fontSize: 13.5, lineHeight: 19, flex: 1 },
  dividerLabel: { color: "#A8A6B3", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 10, letterSpacing: 0.4, marginTop: 21, marginBottom: 7 },
  explanation: { color: "#E0DEE5", fontFamily: "Inter_400Regular", fontSize: 14.5, lineHeight: 22 },
  devanagariOutput: { fontFamily: "NotoSansDevanagari_400Regular", lineHeight: 24 },
  section: { marginTop: 1 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "#594426", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#271F13" },
  chipText: { color: "#FFD28A", fontFamily: "Rajdhani_600SemiBold", fontSize: 12.5, letterSpacing: 0.3 },
  finding: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8, borderTopColor: "#292934", borderTopWidth: 1 },
  findingText: { color: "#D2D0D8", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, flex: 1 },
  actionGuidance: { marginTop: 20, padding: 13, borderRadius: 15, backgroundColor: "#201A12", borderWidth: 1, borderColor: "#594426" },
  actionTitle: { color: "#FFCB75", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15, lineHeight: 22 },
  actionLine: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 12 },
  actionLineText: { color: "#E0D7C1", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, flex: 1 },
  blockHelpButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, borderTopWidth: 1, borderTopColor: "#594426", paddingTop: 12 },
  blockHelpText: { color: "#FFB451", fontFamily: "Inter_600SemiBold", fontSize: 12.5 },
  guide: { marginTop: 12, padding: 12, borderRadius: 13, backgroundColor: "#101017" },
  guideTitle: { color: "#F5F5F7", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 14 },
  phoneChoices: { flexDirection: "row", gap: 6, marginTop: 10 },
  phoneChoice: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", borderWidth: 1, borderColor: "#30303A" },
  phoneChoiceActive: { borderColor: "#FF9500", backgroundColor: "#2A1D0A" },
  phoneChoiceText: { color: "#A8A6B3", fontFamily: "Inter_600SemiBold", fontSize: 11 },
  phoneChoiceTextActive: { color: "#FFB451" },
  guideSteps: { gap: 10, marginTop: 14 },
  guideStep: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  guideNumber: { width: 21, height: 21, borderRadius: 11, textAlign: "center", overflow: "hidden", backgroundColor: "#FF9500", color: "#0A0A0F", fontFamily: "Rajdhani_700Bold", fontSize: 14, lineHeight: 21 },
  guideText: { color: "#E0DEE5", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, flex: 1 },
});
