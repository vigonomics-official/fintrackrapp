// Lightweight i18n for the AI Coach. English + Tamil, with a persisted
// selection. Gemini-ready: response builders read from this dictionary so
// switching languages does not require UI changes.

export type CoachLanguage = "en" | "ta";

export const COACH_LANGUAGE_KEY = "fintrackr:ai-coach:lang";

type Dict = Record<string, string>;

const EN: Dict = {
  goodMorning: "Good Morning 👋",
  goodAfternoon: "Good Afternoon 👋",
  goodEvening: "Good Evening 👋",
  askAiCoach: "Ask AI Coach",
  clear: "Clear",
  close: "Close",
  send: "Send",
  thinking: "Thinking...",
  analyzing: "Analyzing your finances...",
  preparing: "Preparing advice...",
  askPlaceholder: "Ask about your money...",
  suggestedForYou: "Suggested for you",
  quickActions: "Quick actions",
  proactiveTip: "Insight for you",
  snapshotTitle: "Today's Financial Snapshot",
  survivalScore: "Survival Score",
  safeDailySpend: "Safe Daily Spend",
  currentBalance: "Balance",
  daysUntilSalary: "Days to Salary",
  confidenceScore: "Data Confidence",
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  earlier: "Earlier",
  history: "History",
  newChat: "New chat",
  emptyTitle: "No analysis yet",
  emptyBody: "Run your Salary Analysis first to unlock personalized AI coaching.",
  analyzeSalary: "Analyze Salary",
  explainMore: "Explain more",
  showCalc: "How it was calculated",
  applyPlanner: "Apply to Planner",
  createBudget: "Create budget",
  saveAdvice: "Save advice",
  saved: "Saved",
  voiceSoon: "Voice Assistant Coming Soon",
  compare: "Compare",
  whatIf: "What if?",
  applyAction: "Apply",
  language: "Language",
  basedOn: "Based on",
  why: "Why",
  action: "Recommended action",
  impact: "Estimated monthly impact",
  confidence: "Confidence",
  high: "High",
  medium: "Medium",
  low: "Low",
  errorReply: "Sorry, I couldn't process that just now. Please try again.",
  noContext:
    "I don't have your latest analysis yet. Run **Analyze** first and I'll answer with your real numbers.",
  safeToday: "You're spending within your safe limit today.",
  availableToday: "You have {amt} available to spend today.",
  daysLeft: "Only {n} days until salary. Avoid unnecessary spending.",
  july: "Recent Transactions",
  monthlyBudget: "Monthly Budget",
  salaryProfile: "Salary Profile",
  spendingHistory: "Spending History",
};

const TA: Dict = {
  goodMorning: "காலை வணக்கம் 👋",
  goodAfternoon: "மதிய வணக்கம் 👋",
  goodEvening: "மாலை வணக்கம் 👋",
  askAiCoach: "AI கோச்சிடம் கேளுங்கள்",
  clear: "அழி",
  close: "மூடு",
  send: "அனுப்பு",
  thinking: "சிந்திக்கிறேன்...",
  analyzing: "உங்கள் நிதியை பகுப்பாய்வு செய்கிறேன்...",
  preparing: "ஆலோசனை தயாராகிறது...",
  askPlaceholder: "உங்கள் பணம் பற்றி கேளுங்கள்...",
  suggestedForYou: "உங்களுக்காக பரிந்துரைகள்",
  quickActions: "விரைவு செயல்கள்",
  proactiveTip: "உங்களுக்கான குறிப்பு",
  snapshotTitle: "இன்றைய நிதி சுருக்கம்",
  survivalScore: "சர்வைவல் ஸ்கோர்",
  safeDailySpend: "பாதுகாப்பான தினசரி செலவு",
  currentBalance: "நடப்பு இருப்பு",
  daysUntilSalary: "சம்பளத்திற்கு நாட்கள்",
  confidenceScore: "தரவு நம்பகத்தன்மை",
  today: "இன்று",
  yesterday: "நேற்று",
  thisWeek: "இந்த வாரம்",
  earlier: "முந்தையவை",
  history: "வரலாறு",
  newChat: "புதிய அரட்டை",
  emptyTitle: "பகுப்பாய்வு இல்லை",
  emptyBody: "தனிப்பயன் AI கோச்சிங்கிற்கு முதலில் உங்கள் சம்பள பகுப்பாய்வை இயக்கவும்.",
  analyzeSalary: "சம்பளத்தை பகுப்பாய்வு செய்",
  explainMore: "மேலும் விளக்கம்",
  showCalc: "கணக்கீட்டைக் காட்டு",
  applyPlanner: "திட்டமிடலில் சேர்",
  createBudget: "பட்ஜெட் உருவாக்கு",
  saveAdvice: "ஆலோசனையை சேமி",
  saved: "சேமிக்கப்பட்டது",
  voiceSoon: "வாய்ஸ் அசிஸ்டன்ட் விரைவில்",
  language: "மொழி",
  basedOn: "அடிப்படையாக",
  why: "ஏன்",
  action: "பரிந்துரைக்கப்பட்ட செயல்",
  impact: "மாத தாக்கம்",
  confidence: "நம்பகத்தன்மை",
  high: "உயர்",
  medium: "நடுத்தர",
  low: "குறைவு",
  errorReply: "மன்னிக்கவும், இப்போது பதிலளிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  noContext:
    "உங்கள் சமீபத்திய பகுப்பாய்வு இல்லை. முதலில் **Analyze** இயக்கவும்.",
  safeToday: "இன்று நீங்கள் பாதுகாப்பான வரம்பிற்குள் செலவழிக்கிறீர்கள்.",
  availableToday: "இன்று செலவழிக்க {amt} உள்ளது.",
  daysLeft: "சம்பளத்திற்கு {n} நாட்கள் மட்டுமே. தேவையற்ற செலவை தவிர்க்கவும்.",
  july: "சமீபத்திய பரிவர்த்தனைகள்",
  monthlyBudget: "மாத பட்ஜெட்",
  salaryProfile: "சம்பள சுயவிவரம்",
  spendingHistory: "செலவு வரலாறு",
};

const DICTS: Record<CoachLanguage, Dict> = { en: EN, ta: TA };

function detectDefault(): CoachLanguage {
  if (typeof navigator === "undefined") return "en";
  const lang = (navigator.language || "en").toLowerCase();
  if (lang.startsWith("ta")) return "ta";
  return "en";
}

export function getLanguage(): CoachLanguage {
  try {
    const v = localStorage.getItem(COACH_LANGUAGE_KEY);
    if (v === "en" || v === "ta") return v;
  } catch {
    /* ignore */
  }
  return detectDefault();
}

export function setLanguage(lang: CoachLanguage): void {
  try {
    localStorage.setItem(COACH_LANGUAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function t(lang: CoachLanguage, key: keyof typeof EN, vars?: Record<string, string | number>): string {
  const dict = DICTS[lang] ?? EN;
  let s = dict[key] ?? EN[key] ?? String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  }
  return s;
}
