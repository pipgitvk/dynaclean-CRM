import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const LANG_NAMES = {
  en: "English",
  as: "Assamese",
  bn: "Bengali",
  brx: "Bodo",
  gu: "Gujarati",
  hi: "Hindi",
  kn: "Kannada",
  ks: "Kashmiri",
  gom: "Konkani",
  mai: "Maithili",
  ml: "Malayalam",
  mni: "Manipuri",
  mr: "Marathi",
  ne: "Nepali",
  or: "Odia",
  pa: "Punjabi",
  sa: "Sanskrit",
  sd: "Sindhi",
  si: "Sinhala",
  ta: "Tamil",
  te: "Telugu",
  ur: "Urdu",
};

const GOOGLE_LANG = {
  gom: "kok",
  brx: "brx",
  mai: "mai",
  mni: "mni",
  ks: "ks",
};

// Formal pronoun / tone fixes after Google Translate fallback
const RESPECTFUL_REPLACEMENTS = {
  hi: [
    [/\btumhe\b/gi, "आपको"],
    [/\btumhara\b/gi, "आपका"],
    [/\btumhari\b/gi, "आपकी"],
    [/\btumhare\b/gi, "आपके"],
    [/\btum\b/gi, "आप"],
    [/\btere\b/gi, "आपके"],
    [/\bter\b/gi, "आपका"],
    [/\btu\b/gi, "आप"],
  ],
  kn: [
    [/ನೀನು/g, "ನೀವು"],
    [/ನಿನ್ನ/g, "ನಿಮ್ಮ"],
    [/ನಿನಗೆ/g, "ನಿಮಗೆ"],
    [/ನೀನೇ/g, "ನೀವೇ"],
  ],
  ta: [
    [/நீ\b/g, "நீங்கள்"],
    [/உன்/g, "உங்கள்"],
    [/உனக்கு/g, "உங்களுக்கு"],
  ],
  te: [
    [/నువ్వు/g, "మీరు"],
    [/నీ /g, "మీ "],
    [/నీకు/g, "మీకు"],
  ],
  mr: [
    [/\btumhi\b/gi, "आपण"],
    [/\btumcha\b/gi, "आपला"],
    [/\btumchi\b/gi, "आपली"],
    [/\btu\b/gi, "आपण"],
  ],
  gu: [
    [/તું /g, "તમે "],
    [/તને/g, "તમને"],
    [/તાર/g, "તમાર"],
  ],
  bn: [
    [/তুই/g, "আপনি"],
    [/তোর/g, "আপনার"],
    [/তোকে/g, "আপনাকে"],
  ],
  pa: [
    [/ਤੂੰ /g, "ਤੁਸੀਂ "],
    [/ਤੇਰ/g, "ਤੁਹਾਡ"],
  ],
  ml: [
    [/നീ /g, "നിങ്ങൾ "],
    [/നിനക്ക്/g, "നിങ്ങൾക്ക്"],
    [/നിന്റെ/g, "നിങ്ങളുടെ"],
  ],
  ur: [
    [/تم /g, "آپ "],
    [/تمہار/g, "آپ کے"],
    [/تujhe/g, "آپ کو"],
    [/tu /g, "آپ "],
  ],
};

function toGoogleLang(code) {
  if (!code || code === "auto") return "auto";
  return GOOGLE_LANG[code] || code;
}

function applyRespectfulTone(text, lang) {
  const rules = RESPECTFUL_REPLACEMENTS[lang];
  if (!rules) return text;
  return rules.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text
  );
}

function buildRespectfulPrompt(text, targetLang, sourceLang) {
  const targetName = LANG_NAMES[targetLang] || targetLang;
  const sourceHint =
    sourceLang && sourceLang !== "auto"
      ? ` from ${LANG_NAMES[sourceLang] || sourceLang}`
      : "";

  return `You are translating customer follow-up notes for a professional CRM used by sales teams in India.

Translate the following text${sourceHint} into ${targetName}.

STRICT REQUIREMENTS:
- Use respectful, formal, and polite language suitable for professional business communication with customers
- Always use formal honorific pronouns and verb forms (examples: Hindi "आप" not "तुम"; Kannada "ನೀವು" not "ನೀನು"; Tamil "நீங்கள்" not "நீ"; Telugu "మీరు" not "నువ్వు"; Marathi "आपण" not "तू"; English: polite professional tone, no slang)
- Keep the meaning accurate and natural for CRM follow-up notes
- Do not add extra sentences, greetings, labels, or explanations
- Return ONLY the translated text with no quotes or markdown

Text:
${text}`;
}

async function translateWithGemini(text, targetLang, sourceLang) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const preferredModel = process.env.GEMINI_MODEL?.trim();
  const modelsToTry = [
    ...(preferredModel ? [preferredModel] : []),
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-1.5-pro-001",
  ];

  const prompt = buildRespectfulPrompt(text, targetLang, sourceLang);

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const translated = result.response.text()?.trim();
      if (translated) {
        return translated.replace(/^["']|["']$/g, "");
      }
    } catch {
      // try next model
    }
  }

  return null;
}

async function translateWithGoogle(text, targetLang, sourceLang = "auto") {
  const sl = toGoogleLang(sourceLang);
  const tl = toGoogleLang(targetLang);
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const translated = data?.[0]?.map((part) => part?.[0]).join("") || "";
  return translated.trim() || null;
}

export async function POST(request) {
  try {
    const { text, targetLang, sourceLang = "auto" } = await request.json();
    const trimmed = (text || "").trim();

    if (!trimmed) {
      return NextResponse.json({ text: "" });
    }
    if (!targetLang) {
      return NextResponse.json({ error: "targetLang is required" }, { status: 400 });
    }

    if (targetLang === "en" && sourceLang === "en") {
      return NextResponse.json({ text: trimmed });
    }

    let translated = await translateWithGemini(trimmed, targetLang, sourceLang);

    if (!translated) {
      translated = await translateWithGoogle(trimmed, targetLang, sourceLang);
      if (translated) {
        translated = applyRespectfulTone(translated, targetLang);
      }
    }

    if (!translated) {
      return NextResponse.json({ error: "Translation service unavailable" }, { status: 502 });
    }

    return NextResponse.json({ text: translated, targetLang });
  } catch (error) {
    console.error("[translate]", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
