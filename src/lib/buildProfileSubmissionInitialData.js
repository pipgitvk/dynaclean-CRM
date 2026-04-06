import { isExplicitlyFresherSubmission } from "@/lib/profileExperiencedUi";

/**
 * Best-effort key from a stored upload filename (local or CDN).
 * Supports: doc_pan_card_123.jpg, doc_pan_card_123_extra.jpg, Cloudinary .../doc_pan_card_169..._x.jpg
 */
export function extractKeyFromUploadFilename(filename) {
  if (!filename || typeof filename !== "string") return null;
  const base = filename.split("?")[0].split("#")[0];
  const name = base.includes("/") ? base.split("/").pop() : base;
  if (!name) return null;
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    decoded = name;
  }

  const docPrefix = /^(doc_[a-z0-9_]+)/i;
  const mDoc = decoded.match(docPrefix);
  if (mDoc) {
    const rest = decoded.slice(mDoc[1].length);
    if (/^_\d/.test(rest) || rest === "") {
      return mDoc[1];
    }
  }

  const mLegacy = decoded.match(/^(.*)_\d+(?:\.[^.]+)?$/);
  if (mLegacy?.[1]) {
    const g = mLegacy[1];
    if (/^doc_/i.test(g)) return g;
    if (!/_/.test(g)) return g;
  }

  const mCloudy = decoded.match(/^(.+)_\d{10,}_[a-z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|pdf)$/i);
  if (mCloudy?.[1] && /^doc_/i.test(mCloudy[1])) return mCloudy[1];

  return null;
}

function parseMaybeJsonObject(val) {
  if (val == null) return {};
  if (typeof val === "string") {
    try {
      const o = JSON.parse(val);
      return typeof o === "object" && o !== null && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  if (typeof val === "object" && !Array.isArray(val)) return val;
  return {};
}

/** URLs keyed by doc_* field from documents_submitted.doc_paths */
export function fileUrlsFromDocumentsSubmittedObject(documentsSubmitted) {
  const out = {};
  const o = parseMaybeJsonObject(documentsSubmitted);
  const paths = o.doc_paths;
  if (paths && typeof paths === "object") {
    for (const [k, v] of Object.entries(paths)) {
      if (typeof v === "string" && v.trim()) {
        out[k.trim()] = v.trim();
      }
    }
  }
  return out;
}

/** joining_form_documents: array of strings OR [{ docKey, url }, ...] */
export function fileUrlsFromJoiningFormDocuments(joining) {
  const out = {};
  let arr = joining;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return out;
  for (const item of arr) {
    if (item && typeof item === "object" && item.docKey != null && item.url != null) {
      const k = String(item.docKey).trim();
      const u = String(item.url).trim();
      if (k && u) out[k] = u;
    }
  }
  return out;
}

/** Legacy: derive keys from uploaded_files URL paths (partial; prefer doc_paths + joining_form). */
export function fileUrlsFromUploadedFilesArray(uploadedFiles) {
  const out = {};
  if (!Array.isArray(uploadedFiles)) return out;
  for (const raw of uploadedFiles) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const url = raw.trim();
    const filename = url.split("/").pop() || "";
    const key = extractKeyFromUploadFilename(filename);
    if (key) out[key] = url;
  }
  return out;
}

/**
 * Merge file URL maps; later arguments win (submission over live profile handled by caller).
 */
export function mergeFileUrlMaps(...maps) {
  return Object.assign({}, ...maps.filter(Boolean));
}

/** Flatten doc_paths URLs into checklist booleans so DocumentsSection checkboxes show "Selected". */
export function normalizeDocumentsSubmittedForForm(documentsSubmitted) {
  const o = parseMaybeJsonObject(documentsSubmitted);
  const next = { ...o };
  const paths = next.doc_paths;
  if (paths && typeof paths === "object") {
    for (const [k, v] of Object.entries(paths)) {
      if (typeof v === "string" && v.trim()) {
        next[k] = true;
      }
    }
  }
  return next;
}

/**
 * Maps a employee_profile_submissions row to ProfileForm initialData + fileUrls (same logic as admin review page).
 */
export function buildProfileSubmissionInitialData(submission) {
  if (!submission?.payload) {
    return { initialData: null, fileUrls: {} };
  }
  let payload;
  try {
    payload = typeof submission.payload === "string" ? JSON.parse(submission.payload) : submission.payload;
  } catch {
    return { initialData: null, fileUrls: {} };
  }
  if (!payload?.data) {
    return { initialData: null, fileUrls: {} };
  }

  let uploadedFiles = [];
  try {
    uploadedFiles = submission.uploaded_files ? JSON.parse(submission.uploaded_files) : [];
  } catch {
    uploadedFiles = [];
  }

  let documents_submitted = {};
  const rawDocs = payload.data?.documents_submitted;
  if (rawDocs != null) {
    if (typeof rawDocs === "string") {
      try {
        documents_submitted = JSON.parse(rawDocs);
      } catch {
        documents_submitted = {};
      }
    } else if (typeof rawDocs === "object") {
      documents_submitted = { ...rawDocs };
    }
  }

  const fileUrls = mergeFileUrlMaps(
    fileUrlsFromUploadedFilesArray(uploadedFiles),
    fileUrlsFromDocumentsSubmittedObject(documents_submitted),
    fileUrlsFromJoiningFormDocuments(payload.data?.joining_form_documents)
  );

  documents_submitted = normalizeDocumentsSubmittedForForm(documents_submitted);

  const initialData = {
    ...payload.data,
    references: payload.references,
    education: payload.education,
    experience: payload.experience,
    documents_submitted,
    fileUrls,
  };

  return { initialData, fileUrls };
}

function isEmptyScalar(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

function mapReferencesForForm(refs) {
  return (refs || []).map((ref) => ({
    name: ref.name || ref.reference_name || "",
    contact: ref.contact || ref.reference_mobile || "",
    address: ref.address || ref.reference_address || "",
    relationship: ref.relationship || "",
  }));
}

function submissionReferencesHaveContent(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return false;
  return refs.some((r) => (r?.name || "").trim() || (r?.contact || "").trim());
}

/**
 * Fills gaps in submission-derived initialData from the live employee_profiles GET response
 * so HR review shows the full picture when the submission payload is partial.
 * Non-empty submission values win over profile.
 */
export function mergeSubmissionInitialWithLiveProfile(submissionInitial, liveApiResponse) {
  if (!submissionInitial) return null;
  if (!liveApiResponse?.success || !liveApiResponse.profile) {
    return submissionInitial;
  }

  const p = liveApiResponse.profile;
  const liveRefs = mapReferencesForForm(p.references);
  const liveEdu = Array.isArray(p.education) ? p.education : [];
  const liveExp = Array.isArray(p.experience) ? p.experience : [];

  let liveDocs = {};
  if (p.documents_submitted != null) {
    if (typeof p.documents_submitted === "string") {
      try {
        liveDocs = JSON.parse(p.documents_submitted);
      } catch {
        liveDocs = {};
      }
    } else if (typeof p.documents_submitted === "object") {
      liveDocs = p.documents_submitted;
    }
  }

  const subDocs = submissionInitial.documents_submitted || {};
  const mergedDocs = { ...liveDocs, ...subDocs };

  const skipKeys = new Set([
    "references",
    "education",
    "experience",
    "documents_submitted",
    "fileUrls",
    "joining_form_documents",
    "leave_policy",
  ]);

  const merged = { ...submissionInitial };

  for (const key of new Set([...Object.keys(submissionInitial), ...Object.keys(p)])) {
    if (skipKeys.has(key)) continue;
    if (key === "id") continue; // profile PK — avoid clobbering form fields
    const sv = submissionInitial[key];
    const pv = p[key];
    if (!isEmptyScalar(sv)) {
      merged[key] = sv;
    } else if (!isEmptyScalar(pv)) {
      merged[key] = pv;
    } else {
      merged[key] = sv ?? pv;
    }
  }

  const sLp = submissionInitial.leave_policy;
  const pLp = p.leave_policy;
  if (sLp && typeof sLp === "object" && pLp && typeof pLp === "object") {
    merged.leave_policy = { ...pLp, ...sLp };
  } else if ((!sLp || Object.keys(sLp || {}).length === 0) && pLp && typeof pLp === "object") {
    merged.leave_policy = { ...pLp };
  }

  merged.references = submissionReferencesHaveContent(submissionInitial.references)
    ? submissionInitial.references
    : liveRefs.length ? liveRefs : submissionInitial.references || [];

  merged.education =
    Array.isArray(submissionInitial.education) && submissionInitial.education.length > 0
      ? submissionInitial.education
      : liveEdu;

  if (isExplicitlyFresherSubmission(submissionInitial)) {
    merged.experience = Array.isArray(submissionInitial.experience)
      ? submissionInitial.experience
      : [];
  } else {
    merged.experience =
      Array.isArray(submissionInitial.experience) && submissionInitial.experience.length > 0
        ? submissionInitial.experience
        : liveExp;
  }

  merged.documents_submitted = normalizeDocumentsSubmittedForForm(mergedDocs);

  const subJoin = submissionInitial.joining_form_documents;
  const pJoin = p.joining_form_documents;
  if ((!Array.isArray(subJoin) || subJoin.length === 0) && Array.isArray(pJoin) && pJoin.length > 0) {
    merged.joining_form_documents = pJoin;
  }

  merged.fileUrls = mergeFileUrlMaps(
    submissionInitial.fileUrls,
    fileUrlsFromDocumentsSubmittedObject(mergedDocs),
    fileUrlsFromJoiningFormDocuments(p.joining_form_documents),
    fileUrlsFromJoiningFormDocuments(merged.joining_form_documents)
  );
  const liveUploadList = [];
  if (Array.isArray(p.joining_form_documents)) {
    for (const item of p.joining_form_documents) {
      if (typeof item === "string" && item.trim()) liveUploadList.push(item.trim());
    }
  }
  merged.fileUrls = mergeFileUrlMaps(merged.fileUrls, fileUrlsFromUploadedFilesArray(liveUploadList));

  if (isEmptyScalar(submissionInitial.is_experienced) && p.is_experienced != null) {
    merged.is_experienced = p.is_experienced;
  }

  return merged;
}
