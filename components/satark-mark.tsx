import Svg, { Circle, Path } from "react-native-svg";

export function SatarkMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path d="M24 4.5 39 10v10.8c0 9.5-6.1 17.8-15 22.7C15.1 38.6 9 30.3 9 20.8V10L24 4.5Z" stroke="#F5F5F7" strokeWidth="2.4" strokeLinejoin="round" />
      <Path d="M15.5 24c2.6-4.1 5.5-6.1 8.5-6.1s5.9 2 8.5 6.1c-2.6 4.1-5.5 6.1-8.5 6.1s-5.9-2-8.5-6.1Z" stroke="#F5F5F7" strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="24" cy="24" r="3.7" stroke="#F5F5F7" strokeWidth="1.5" />
      <Circle cx="24" cy="24" r="1.8" fill="#FF9500" />
    </Svg>
  );
}
