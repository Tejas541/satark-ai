import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const appLanguages = ["hindi", "marathi", "english"] as const;
export type AppLanguage = (typeof appLanguages)[number];

type Copy = Record<string, any>;

const copy = {
  english: {
    check: "Check", history: "History", about: "About", safetyCheck: "SAFETY CHECK", seeRisk: "See the Risk.", stayAlert: "Stay सतर्क.",
    hero: "Paste a suspicious message, link, or call transcript. We will surface the pressure tactics hidden inside.",
    text: "Text", callRecording: "Call recording", whatCheck: "What do you want to check?", messageLink: "Message, link, or call transcript", pasteHere: "Paste it here…",
    outputLanguage: "OUTPUT LANGUAGE", speechLanguage: "SPEECH LANGUAGE", uploadCall: "Upload Call Recording", recordLive: "Record live audio", stopRecording: "Stop recording", selectedAudio: "Selected audio", audioPrivacy: "Audio is used only for transcription and analysis. It is not saved.", audioLimit: "Use an audio file under 12 MB.",
    transcribeAnalyze: "Transcribe & analyze", analyzeMessage: "Analyze message", scanning: "Scanning for signals…", transcribing: "Transcribing call recording…", transcriptionFailed: "We could not transcribe that recording. Try a shorter, clearer audio file and try again.", retry: "Try again", transcript: "CALL TRANSCRIPT", transcriptBased: "This risk result is based on the transcript.", transcriptionNotice: "Transcription may contain errors. Verify important information independently.",
    analysisComplete: "ANALYSIS COMPLETE", why: "WHY THIS STOOD OUT", tactics: "DETECTED TACTICS", links: "LINK SIGNALS", hear: "Hear", stop: "Stop", read: "Read", hide: "Hide", resultDetails: "RESULT DETAILS",
    whatNow: "What should I do now?", blockNumber: "Block this number", doNotShare: "Do not share OTPs, passwords, bank details, UPI PIN, or other sensitive information.", doNotClick: "Do not click links from the suspicious sender.", reportFraud: "Report cyber fraud to 1930 or cybercrime.gov.in.", blockHelp: "Need help blocking this number?", whichPhone: "Which phone do you use?", android: "Android", iphone: "iPhone", notSure: "Not sure", blockAndroid: ["Open the Phone app.", "Find the recent call or contact.", "Tap the number, then choose Block or Report spam."], blockIphone: ["Open the Phone app and tap Recents.", "Tap the info icon beside the number.", "Scroll down and tap Block this Caller."], blockUnsure: ["Open the Phone app.", "Tap the number that called you.", "Look for a Block or Report spam option."],
    disclaimer: "Satark AI identifies risk patterns, not certainty. Verify important requests through official channels.", emptyHistory: "No checks yet", emptyHistoryBody: "Your completed safety checks will stay here on this device.", activity: "YOUR ACTIVITY", checkHistory: "Check history", historySub: "Saved on this device. Tap a check to review it.",
    aboutTitle: "Safer choices start with a pause.", aboutCopy: "Scammers often rely on emotion, not just unknown phone numbers. They create urgency, imitate trusted people, or promise an unlikely reward to make you act before you verify.", whatWeLookFor: "WHAT WE LOOK FOR", language: "Language", appLanguage: "APP LANGUAGE", privacyNotice: "Checks are saved only on your device. Do not paste OTPs, passwords, or bank details.",
    lowRiskAdvice: "Stay cautious and verify independently before taking action.", retryAnalysis: "We could not check that message. Please try again.", example: "Try an example", readMore: "Read details below.",
  },
  hindi: {
    check: "जांच", history: "इतिहास", about: "जानकारी", safetyCheck: "सुरक्षा जांच", seeRisk: "जोखिम पहचानें।", stayAlert: "सतर्क रहें।",
    hero: "संदिग्ध संदेश, लिंक या कॉल का लिखा हुआ विवरण डालें। हम दबाव डालने के संकेत दिखाएंगे।", text: "टेक्स्ट", callRecording: "कॉल रिकॉर्डिंग", whatCheck: "आप क्या जांचना चाहते हैं?", messageLink: "संदेश, लिंक या कॉल का विवरण", pasteHere: "यहां पेस्ट करें…",
    outputLanguage: "विश्लेषण की भाषा", speechLanguage: "बोली की भाषा", uploadCall: "कॉल रिकॉर्डिंग अपलोड करें", recordLive: "लाइव ऑडियो रिकॉर्ड करें", stopRecording: "रिकॉर्डिंग रोकें", selectedAudio: "चुना गया ऑडियो", audioPrivacy: "ऑडियो केवल लिखने और जांच के लिए उपयोग होता है। इसे सहेजा नहीं जाता।", audioLimit: "12 MB से छोटी ऑडियो फ़ाइल चुनें।",
    transcribeAnalyze: "लिखें और जांचें", analyzeMessage: "संदेश जांचें", scanning: "संकेत देखे जा रहे हैं…", transcribing: "कॉल रिकॉर्डिंग को लिखा जा रहा है…", transcriptionFailed: "यह रिकॉर्डिंग लिखी नहीं जा सकी। छोटी और साफ़ ऑडियो फ़ाइल के साथ फिर कोशिश करें।", retry: "फिर कोशिश करें", transcript: "कॉल का लिखित विवरण", transcriptBased: "यह जोखिम परिणाम लिखित विवरण पर आधारित है।", transcriptionNotice: "लिखित विवरण में गलती हो सकती है। जरूरी जानकारी अलग से जांचें।",
    analysisComplete: "जांच पूरी हुई", why: "यह संदिग्ध क्यों लगा", tactics: "मिले हुए तरीके", links: "लिंक संकेत", hear: "सुनें", stop: "रोकें", read: "पढ़ें", hide: "छिपाएं", resultDetails: "परिणाम विवरण",
    whatNow: "अब मुझे क्या करना चाहिए?", blockNumber: "इस नंबर को ब्लॉक करें", doNotShare: "OTP, पासवर्ड, बैंक जानकारी, UPI PIN या अन्य निजी जानकारी साझा न करें।", doNotClick: "संदिग्ध भेजने वाले के लिंक पर क्लिक न करें।", reportFraud: "साइबर धोखाधड़ी की रिपोर्ट 1930 या cybercrime.gov.in पर करें।", blockHelp: "नंबर ब्लॉक करने में मदद चाहिए?", whichPhone: "आप कौन सा फोन इस्तेमाल करते हैं?", android: "एंड्रॉइड", iphone: "आईफोन", notSure: "पता नहीं", blockAndroid: ["Phone ऐप खोलें।", "हाल की कॉल या संपर्क ढूंढें।", "नंबर पर टैप करें, फिर Block या Report spam चुनें।"], blockIphone: ["Phone ऐप खोलें और Recents पर टैप करें।", "नंबर के पास जानकारी आइकन पर टैप करें।", "नीचे जाकर Block this Caller पर टैप करें।"], blockUnsure: ["Phone ऐप खोलें।", "जिस नंबर से कॉल आई थी उस पर टैप करें।", "Block या Report spam का विकल्प ढूंढें।"],
    disclaimer: "सतर्क AI जोखिम के संकेत पहचानता है, पक्की सच्चाई नहीं। जरूरी बातों को आधिकारिक माध्यम से जांचें।", emptyHistory: "अभी कोई जांच नहीं", emptyHistoryBody: "पूरी हुई सुरक्षा जांचें इस डिवाइस पर दिखाई देंगी।", activity: "आपकी गतिविधि", checkHistory: "जांच इतिहास", historySub: "इस डिवाइस पर सहेजा गया है। देखने के लिए किसी जांच पर टैप करें।",
    aboutTitle: "सुरक्षित फैसले एक ठहराव से शुरू होते हैं।", aboutCopy: "धोखेबाज केवल अनजान नंबरों का इस्तेमाल नहीं करते। वे जल्दी कराने का दबाव बनाते हैं, भरोसेमंद लोगों की नकल करते हैं या असंभव इनाम का वादा करते हैं।", whatWeLookFor: "हम क्या देखते हैं", language: "भाषा", appLanguage: "ऐप की भाषा", privacyNotice: "जांच केवल आपके डिवाइस पर सहेजी जाती है। OTP, पासवर्ड या बैंक जानकारी न डालें।", lowRiskAdvice: "सतर्क रहें और कोई कदम उठाने से पहले अलग से जांचें।", retryAnalysis: "यह संदेश जांचा नहीं जा सका। कृपया फिर कोशिश करें।", example: "उदाहरण देखें", readMore: "नीचे विवरण पढ़ें।",
  },
  marathi: {
    check: "तपासा", history: "इतिहास", about: "माहिती", safetyCheck: "सुरक्षा तपासणी", seeRisk: "धोका ओळखा.", stayAlert: "सतर्क रहा.",
    hero: "संशयास्पद संदेश, लिंक किंवा कॉलचा मजकूर द्या. आम्ही दबाव टाकण्याचे संकेत दाखवू.", text: "मजकूर", callRecording: "कॉल रेकॉर्डिंग", whatCheck: "तुम्हाला काय तपासायचे आहे?", messageLink: "संदेश, लिंक किंवा कॉलचा मजकूर", pasteHere: "इथे पेस्ट करा…",
    outputLanguage: "विश्लेषणाची भाषा", speechLanguage: "बोलण्याची भाषा", uploadCall: "कॉल रेकॉर्डिंग अपलोड करा", recordLive: "थेट ऑडिओ रेकॉर्ड करा", stopRecording: "रेकॉर्डिंग थांबवा", selectedAudio: "निवडलेला ऑडिओ", audioPrivacy: "ऑडिओ फक्त मजकूर बनवण्यासाठी आणि तपासणीसाठी वापरला जातो. तो जतन केला जात नाही.", audioLimit: "12 MB पेक्षा लहान ऑडिओ फाईल निवडा.",
    transcribeAnalyze: "मजकूर करा आणि तपासा", analyzeMessage: "संदेश तपासा", scanning: "संकेत तपासले जात आहेत…", transcribing: "कॉल रेकॉर्डिंगचा मजकूर बनत आहे…", transcriptionFailed: "या रेकॉर्डिंगचा मजकूर बनवता आला नाही. कमी वेळेची आणि स्पष्ट ऑडिओ फाईल वापरून पुन्हा प्रयत्न करा.", retry: "पुन्हा प्रयत्न करा", transcript: "कॉलचा मजकूर", transcriptBased: "हा धोका परिणाम कॉलच्या मजकुरावर आधारित आहे.", transcriptionNotice: "मजकूर बनवताना चुका होऊ शकतात. महत्त्वाची माहिती स्वतंत्रपणे तपासा.",
    analysisComplete: "तपासणी पूर्ण", why: "हे संशयास्पद का वाटले", tactics: "आढळलेले मार्ग", links: "लिंक संकेत", hear: "ऐका", stop: "थांबवा", read: "वाचा", hide: "लपवा", resultDetails: "निकालाचे तपशील",
    whatNow: "आता मी काय करावे?", blockNumber: "हा नंबर ब्लॉक करा", doNotShare: "OTP, पासवर्ड, बँक तपशील, UPI PIN किंवा इतर संवेदनशील माहिती देऊ नका.", doNotClick: "संशयास्पद पाठवणाऱ्याच्या लिंकवर क्लिक करू नका.", reportFraud: "सायबर फसवणुकीची तक्रार 1930 किंवा cybercrime.gov.in वर करा.", blockHelp: "हा नंबर ब्लॉक करण्यासाठी मदत हवी आहे?", whichPhone: "तुम्ही कोणता फोन वापरता?", android: "अँड्रॉइड", iphone: "आयफोन", notSure: "माहित नाही", blockAndroid: ["Phone अॅप उघडा.", "अलीकडील कॉल किंवा संपर्क शोधा.", "नंबरवर टॅप करा, नंतर Block किंवा Report spam निवडा."], blockIphone: ["Phone अॅप उघडा आणि Recents वर टॅप करा.", "नंबरजवळील माहिती चिन्हावर टॅप करा.", "खाली जाऊन Block this Caller वर टॅप करा."], blockUnsure: ["Phone अॅप उघडा.", "ज्या नंबरवरून कॉल आला त्यावर टॅप करा.", "Block किंवा Report spam पर्याय शोधा."],
    disclaimer: "सतर्क AI धोका दर्शवणारे नमुने ओळखते, खात्रीशीर सत्य नाही. महत्त्वाच्या विनंत्या अधिकृत मार्गाने तपासा.", emptyHistory: "अजून तपासणी नाही", emptyHistoryBody: "पूर्ण झालेल्या सुरक्षा तपासण्या या डिव्हाइसवर दिसतील.", activity: "तुमची कृती", checkHistory: "तपासणी इतिहास", historySub: "या डिव्हाइसवर जतन केले आहे. पाहण्यासाठी कोणत्याही तपासणीवर टॅप करा.",
    aboutTitle: "सुरक्षित निर्णय थोडा थांबल्यावर घेतले जातात.", aboutCopy: "फसवणूक करणारे फक्त अनोळखी नंबर वापरत नाहीत. ते घाई करायला लावतात, विश्वासू व्यक्तींची नक्कल करतात किंवा अशक्य बक्षिसाचे आमिष दाखवतात.", whatWeLookFor: "आम्ही काय पाहतो", language: "भाषा", appLanguage: "अॅपची भाषा", privacyNotice: "तपासण्या फक्त तुमच्या डिव्हाइसवर जतन होतात. OTP, पासवर्ड किंवा बँक तपशील टाकू नका.", lowRiskAdvice: "सावध रहा आणि कोणतीही कृती करण्यापूर्वी स्वतंत्रपणे तपासा.", retryAnalysis: "हा संदेश तपासता आला नाही. कृपया पुन्हा प्रयत्न करा.", example: "उदाहरण पाहा", readMore: "खाली तपशील वाचा.",
  },
} as const;

const LANGUAGE_KEY = "satark-ai-app-language-v1";
type AppLanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: Copy; languageLabel: (language: AppLanguage) => string };
const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

function preferredLanguage(): AppLanguage {
  const detected = Localization.getLocales()[0]?.languageCode;
  if (detected === "hi") return "hindi";
  if (detected === "mr") return "marathi";
  return "english";
}

export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(preferredLanguage);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      if (appLanguages.includes(saved as AppLanguage)) setLanguageState(saved as AppLanguage);
    }).catch(() => undefined);
  }, []);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  }, []);

  const languageLabel = useCallback((value: AppLanguage) => ({ hindi: "हिंदी", marathi: "मराठी", english: "English" })[value], []);
  const value = useMemo(() => ({ language, setLanguage, t: copy[language] as Copy, languageLabel }), [language, setLanguage, languageLabel]);
  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage() {
  const context = useContext(AppLanguageContext);
  if (!context) throw new Error("useAppLanguage must be used within AppLanguageProvider");
  return context;
}
