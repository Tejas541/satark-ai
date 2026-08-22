import { ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { SatarkMark } from "@/components/satark-mark";

const points = [
  { icon: "psychology-alt", title: "Looks beyond a number", text: "Satark AI reads the pressure, impersonation, and urgency inside a message — signals a number-only blocker cannot see." },
  { icon: "language", title: "Built for how you write", text: "It explains findings in the language and register of the message, including Hindi, Hinglish, and English." },
  { icon: "shield", title: "A pause before you act", text: "A risk score is a prompt to verify independently, not proof that a person or business is unsafe." },
];

export default function AboutScreen() {
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.brandRow}><View style={styles.markWrap}><SatarkMark size={36} /></View><View><Text style={styles.brand}>Satark <Text style={styles.brandAI}>AI</Text></Text><Text style={styles.tagline}>See the Risk. Stay सतर्क.</Text></View></View>
        <Text style={styles.title}>Safer choices start with a pause.</Text>
        <Text style={styles.copy}>Scammers often rely on emotion, not just unknown phone numbers. They create urgency, imitate trusted people, or promise an unlikely reward to make you act before you verify.</Text>
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>WHAT WE LOOK FOR</Text>
        {points.map((point) => (
          <View key={point.title} style={styles.point}>
            <View style={styles.pointIcon}><MaterialIcons name={point.icon as never} size={21} color="#FF9500" /></View>
            <View style={styles.pointCopy}><Text style={styles.pointTitle}>{point.title}</Text><Text style={styles.pointText}>{point.text}</Text></View>
          </View>
        ))}
        <View style={styles.notice}><MaterialIcons name="lock-outline" size={19} color="#F5C451" /><Text style={styles.noticeText}>Checks are saved only on your device. Do not paste OTPs, passwords, or bank details.</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 108 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  markWrap: { width: 54, height: 54, justifyContent: "center", alignItems: "center", backgroundColor: "#171720", borderWidth: 1, borderColor: "#302E38", borderRadius: 18 },
  brand: { color: "#F5F5F7", fontFamily: "Manrope_800ExtraBold", fontSize: 20, letterSpacing: -0.4 },
  brandAI: { color: "#FF9500" },
  tagline: { color: "#A8A6B3", fontFamily: "Manrope_400Regular", fontSize: 12.5, marginTop: 2 },
  title: { color: "#F5F5F7", fontFamily: "Manrope_800ExtraBold", fontSize: 32, lineHeight: 39, letterSpacing: -0.9, marginTop: 31 },
  copy: { color: "#B7B5C0", fontFamily: "Manrope_400Regular", fontSize: 15.5, lineHeight: 23, marginTop: 12 },
  divider: { height: 1, backgroundColor: "#292934", marginVertical: 28 },
  sectionLabel: { color: "#FF9500", fontFamily: "Manrope_800ExtraBold", fontSize: 10, letterSpacing: 1.3, marginBottom: 13 },
  point: { flexDirection: "row", gap: 13, marginBottom: 21 },
  pointIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#241C12", justifyContent: "center", alignItems: "center" },
  pointCopy: { flex: 1 },
  pointTitle: { color: "#F5F5F7", fontFamily: "Manrope_800ExtraBold", fontSize: 15.5, marginTop: 1 },
  pointText: { color: "#A8A6B3", fontFamily: "Manrope_400Regular", fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  notice: { flexDirection: "row", gap: 10, padding: 15, borderRadius: 16, backgroundColor: "#26231A", borderWidth: 1, borderColor: "#4A412A", marginTop: 6 },
  noticeText: { color: "#D2C99B", fontFamily: "Manrope_500Medium", fontSize: 12.5, lineHeight: 18, flex: 1 },
});
