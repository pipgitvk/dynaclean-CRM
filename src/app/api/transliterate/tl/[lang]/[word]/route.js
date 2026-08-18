import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// xlit-api.ai4bharat.org is no longer reachable (DNS dead). Proxy via working backends.
const GOOGLE_ITC = {
  as: "as-t-i0-und",
  bn: "bn-t-i0-und",
  gu: "gu-t-i0-und",
  hi: "hi-t-i0-und",
  kn: "kn-t-i0-und",
  ml: "ml-t-i0-und",
  mr: "mr-t-i0-und",
  ne: "ne-t-i0-und",
  or: "or-t-i0-und",
  pa: "pa-t-i0-und",
  sa: "sa-t-i0-und",
  sd: "sd-t-i0-und",
  si: "si-t-i0-und",
  ta: "ta-t-i0-und",
  te: "te-t-i0-und",
  ur: "ur-t-i0-und",
  gom: "kok-t-i0-und",
  mai: "mai-t-i0-und",
};

const VARNAM_LANGS = new Set([
  "as", "bn", "gu", "hi", "kn", "ml", "mr", "ne", "or", "pa", "sa", "ta", "te",
]);

async function fetchGoogleSuggestions(word, lang) {
  const itc = GOOGLE_ITC[lang];
  if (!itc) return null;

  const url =
    `https://www.google.com/inputtools/request?text=${encodeURIComponent(word)}` +
    `&itc=${itc}&num=10&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demo`;

  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;

  const data = await res.json();
  const suggestions = data?.[1]?.[0]?.[1];
  return Array.isArray(suggestions) && suggestions.length ? suggestions : null;
}

async function fetchVarnamSuggestions(word, lang) {
  if (!VARNAM_LANGS.has(lang)) return null;

  const res = await fetch(
    `https://api.varnamproject.com/tl/${lang}/${encodeURIComponent(word).replace(".", "%2E")}`
  );
  if (!res.ok) return null;

  const data = await res.json();
  return Array.isArray(data?.result) && data.result.length ? data.result : null;
}

export async function GET(_request, { params }) {
  const { lang, word } = await params;
  const decodedWord = decodeURIComponent(word || "").trim();

  if (!lang || !decodedWord) {
    return NextResponse.json({ result: [] });
  }

  try {
    const google = await fetchGoogleSuggestions(decodedWord, lang);
    if (google) {
      return NextResponse.json({ result: google, input: decodedWord, success: true });
    }

    const varnam = await fetchVarnamSuggestions(decodedWord, lang);
    if (varnam) {
      return NextResponse.json({ result: varnam, input: decodedWord, success: true });
    }

    return NextResponse.json({ result: [decodedWord], input: decodedWord, success: false });
  } catch (error) {
    console.error("[transliterate]", lang, decodedWord, error);
    return NextResponse.json({ result: [decodedWord], input: decodedWord, success: false });
  }
}
