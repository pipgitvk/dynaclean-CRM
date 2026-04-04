import { isExplicitlyFresherSubmission } from "@/lib/profileExperiencedUi";

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

  const fileUrls = {};
  let uploadedFiles = [];
  try {
    uploadedFiles = submission.uploaded_files ? JSON.parse(submission.uploaded_files) : [];
  } catch {
    uploadedFiles = [];
  }
  if (Array.isArray(uploadedFiles)) {
    uploadedFiles.forEach((url) => {
      const filename = url.split("/").pop();
      const match = filename.match(/^(.*)_\d+(?:\.[^.]+)?$/);
      if (match) {
        fileUrls[match[1]] = url;
      }
    });
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
      documents_submitted = rawDocs;
    }
  }

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

  merged.documents_submitted = mergedDocs;

  const subJoin = submissionInitial.joining_form_documents;
  const pJoin = p.joining_form_documents;
  if ((!Array.isArray(subJoin) || subJoin.length === 0) && Array.isArray(pJoin) && pJoin.length > 0) {
    merged.joining_form_documents = pJoin;
  }

  merged.fileUrls = { ...(submissionInitial.fileUrls || {}) };
  if (Array.isArray(p.joining_form_documents)) {
    p.joining_form_documents.forEach((url) => {
      if (typeof url !== "string" || !url) return;
      try {
        const filename = url.split("/").pop();
        const decoded = decodeURIComponent(filename);
        const match = decoded.match(/^(.*)_\d+(?:\.[^.]+)?$/);
        if (match?.[1] && !merged.fileUrls[match[1]]) {
          merged.fileUrls[match[1]] = url;
        }
      } catch {
        /* ignore */
      }
    });
  }

  if (isEmptyScalar(submissionInitial.is_experienced) && p.is_experienced != null) {
    merged.is_experienced = p.is_experienced;
  }

  return merged;
}
