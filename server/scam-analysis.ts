import { riskLevelForScore, type AnalysisLanguage, type ConfidenceLevel, type EvidenceSignal, type MessageCategory, type ScamAnalysis } from "../shared/scam-analysis";
import { lookupSafeBrowsing, type SafeBrowsingThreat } from "./safe-browsing";
type ScoredSignal = EvidenceSignal & { weight: number; tactic?: string };

const textByLanguage: Record<AnalysisLanguage, {
  noSuspicion: string; goalCredential: string; goalLink: string; goalFee: string; goalMoney: string; goalRemote: string; goalPromotion: string;
  safeAction: string; linkAction: string; credentialAction: string; feeAction: string; moneyAction: string; remoteAction: string; verifyAction: string;
  safeExplanation: string; spamExplanation: string; suspiciousExplanation: string; scamExplanation: string;
}> = {
  english: {
    noSuspicion: "No suspicious action request detected.", goalCredential: "Get you to share sensitive credentials.", goalLink: "Get you to open a link before you verify the request.", goalFee: "Get you to pay an advance fee.", goalMoney: "Get you to transfer money before independent verification.", goalRemote: "Get you to install an app, share your screen, or allow remote access.", goalPromotion: "Promote a product or service.",
    safeAction: "No immediate scam indicators detected. Continue normal caution.", linkAction: "Do not open the link. Verify through the organisation's official website or app.", credentialAction: "Do not share your OTP, password, PIN, Aadhaar, or banking credentials.", feeAction: "Do not pay a processing, registration, or release fee.", moneyAction: "Do not transfer money until you verify the request independently.", remoteAction: "Do not install an app, share your screen, or allow remote access.", verifyAction: "Contact the organisation using contact details from its official website.",
    safeExplanation: "Low-risk context was detected. The message does not contain a meaningful request for sensitive information, risky payment, or rushed action.", spamExplanation: "This looks like a promotional or marketing message. It may be unwanted, but strong fraud indicators were not detected.", suspiciousExplanation: "Some warning signs need independent verification, but the available evidence is not strong enough to treat this as a confirmed scam.", scamExplanation: "Strong scam indicators were detected. The score reflects the combination of evidence, not certainty about a person or organisation.",
  },
  hindi: {
    noSuspicion: "कोई संदिग्ध कार्रवाई का अनुरोध नहीं मिला।", goalCredential: "आपसे संवेदनशील जानकारी लेने की कोशिश।", goalLink: "जांच करने से पहले लिंक खुलवाने की कोशिश।", goalFee: "आपसे अग्रिम शुल्क दिलवाने की कोशिश।", goalMoney: "अलग से जांचने से पहले पैसे भेजवाने की कोशिश।", goalRemote: "ऐप इंस्टॉल, स्क्रीन शेयर या रिमोट एक्सेस दिलवाने की कोशिश।", goalPromotion: "किसी उत्पाद या सेवा का प्रचार।",
    safeAction: "तुरंत कोई धोखाधड़ी का संकेत नहीं मिला। सामान्य सावधानी रखें।", linkAction: "लिंक न खोलें। संस्था की आधिकारिक वेबसाइट या ऐप से जांचें।", credentialAction: "OTP, पासवर्ड, PIN, आधार या बैंक जानकारी साझा न करें।", feeAction: "प्रोसेसिंग, रजिस्ट्रेशन या रिलीज़ फीस न दें।", moneyAction: "अलग से जांचे बिना पैसे ट्रांसफर न करें।", remoteAction: "ऐप इंस्टॉल, स्क्रीन शेयर या रिमोट एक्सेस की अनुमति न दें।", verifyAction: "संस्था की आधिकारिक वेबसाइट के संपर्क विवरण से बात करें।",
    safeExplanation: "कम जोखिम वाला संदर्भ मिला। संदेश में संवेदनशील जानकारी, जोखिम भरे भुगतान या जल्दबाजी की सार्थक मांग नहीं है।", spamExplanation: "यह प्रचार या मार्केटिंग संदेश जैसा लगता है। यह अनचाहा हो सकता है, लेकिन मजबूत धोखाधड़ी संकेत नहीं मिले।", suspiciousExplanation: "कुछ संकेत अलग से जांचने की जरूरत बताते हैं, लेकिन उपलब्ध प्रमाण इसे पक्का स्कैम कहने के लिए पर्याप्त नहीं हैं।", scamExplanation: "मजबूत स्कैम संकेत मिले। स्कोर सबूतों के मेल को दिखाता है, किसी व्यक्ति या संस्था के बारे में पक्की बात नहीं।",
  },
  marathi: {
    noSuspicion: "संशयास्पद कृतीची मागणी आढळली नाही.", goalCredential: "तुमच्याकडून संवेदनशील माहिती मिळवण्याचा प्रयत्न.", goalLink: "तपासण्यापूर्वी लिंक उघडायला लावण्याचा प्रयत्न.", goalFee: "तुमच्याकडून आगाऊ शुल्क भरून घेण्याचा प्रयत्न.", goalMoney: "स्वतंत्र पडताळणीपूर्वी पैसे पाठवायला लावण्याचा प्रयत्न.", goalRemote: "अॅप इन्स्टॉल, स्क्रीन शेअर किंवा रिमोट अॅक्सेस मिळवण्याचा प्रयत्न.", goalPromotion: "उत्पादन किंवा सेवेचा प्रचार.",
    safeAction: "तत्काळ फसवणुकीचे संकेत आढळले नाहीत. नेहमीची सावधगिरी ठेवा.", linkAction: "लिंक उघडू नका. संस्थेच्या अधिकृत वेबसाइट किंवा अॅपमधून तपासा.", credentialAction: "OTP, पासवर्ड, PIN, आधार किंवा बँक तपशील देऊ नका.", feeAction: "प्रोसेसिंग, नोंदणी किंवा रिलीज फी भरू नका.", moneyAction: "स्वतंत्र पडताळणीशिवाय पैसे पाठवू नका.", remoteAction: "अॅप इन्स्टॉल, स्क्रीन शेअर किंवा रिमोट अॅक्सेस देऊ नका.", verifyAction: "संस्थेच्या अधिकृत वेबसाइटवरील संपर्क तपशील वापरा.",
    safeExplanation: "कमी-धोका संदर्भ आढळला. संदेशात संवेदनशील माहिती, धोकादायक पैसे देणे किंवा घाईची ठोस मागणी नाही.", spamExplanation: "हा प्रचार किंवा मार्केटिंग संदेश वाटतो. तो अनावश्यक असू शकतो, पण फसवणुकीचे ठोस संकेत आढळले नाहीत.", suspiciousExplanation: "काही संकेत स्वतंत्र पडताळणीची गरज दाखवतात, पण उपलब्ध पुरावा याला निश्चित स्कॅम म्हणण्यासाठी पुरेसा नाही.", scamExplanation: "फसवणुकीचे ठोस संकेत आढळले. स्कोअर पुराव्यांच्या एकत्रित परिणामावर आधारित आहे, व्यक्ती किंवा संस्थेबद्दल निश्चित दावा नाही.",
  },
};

function phrase(content: string, expression: RegExp): string | null {
  const found = content.match(expression);
  return found?.[0]?.trim() || null;
}

function includesAny(value: string, expressions: RegExp[]): boolean {
  return expressions.some((expression) => expression.test(value));
}

function localLinkFinding(kind: "short" | "unusual" | "http", language: AnalysisLanguage): string {
  const copy = {
    short: ["Shortened links can hide the final destination. Verify before opening.", "छोटे लिंक अंतिम वेबसाइट छिपा सकते हैं। खोलने से पहले जांचें।", "लहान लिंक अंतिम वेबसाइट लपवू शकतात. उघडण्यापूर्वी तपासा."],
    unusual: ["This link uses an unusual domain ending. It could not be independently verified.", "इस लिंक की डोमेन समाप्ति असामान्य है। इसे स्वतंत्र रूप से सत्यापित नहीं किया जा सका।", "या लिंकची डोमेन समाप्ती असामान्य आहे. ती स्वतंत्रपणे पडताळता आली नाही."],
    http: ["This link uses HTTP rather than HTTPS for a sensitive action. Do not enter details until independently verified.", "यह लिंक संवेदनशील कार्रवाई के लिए HTTPS की जगह HTTP इस्तेमाल करता है। जांचे बिना जानकारी न दें।", "हा लिंक संवेदनशील कृतीसाठी HTTPS ऐवजी HTTP वापरतो. पडताळणीशिवाय माहिती देऊ नका."],
  }[kind];
  return language === "hindi" ? copy[1] : language === "marathi" ? copy[2] : copy[0];
}

function unsafeUrlText(language: AnalysisLanguage, threatCount: number): string {
  if (language === "hindi") return `Google Safe Browsing ने ${threatCount} असुरक्षित URL संकेत पाया।`;
  if (language === "marathi") return `Google Safe Browsing ने ${threatCount} असुरक्षित URL संकेत शोधला.`;
  return `Google Safe Browsing reported ${threatCount} unsafe URL signal${threatCount === 1 ? "" : "s"}.`;
}

function unsafeUrlFinding(language: AnalysisLanguage, threat: SafeBrowsingThreat): string {
  if (language === "hindi") return `असुरक्षित URL संकेत: ${threat.threatType.replace(/_/g, " ")}. इस लिंक को न खोलें।`;
  if (language === "marathi") return `असुरक्षित URL संकेत: ${threat.threatType.replace(/_/g, " ")}. ही लिंक उघडू नका.`;
  return `Unsafe URL signal: ${threat.threatType.replace(/_/g, " ")}. Do not open this link.`;
}

export function extractMeaningfulUrls(content: string): string[] {
  const rawUrls = content.match(/(?:https?:\/\/|www\.)[^\s<>{}"']+|\b(?:[a-z0-9-]+\.)+(?:com|in|net|org|info|xyz|top|click|link|ly)(?:\/[^\s<>{}"']*)?/gi) ?? [];
  return [...new Set(rawUrls.map((value) => value.replace(/[).,!?:;]+$/, "")).map((value) => /^https?:\/\//i.test(value) ? value : `https://${value}`))].slice(0, 10);
}

export function mergeSafeBrowsingEvidence(analysis: ScamAnalysis, threats: SafeBrowsingThreat[]): ScamAnalysis {
  if (!threats.length) return analysis;
  const copy = textByLanguage[analysis.language];
  const riskSignals = [...analysis.riskSignals];
  const urlFindings = [...analysis.urlFindings];
  for (const threat of threats) {
    if (!riskSignals.some((signal) => signal.type === "UNSAFE_URL" && signal.evidence.includes(threat.url))) {
      riskSignals.push({ type: "UNSAFE_URL", evidence: `${threat.url} (${threat.threatType.replace(/_/g, " ")})` });
    }
    const finding = unsafeUrlFinding(analysis.language, threat);
    if (!urlFindings.includes(finding)) urlFindings.push(finding);
  }
  const recommendedActions = [...new Set([copy.linkAction, ...analysis.recommendedActions])].slice(0, 4);
  const riskScore = Math.min(100, Math.max(75, analysis.riskScore + 45));
  console.info(`[Satark AI] Safe Browsing added ${threats.length} unsafe URL threat(s); final risk contribution raised score to ${riskScore}.`);
  return {
    ...analysis,
    riskScore,
    riskLevel: riskLevelForScore(riskScore),
    category: "SCAM",
    confidence: "HIGH",
    tactics: [...new Set(["Unsafe URL detected", ...analysis.tactics])].slice(0, 6),
    riskSignals,
    likelyGoal: analysis.likelyGoal === copy.noSuspicion ? copy.goalLink : analysis.likelyGoal,
    explanation: `${unsafeUrlText(analysis.language, threats.length)} ${analysis.explanation}`.slice(0, 620),
    recommendedAction: recommendedActions[0],
    recommendedActions,
    urlFindings: urlFindings.slice(0, 4),
  };
}

function scoreContext(content: string, language: AnalysisLanguage): ScamAnalysis {
  const lower = content.toLowerCase();
  const copy = textByLanguage[language];
  const riskSignals: ScoredSignal[] = [];
  const legitimateSignals: EvidenceSignal[] = [];
  const urlFindings: string[] = [];
  const tactics: string[] = [];
  const addRisk = (type: string, evidence: string, weight: number, tactic?: string) => {
    if (riskSignals.some((signal) => signal.type === type)) return;
    riskSignals.push({ type, evidence, weight, tactic });
    if (tactic && !tactics.includes(tactic)) tactics.push(tactic);
  };
  const addLegitimate = (type: string, evidence: string) => {
    if (!legitimateSignals.some((signal) => signal.type === type)) legitimateSignals.push({ type, evidence });
  };

  const isEducation = includesAny(lower, [/never\s+share\s+(your\s+)?(otp|upi\s*pin|password)/i, /do\s+not\s+share\s+(your\s+)?(otp|upi\s*pin|password)/i, /किसी.*otp.*न.*दें/i, /otp.*कोणालाही.*देऊ\s+नका/i]);
  const hasCredentialNoun = includesAny(lower, [/\b(otp|password|passcode|cvv|upi\s*pin|pin|aadhaar)\b/i, /ओटीपी|पासवर्ड|यूपीआई\s*पिन|आधार/i, /ओटीपी|पासवर्ड|upi\s*pin|आधार/i]);
  const hasCredentialAction = includesAny(lower, [/\b(enter|share|send|provide|submit|tell|verify)\b.{0,32}\b(otp|password|passcode|cvv|upi\s*pin|pin|aadhaar)\b/i, /\b(otp|password|passcode|cvv|upi\s*pin|pin|aadhaar)\b.{0,32}\b(enter|share|send|provide|submit)\b/i, /(otp|पासवर्ड|आधार).{0,25}(डालें|भेजें|साझा करें)/i, /(otp|पासवर्ड|आधार).{0,25}(द्या|पाठवा|शेअर करा)/i]);
  const hasPaymentAction = includesAny(lower, [/\b(pay|transfer|send|deposit|recharge)\b.{0,40}\b(₹|rs\.?|inr|fee|payment|upi|money|amount)/i, /\b(₹|rs\.?|inr|fee|payment|upi|money|amount)\b.{0,40}\b(pay|transfer|send|deposit)/i, /(भुगतान|पैसे|रुपये).{0,30}(करें|भेजें)/i, /(पैसे|रुपये|फी).{0,30}(भरा|पाठवा)/i]);
  const hasThreat = includesAny(lower, [/\b(account|kyc|connection|service|parcel|delivery).{0,35}\b(blocked|suspended|disconnected|expire|closed|cancelled|cancellation)/i, /\b(blocked|suspended|disconnected|expire|cancelled|cancellation)\b.{0,35}\b(account|kyc|connection|service|parcel|delivery)/i, /(खाता|kyc|कनेक्शन|पार्सल).{0,25}(बंद|ब्लॉक|समाप्त|रद्द)/i, /(खाते|kyc|कनेक्शन|पार्सल).{0,25}(बंद|ब्लॉक|संपेल|रद्द)/i]);
  const hasUrgency = includesAny(lower, [/\b(today|now|immediately|within\s+\d+|minutes?|hours?|urgent|last chance)\b/i, /आज|तुरंत|अभी|मिनट/i, /आज|तात्काळ|आता|मिनिट/i]);
  const hasAction = hasCredentialAction || hasPaymentAction || includesAny(lower, [/\b(click|open|install|download|call|reply|verify)\b/i, /क्लिक|खोलें|इंस्टॉल|डाउनलोड|जवाब/i, /क्लिक|उघडा|इन्स्टॉल|डाउनलोड|उत्तर/i]);
  const hasImpersonation = includesAny(lower, [/\b(bank|rbi|police|government|income tax|customer care|courier)\b/i, /बैंक|सरकार|पुलिस/i, /बँक|सरकार|पोलीस/i]);
  const hasDeliveryImpersonation = includesAny(lower, [/\b(parcel|delivery|courier).{0,45}\b(address|cancel|verification|fee)\b/i, /\b(address|cancel|verification|fee).{0,45}\b(parcel|delivery|courier)\b/i, /(पार्सल|डिलीवरी).{0,35}(पता|रद्द|फीस|सत्यापन)/i, /(पार्सल|डिलिव्हरी).{0,35}(पत्ता|रद्द|फी|पडताळणी)/i]);
  const hasPrize = includesAny(lower, [/\b(won|winner|prize|lottery|lakh|cashback|reward|congratulations)\b/i, /इनाम|लाख|जीते/i, /बक्षीस|लाख|जिंकलात/i]);
  const hasAdvanceFee = hasPaymentAction && includesAny(lower, [/\b(processing|registration|release|activation|security)\s*fee\b/i, /प्रोसेसिंग\s*फीस|रजिस्ट्रेशन\s*फीस/i, /प्रोसेसिंग\s*फी|नोंदणी\s*फी/i]);
  const hasRemoteAccess = includesAny(lower, [/\b(screen\s*share|remote\s*access|install\s+(this\s+)?app|anydesk|teamviewer)\b/i, /स्क्रीन\s*शेयर|रिमोट\s*एक्सेस/i, /स्क्रीन\s*शेअर|रिमोट\s*अॅक्सेस/i]);
  const hasSecrecy = includesAny(lower, [/\b(do not tell|keep this secret|don't contact|do not contact)\b/i, /किसी को मत बताना|संपर्क न करें/i, /कोणाला सांगू नका|संपर्क करू नका/i]);
  const promotional = includesAny(lower, [/\b(flat\s+\d+%|discount|sale|shop\s+before|selected\s+items?|offer)\b/i, /छूट|ऑफर/i, /सवलत|ऑफर/i]);
  const normalTransaction = includesAny(lower, [/\b(debited|credited|transaction\s+(?:of|was)|upi\s+transaction)\b/i, /डेबिट|क्रेडिट/i, /डेबिट|क्रेडिट/i]) && !hasAction;
  const officialReminder = includesAny(lower, [/official\s+(app|website)/i, /आधिकारिक\s+(ऐप|वेबसाइट)/i, /अधिकृत\s+(अॅप|वेबसाइट)/i]) && !hasCredentialAction && !hasThreat;
  const personalMessage = includesAny(lower, [/\b(are we still|meeting for lunch|see you tomorrow|how are you)\b/i]);
  const ambiguousVerification = includesAny(lower, [/\b(account|profile|details?).{0,35}\b(verify|update)\b/i, /\b(verify|update).{0,35}\b(account|profile|details?)\b/i, /(खाता|विवरण).{0,25}(सत्यापित|अपडेट)/i, /(खाते|तपशील).{0,25}(पडताळा|अपडेट)/i]) && !hasCredentialAction && !officialReminder && !normalTransaction;
  const urls = extractMeaningfulUrls(content);

  if (isEducation) addLegitimate("ANTI_SCAM_EDUCATION", "The message warns the reader not to share credentials.");
  if (normalTransaction) addLegitimate("TRANSACTION_NOTIFICATION", "A transaction alert is stated without a request to act.");
  if (officialReminder) addLegitimate("OFFICIAL_CHANNEL", "The message points to an official app or website without a credential request.");
  if (personalMessage) addLegitimate("PERSONAL_CONTEXT", "The message appears to be a normal personal conversation.");
  if (promotional && !hasPaymentAction && !hasCredentialAction) addLegitimate("PROMOTIONAL_CONTEXT", "The message promotes an offer without a sensitive-information request.");

  if (!isEducation) {
    if (hasCredentialAction) addRisk("CREDENTIAL_REQUEST", phrase(content, /(?:enter|share|send|provide|submit).{0,45}(?:OTP|password|UPI PIN|Aadhaar)|(?:OTP|password|UPI PIN|Aadhaar).{0,45}(?:enter|share|send|provide|submit)/i) ?? "The message directly asks for sensitive credentials.", 38, "OTP/Credential Request");
    if (hasThreat && (hasUrgency || hasAction)) addRisk("ACCOUNT_THREAT", phrase(content, /[^.!?]{0,30}(?:blocked|suspended|disconnected|expire)[^.!?]{0,30}/i) ?? "The message threatens service or account interruption.", 24, "Account Threat");
    if (hasUrgency && hasAction) addRisk("RUSHED_ACTION", phrase(content, /[^.!?]{0,25}(?:today|now|immediately|within\s+\d+|urgent)[^.!?]{0,25}/i) ?? "The message creates a short deadline for action.", 12, "Fake Urgency");
    if (hasImpersonation && (hasAction || hasThreat || hasPaymentAction)) addRisk("IMPERSONATION", "The message invokes a trusted organisation while requesting action.", 13, "Authority Impersonation");
    if (hasDeliveryImpersonation && (hasPaymentAction || hasUrgency || hasThreat)) addRisk("DELIVERY_IMPERSONATION", "The message uses a parcel or delivery issue to request urgent action or payment.", 16, "Delivery impersonation");
    if (hasPaymentAction) addRisk("MONEY_REQUEST", phrase(content, /[^.!?]{0,25}(?:pay|transfer|fee|payment|UPI)[^.!?]{0,35}/i) ?? "The message asks for money or a payment action.", 20, "Payment Pressure");
    if (hasAdvanceFee) addRisk("ADVANCE_FEE", phrase(content, /[^.!?]{0,25}(?:processing|registration|release|activation).{0,25}(?:fee|fees)/i) ?? "The message asks for an advance or processing fee.", 28, "Advance-fee request");
    if (hasPrize && (hasPaymentAction || hasAdvanceFee || hasUrgency)) addRisk("UNLIKELY_REWARD", phrase(content, /[^.!?]{0,25}(?:won|winner|prize|lottery|lakh|reward)[^.!?]{0,35}/i) ?? "The message uses an unusually attractive reward to prompt action.", 18, "Too-Good-To-Be-True Offer");
    if (hasRemoteAccess) addRisk("REMOTE_ACCESS", "The message asks for an app install, screen share, or remote access.", 26, "Remote access request");
    if (hasSecrecy) addRisk("DISCOURAGES_VERIFICATION", "The message discourages independent verification or contact.", 14, "Discourages verification");
    if (ambiguousVerification) addRisk("AMBIGUOUS_VERIFICATION_REQUEST", "The message asks for account or detail verification without enough context to independently confirm it.", 42, "Verification request");
  }

  for (const url of urls.slice(0, 2)) {
    if (/\b(bit\.ly|tinyurl\.com|t\.co)\b/i.test(url)) {
      addRisk("SHORTENED_LINK", url, 16, "Phishing Link");
      urlFindings.push(localLinkFinding("short", language));
    } else if (/\.(xyz|top|click|link)\b/i.test(url)) {
      addRisk("UNUSUAL_DOMAIN", url, 10, "Unusual link");
      urlFindings.push(localLinkFinding("unusual", language));
    } else if (/^http:\/\//i.test(url) && (hasCredentialAction || hasPaymentAction)) {
      addRisk("INSECURE_LINK", url, 12, "Insecure link");
      urlFindings.push(localLinkFinding("http", language));
    }
  }

  let score = riskSignals.reduce((total, signal) => total + signal.weight, 3);
  const types = new Set(riskSignals.map((signal) => signal.type));
  if (types.has("CREDENTIAL_REQUEST") && (types.has("SHORTENED_LINK") || types.has("ACCOUNT_THREAT"))) score += 14;
  if (types.has("ADVANCE_FEE") && types.has("UNLIKELY_REWARD")) score += 12;
  if (types.has("ACCOUNT_THREAT") && types.has("RUSHED_ACTION")) score += 7;
  if (types.has("REMOTE_ACCESS") && types.has("IMPERSONATION")) score += 8;
  if (legitimateSignals.length && !riskSignals.length) score = promotional ? 24 : normalTransaction || officialReminder || personalMessage || isEducation ? 6 : 12;
  if (officialReminder && riskSignals.every((signal) => signal.type === "MONEY_REQUEST")) score = Math.min(score, 14);
  if (promotional && !riskSignals.length) score = 24;
  if (isEducation) score = 3;
  score = Math.max(0, Math.min(100, score));

  const strongScamPattern = types.has("CREDENTIAL_REQUEST") && (types.has("SHORTENED_LINK") || types.has("ACCOUNT_THREAT") || types.has("IMPERSONATION")) || types.has("ADVANCE_FEE") && (types.has("UNLIKELY_REWARD") || types.has("MONEY_REQUEST"));
  if (strongScamPattern) score = Math.max(score, 80);
  const category: MessageCategory = strongScamPattern || score >= 80 ? "SCAM" : promotional && !riskSignals.length ? "SPAM / PROMOTIONAL" : score >= 40 ? "SUSPICIOUS" : "SAFE";
  const confidence: ConfidenceLevel = strongScamPattern || (category === "SAFE" && legitimateSignals.length >= 1) || riskSignals.length >= 3 ? "HIGH" : riskSignals.length === 1 || category === "SPAM / PROMOTIONAL" ? "MEDIUM" : "LOW";
  const likelyGoal = types.has("CREDENTIAL_REQUEST") ? copy.goalCredential : types.has("REMOTE_ACCESS") ? copy.goalRemote : types.has("SHORTENED_LINK") || types.has("UNUSUAL_DOMAIN") ? copy.goalLink : types.has("ADVANCE_FEE") ? copy.goalFee : types.has("MONEY_REQUEST") ? copy.goalMoney : promotional ? copy.goalPromotion : copy.noSuspicion;
  const recommendedActions: string[] = [];
  if (types.has("CREDENTIAL_REQUEST")) recommendedActions.push(copy.credentialAction);
  if (types.has("SHORTENED_LINK") || types.has("UNUSUAL_DOMAIN") || types.has("INSECURE_LINK")) recommendedActions.push(copy.linkAction);
  if (types.has("ADVANCE_FEE")) recommendedActions.push(copy.feeAction);
  if (types.has("MONEY_REQUEST") && !types.has("ADVANCE_FEE")) recommendedActions.push(copy.moneyAction);
  if (types.has("REMOTE_ACCESS")) recommendedActions.push(copy.remoteAction);
  if (types.has("IMPERSONATION") || types.has("ACCOUNT_THREAT")) recommendedActions.push(copy.verifyAction);
  if (!recommendedActions.length) recommendedActions.push(copy.safeAction);
  const explanation = category === "SCAM" ? copy.scamExplanation : category === "SUSPICIOUS" ? copy.suspiciousExplanation : category === "SPAM / PROMOTIONAL" ? copy.spamExplanation : copy.safeExplanation;

  return {
    riskScore: score,
    riskLevel: riskLevelForScore(score),
    language,
    category,
    confidence,
    tactics,
    riskSignals: riskSignals.map(({ type, evidence }) => ({ type, evidence })),
    legitimateSignals,
    likelyGoal,
    explanation,
    recommendedAction: recommendedActions[0],
    recommendedActions: [...new Set(recommendedActions)].slice(0, 4),
    urlFindings,
  };
}

/**
 * V2's shared engine: transcript text reaches this exact same function after speech-to-text.
 * The score is composed from contextual evidence and calibrated combinations, not an LLM feeling.
 */
export async function analyzeSuspiciousText(content: string, language: AnalysisLanguage = "english"): Promise<ScamAnalysis> {
  const analysis = scoreContext(content, language);
  const urls = extractMeaningfulUrls(content);
  if (!urls.length) return analysis;
  console.info(`[Satark AI] Extracted ${urls.length} URL(s) for Safe Browsing lookup: ${urls.join(", ")}`);
  const reputation = await lookupSafeBrowsing(urls);
  if (reputation.status !== "checked") {
    console.info(`[Satark AI] Safe Browsing status: ${reputation.status}; continuing with contextual analysis only.`);
    return analysis;
  }
  return mergeSafeBrowsingEvidence(analysis, reputation.threats);
}

/** Maintained for existing imports and focused fallback tests. */
export function createSafetyFallback(content: string, language: AnalysisLanguage = "english"): ScamAnalysis {
  return scoreContext(content, language);
}
