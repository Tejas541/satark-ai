import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import type { RiskLevel } from "@/shared/scam-analysis";

const CIRCUMFERENCE = 2 * Math.PI * 46;

const palette: Record<RiskLevel, string> = {
  Safe: "#48D597",
  Suspicious: "#F5C451",
  "High Risk": "#FF6B35",
};

export function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const [displayScore, setDisplayScore] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const color = palette[level];

  useEffect(() => {
    let current = 0;
    const increment = Math.max(1, Math.ceil(score / 28));
    const timer = setInterval(() => {
      current = Math.min(score, current + increment);
      setDisplayScore(current);
      if (current >= score) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [score]);

  useEffect(() => {
    pulse.stopAnimation();
    if (level !== "High Risk") {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [level, pulse]);

  const dashOffset = CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale: pulse }] }]}>
      <Svg width={128} height={128} viewBox="0 0 112 112" style={styles.svg}>
        <Circle cx="56" cy="56" r="46" stroke="#2C2C37" strokeWidth="9" fill="none" />
        <Circle
          cx="56"
          cy="56"
          r="46"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          rotation="-90"
          origin="56,56"
        />
        <Circle cx="56" cy="56" r="34" stroke={color} strokeOpacity="0.18" strokeWidth="1" fill="none" />
      </Svg>
      <View style={styles.content}>
        <Text style={styles.score}>{displayScore}</Text>
        <Text style={styles.caption}>RISK SCORE</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 128, height: 128, alignSelf: "center", justifyContent: "center", alignItems: "center" },
  svg: { position: "absolute" },
  content: { alignItems: "center", justifyContent: "center" },
  score: { color: "#F5F5F7", fontFamily: "Manrope_800ExtraBold", fontSize: 38, letterSpacing: -1.5 },
  caption: { color: "#A8A6B3", fontFamily: "Manrope_700Bold", fontSize: 8.5, letterSpacing: 1.2, marginTop: -2 },
});
