export const NOTES_LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "as", name: "Assamese" },
  { code: "bn", name: "Bengali" },
  { code: "gu", name: "Gujarati" },
  { code: "gom", name: "Konkani" },
  { code: "hi", name: "Hindi" },
  { code: "kn", name: "Kannada" },
  { code: "mai", name: "Maithili" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "ne", name: "Nepali" },
  { code: "or", name: "Odia" },
  { code: "pa", name: "Punjabi" },
  { code: "sa", name: "Sanskrit" },
  { code: "sd", name: "Sindhi" },
  { code: "si", name: "Sinhala" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "ur", name: "Urdu" },
];

export function notesLanguageExistsSql(paramPlaceholder = "?") {
  return `EXISTS (
    SELECT 1 FROM customers_followup cf_lang
    WHERE cf_lang.customer_id = c.customer_id
      AND cf_lang.notes_language = ${paramPlaceholder}
  )`;
}
