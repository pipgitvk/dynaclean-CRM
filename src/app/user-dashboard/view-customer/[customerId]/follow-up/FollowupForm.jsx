  
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function FollowupForm({ customerId, userRole = "" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromUpcoming = searchParams.get("source") === "upcoming";
  const isServiceSupport = userRole === "SERVICE SUPPORT";
  const isGEM = userRole === "GEM";
  const isRestrictedRole = isServiceSupport || isGEM;
  const [formData, setFormData] = useState({
    followed_date: "",
    next_followup_date: "",
    service_next_followup: "",
    gem_next_followup: "",
    notes: "",
    communication_mode: "",
    status: "",
    multi_tag: [],
    stage: "New"
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerCurrentStage, setCustomerCurrentStage] = useState("New");
  const [lastFollowedDate, setLastFollowedDate] = useState(null);
  const [customerCreatedAt, setCustomerCreatedAt] = useState(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
  const [hasOrder, setHasOrder] = useState(false);
  const [notesLanguage, setNotesLanguage] = useState("en");

  // Languages supported by Google Input Tools (GOOGLE_ITC map in transliterate API)
  const notesLanguageOptions = [
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

  const notesTextareaRef = useRef(null);
  const notesFetchTimerRef = useRef(null);
  const XLIT_API = "/api/transliterate/tl/";

  const fetchTransliteration = async (phrase, lang) => {
    if (!phrase || !lang || lang === "en") return [];
    try {
      const res = await fetch(
        `${XLIT_API}${lang}/${encodeURIComponent(phrase.trim()).replace(".", "%2E")}`
      );
      const data = await res.json();
      return data?.result?.length ? data.result : [];
    } catch {
      return [];
    }
  };

  const transliterateFullText = async (text, lang) => {
    if (!text || lang === "en") return text;

    const regex = /[a-zA-Z]+(?:\s+[a-zA-Z]+)*/g;
    let result = text;
    const matches = [...text.matchAll(regex)];

    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const suggestions = await fetchTransliteration(match[0], lang);
      if (suggestions[0]) {
        result =
          result.slice(0, match.index) +
          suggestions[0] +
          result.slice(match.index + match[0].length);
      }
    }

    return result;
  };

  const [notesSuggestions, setNotesSuggestions] = useState([]);
  const [notesSuggestionIndex, setNotesSuggestionIndex] = useState(0);
  const [notesPhraseRange, setNotesPhraseRange] = useState({ start: -1, end: -1 });
  const [isNotesTransliterating, setIsNotesTransliterating] = useState(false);

  const getRomanPhraseBeforeCursor = (text, cursorPos) => {
    const textBefore = text.slice(0, cursorPos);
    const lastBreak = Math.max(
      textBefore.lastIndexOf(" "),
      textBefore.lastIndexOf("\n"),
      -1
    );
    const phraseStart = lastBreak + 1;
    const phrase = textBefore.slice(phraseStart);
    if (!phrase || !/^[a-zA-Z\s]+$/.test(phrase)) return null;
    return { phrase, start: phraseStart, end: cursorPos };
  };

  const loadNotesSuggestions = (text, cursorPos, lang) => {
    if (lang === "en") {
      setNotesSuggestions([]);
      return;
    }

    clearTimeout(notesFetchTimerRef.current);
    notesFetchTimerRef.current = setTimeout(async () => {
      const info = getRomanPhraseBeforeCursor(text, cursorPos);
      if (!info?.phrase.trim()) {
        setNotesSuggestions([]);
        setNotesPhraseRange({ start: -1, end: -1 });
        return;
      }

      const suggestions = await fetchTransliteration(info.phrase, lang);
      if (suggestions.length) {
        setNotesPhraseRange({ start: info.start, end: info.end });
        setNotesSuggestions(suggestions);
        setNotesSuggestionIndex(0);
      } else {
        setNotesSuggestions([]);
        setNotesPhraseRange({ start: -1, end: -1 });
      }
    }, 120);
  };

  const applyNotesSuggestion = (suffixChar = " ", index = notesSuggestionIndex) => {
    const replacement = notesSuggestions[index] ?? notesSuggestions[0];
    if (!replacement || notesPhraseRange.start < 0) return;

    const fullText = notesTextareaRef.current?.value ?? formData.notes;
    const { start, end } = notesPhraseRange;
    const newText =
      fullText.slice(0, start) +
      replacement +
      suffixChar +
      fullText.slice(end);

    setFormData((prev) => ({ ...prev, notes: newText }));
    setNotesCursor(start + replacement.length + suffixChar.length);
    setNotesSuggestions([]);
    setNotesPhraseRange({ start: -1, end: -1 });
  };

  const handleNotesLanguageChange = async (e) => {
    const newLang = e.target.value;
    const currentNotes = formData.notes;
    setNotesLanguage(newLang);
    setNotesSuggestions([]);

    if (!currentNotes.trim() || newLang === "en") return;

    setIsNotesTransliterating(true);
    try {
      const converted = await transliterateFullText(currentNotes, newLang);
      setFormData((prev) => ({ ...prev, notes: converted }));
    } finally {
      setIsNotesTransliterating(false);
    }
  };

  const handleNotesChange = (e) => {
    handleChange(e);
    const { value, selectionStart } = e.target;
    loadNotesSuggestions(value, selectionStart ?? value.length, notesLanguage);
  };

  const handleNotesKeyDown = (e) => {
    if (notesLanguage === "en") return;

    if (notesSuggestions.length > 0) {
      if (e.key === " " || e.key === "Tab") {
        e.preventDefault();
        applyNotesSuggestion(" ");
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        applyNotesSuggestion("\n");
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setNotesSuggestionIndex(
          (prev) => (prev + 1) % notesSuggestions.length
        );
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setNotesSuggestionIndex(
          (prev) => (prev - 1 + notesSuggestions.length) % notesSuggestions.length
        );
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setNotesSuggestions([]);
        return;
      }
    }
  };

  const [notesCursor, setNotesCursor] = useState(null);

  useEffect(() => {
    if (notesCursor !== null && notesTextareaRef.current) {
      notesTextareaRef.current.selectionStart = notesCursor;
      notesTextareaRef.current.selectionEnd = notesCursor;
      setNotesCursor(null);
    }
  }, [formData.notes, notesCursor]);

  const statusList = ["Very Good", "Average", "Poor", "Denied", "Invalid"];
  const tagOptions = ["Visiting factory", "Service Issue", "Payment Follow-Up", "Trucks Follow-Up", "Cancel Order", "Order received", "Prime", "Repeat Order", "Running Order", "Strong Follow-Up", "N/A"];
  const stageOptions = [
    "New",
    "Contacted",
    "Interested",
    "Demo Scheduled",
    "Demo Completed",
    "Qualified",
    "Quotation Sent",
    "Quotation Revised",
    "Negotiation / Follow-up",
    "Decision Pending",
    "Won (Order Received)",
    "Lost",
    "Disqualified / Invalid Lead"
  ];

  // ✅ Format datetime for <input type="datetime-local"> in IST (Asia/Kolkata)
  const formatISTDateTime = (date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  // ✅ Get min and max datetime for last 24 hours (in IST)
  const getFollowedDateLimits = () => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      min: formatISTDateTime(twentyFourHoursAgo),
      max: formatISTDateTime(now),
    };
  };

  const followedDateLimits = getFollowedDateLimits();

  // Calculate min/max for Next Follow-up Date based on lead age (from customer creation date) and stage
  // If source=upcoming → always 15 days (bypass 7-day restriction)
  // If stage is "Won (Order Received)" → max 15 days from now
  // If customer has an order → max 15 days from now (skip validation)
  // < 7 days old  → max 48 hours from now
  // >= 7 days old → max 15 days from now
  const nextFollowupDateLimits = useMemo(() => {
    const now = new Date();
    const minDate = formatISTDateTime(now);

    // If navigated from Upcoming Enquiry section, always allow 15 days
    if (isFromUpcoming) {
      return {
        min: minDate,
        max: formatISTDateTime(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)),
        isNewLead: false,
      };
    }

    // If customer already has an order, allow 15 days
    if (hasOrder) {
      return {
        min: minDate,
        max: formatISTDateTime(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)),
        isNewLead: false,
      };
    }

    // If stage is "Won (Order Received)", allow 15 days
    if (formData.stage === "Won (Order Received)") {
      return {
        min: minDate,
        max: formatISTDateTime(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)),
        isNewLead: false,
      };
    }

    if (customerCreatedAt) {
      const createdDate = new Date(customerCreatedAt);
      const leadAgeInDays = (now - createdDate) / (1000 * 60 * 60 * 24);

      if (leadAgeInDays < 7) {
        // Fresh lead: restrict to 48 hours max
        return {
          min: minDate,
          max: formatISTDateTime(new Date(now.getTime() + 48 * 60 * 60 * 1000)),
          isNewLead: true,
        };
      } else {
        // Old lead: allow up to 15 days
        return {
          min: minDate,
          max: formatISTDateTime(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)),
          isNewLead: false,
        };
      }
    }

    // Still loading — strict 48 hour fallback
    return {
      min: minDate,
      max: formatISTDateTime(new Date(now.getTime() + 48 * 60 * 60 * 1000)),
      isNewLead: true,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCreatedAt, hasOrder, isFromUpcoming, formData.stage]);

  // Fetch customer's current stage, status, comm_mode from database
  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        const [stageResponse, followupResponse] = await Promise.all([
          fetch(`/api/customers/${customerId}`),
          fetch(`/api/followup/${customerId}`)
        ]);

        let latestCommMode = "";

        // Fetch last comm_mode and followed_date from followup history
        if (followupResponse.ok) {
          const followupData = await followupResponse.json();
          if (followupData.history && followupData.history.length > 0) {
            const lastFollowup = followupData.history[0];
            if (lastFollowup.followed_date) {
              setLastFollowedDate(lastFollowup.followed_date);
            }
            if (lastFollowup.comm_mode) {
              latestCommMode = lastFollowup.comm_mode;
            }
          }
        }

        if (stageResponse.ok) {
          const stageData = await stageResponse.json();
          const dbStage = stageData.stage || "New";
          const dbStatus = stageData.status || "";

          setCustomerCurrentStage(dbStage);
          setCustomerCreatedAt(stageData.date_created || null);
          setHasOrder(stageData.has_order === 1 || stageData.has_order === true);

          // Set all fields from DB in one atomic update
          setFormData(prev => ({
            ...prev,
            stage: dbStage,
          }));
        }
      } catch (error) {
        console.error("Error fetching customer data:", error);
        setCustomerCurrentStage("New");
      } finally {
        setIsLoadingCustomer(false);
      }
    };

    if (customerId) {
      fetchCustomerData();
    }
  }, [customerId]);

  // Re-calculate limits when customerCreatedAt changes (triggers re-render automatically via state)

  useEffect(() => {
    const now = new Date();
    setFormData((prevData) => ({
      ...prevData,
      followed_date: formatISTDateTime(now),
      next_followup_date: formatISTDateTime(now),
      service_next_followup: formatISTDateTime(now),
      gem_next_followup: formatISTDateTime(now),
    }));
  }, []);

  // Filter stages based on customer's current stage from database
  const getAvailableStages = (currentStage) => {
    // Use formData.stage as fallback if customerCurrentStage hasn't updated yet
    const effectiveStage = currentStage || formData.stage || "New";

    const stageOrder = stageOptions;
    const currentIndex = stageOrder.indexOf(effectiveStage);

    // For final stages, only allow staying in the same stage
    if (effectiveStage === "Won (Order Received)" || effectiveStage === "Lost" || effectiveStage === "Disqualified / Invalid Lead") {
      return [effectiveStage];
    }

    // If stage not found in list, return all options
    if (currentIndex === -1) return stageOptions;

    // Show current stage and all stages after it (progressive flow)
    return stageOrder.slice(currentIndex);
  };

  // Recompute whenever customerCurrentStage OR formData.stage changes
  const availableStages = getAvailableStages(customerCurrentStage);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "next_followup_date" && value) {
      const maxDate = nextFollowupDateLimits.max ? new Date(nextFollowupDateLimits.max) : null;

      // Only block future dates beyond max
      if (maxDate && new Date(value) > maxDate) {
        if (nextFollowupDateLimits.isNewLead) {
          toast.error("This lead is less than 7 days old — you can only schedule a follow-up within the next 48 hours.");
        } else {
          toast.error("You can schedule a follow-up for a maximum of 15 days from now.");
        }
        setFormData({ ...formData, [name]: nextFollowupDateLimits.max });
        return;
      }
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleTagChange = (tag) => {
    setFormData(prev => {
      let newTags = [...prev.multi_tag];

      if (tag === "N/A") {
        // If N/A is selected, clear all other tags and set only N/A
        newTags = newTags.includes("N/A") ? [] : ["N/A"];
      } else {
        // If any other tag is selected
        if (newTags.includes("N/A")) {
          // Remove N/A if it exists
          newTags = newTags.filter(t => t !== "N/A");
        }

        if (newTags.includes(tag)) {
          // Remove tag if already selected
          newTags = newTags.filter(t => t !== tag);
        } else {
          // Add tag
          newTags.push(tag);
        }
      }

      return { ...prev, multi_tag: newTags };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Final validation for next_followup_date before submitting
    if (formData.status !== "Denied" && formData.status !== "Invalid" && formData.next_followup_date) {
      const selected = new Date(formData.next_followup_date);
      const maxDate = nextFollowupDateLimits.max ? new Date(nextFollowupDateLimits.max) : null;

      if (maxDate && selected > maxDate) {
        if (nextFollowupDateLimits.isNewLead) {
          toast.error("This lead is less than 7 days old — you can only schedule a follow-up within the next 48 hours.");
        } else {
          toast.error("You can schedule a follow-up for a maximum of 15 days from now.");
        }
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // ✅ Send datetime-local values directly (no UTC conversion)
      const payload = {
        ...formData,
        multi_tag: formData.multi_tag.join(", "),
        notes_language: notesLanguage,
      };

      // SERVICE SUPPORT को next_followup_date की जरूरत नहीं, सिर्फ service_next_followup भेजेंगे
      if (isServiceSupport) {
        delete payload.next_followup_date;
        delete payload.status;
        delete payload.stage;
        delete payload.multi_tag;
        delete payload.gem_next_followup;
      }

      // GEM को next_followup_date की जरूरत नहीं, सिर्फ gem_next_followup भेजेंगे
      if (isGEM) {
        delete payload.next_followup_date;
        delete payload.status;
        delete payload.stage;
        delete payload.multi_tag;
        delete payload.service_next_followup;
      }

      // Normal Sales / other roles - service_next_followup aur gem_next_followup nahi bhejna
      if (!isServiceSupport && !isGEM) {
        delete payload.service_next_followup;
        delete payload.gem_next_followup;
      }

      const res = await fetch(`/api/followup/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push(`/user-dashboard/view-customer/${customerId}`);
      } else {
        toast.error("Something went wrong.");
      }
    } catch (error) {
      toast.error("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-gray-700">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Followed Date (IST) <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          name="followed_date"
          value={formData.followed_date}
          onChange={handleChange}
          min={followedDateLimits.min}
          max={followedDateLimits.max}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          You can only select dates from the last 24 hours
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Language:</label>
            <select
              value={notesLanguage}
              onChange={handleNotesLanguageChange}
              disabled={isNotesTransliterating}
              className="text-sm px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-60"
            >
              {notesLanguageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="relative">
          <textarea
            ref={notesTextareaRef}
            name="notes"
            rows={4}
            value={formData.notes}
            onChange={handleNotesChange}
            onKeyDown={handleNotesKeyDown}
            onClick={(e) =>
              loadNotesSuggestions(
                e.target.value,
                e.target.selectionStart ?? e.target.value.length,
                notesLanguage
              )
            }
            disabled={isNotesTransliterating}
            className="w-full px-4 py-2 border rounded-lg disabled:opacity-60"
            required
          />
          {notesSuggestions.length > 0 && notesLanguage !== "en" && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-lg text-sm">
              {notesSuggestions.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  onMouseEnter={() => setNotesSuggestionIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyNotesSuggestion(" ", index);
                  }}
                  className={`cursor-pointer rounded px-2 py-1 ${
                    index === notesSuggestionIndex
                      ? "bg-sky-500 text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
          {notesLanguage !== "en" && (
            <p className="mt-1 text-xs text-gray-500">
              Type in English letters, use ↑↓ to pick suggestions, Space to confirm
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Communication Mode
        </label>
        <select
          name="communication_mode"
          value={formData.communication_mode}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg"
          required
        >
          <option value="" disabled>
            Select
          </option>
          <option value="Call">Call</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Visit">Visit</option>
          <option value="Email">Email</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          disabled={isRestrictedRole}
          className={`w-full px-4 py-2 border rounded-lg ${isRestrictedRole ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
          required
        >
          <option value="" disabled>
            {isRestrictedRole ? "Not allowed" : "Select Status"}
          </option>
          {statusList.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Stage Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Stage <span className="text-red-500">*</span>
        </label>
        <select
          name="stage"
          value={formData.stage}
          onChange={handleChange}
          disabled={isLoadingCustomer || isRestrictedRole}
          className={`w-full px-4 py-2 border rounded-lg ${(isLoadingCustomer || isRestrictedRole) ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
          required
        >
          <option value="">{isLoadingCustomer ? "Loading..." : isRestrictedRole ? "Not allowed" : "Select Stage"}</option>
          {availableStages.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        {!isLoadingCustomer && !isRestrictedRole && (
          <p className="mt-1 text-xs text-gray-500">
            Current stage: <strong>{customerCurrentStage}</strong>. Only forward progression allowed.
          </p>
        )}
      </div>

      {/* Multi-Tag Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags (Multiple Selection)
          {isRestrictedRole && <span className="text-red-500 ml-1">- Not allowed</span>}
        </label>
        <div className={`flex flex-wrap gap-2 ${isRestrictedRole ? "opacity-50 pointer-events-none" : ""}`}>
          {tagOptions.map((tag) => (
            <label
              key={tag}
              className={`inline-flex items-center px-3 py-2 rounded-md cursor-pointer transition-colors ${
                formData.multi_tag.includes(tag)
                  ? tag === "N/A"
                    ? "bg-gray-500 text-white"
                    : "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={formData.multi_tag.includes(tag)}
                onChange={() => !isRestrictedRole && handleTagChange(tag)}
                disabled={isRestrictedRole}
                className="hidden"
              />
              <span className="text-sm font-medium">{tag}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {formData.multi_tag.includes("N/A")
            ? "N/A is selected (no other tags can be selected)"
            : "Select multiple tags. Selecting N/A will clear all others."}
        </p>
      </div>

      {/* Next Follow-up Date - Hide when status is Denied or Invalid, OR for SERVICE SUPPORT/GEM */}
      {!isRestrictedRole && formData.status !== "Denied" && formData.status !== "Invalid" && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Next Follow-up Date (IST)
          </label>
          <input
            type="datetime-local"
            name="next_followup_date"
            value={formData.next_followup_date}
            onChange={handleChange}
            min={nextFollowupDateLimits.min}
            max={nextFollowupDateLimits.max}
            disabled={isLoadingCustomer}
            className={`w-full px-4 py-2 border rounded-lg ${isLoadingCustomer ? "bg-gray-100 cursor-not-allowed" : ""}`}
            required
          />
          <p className="mt-1 text-xs text-red-500">
            {isLoadingCustomer
              ? "Loading lead information..."
              : isFromUpcoming
              ? "Upcoming lead — you can schedule a follow-up for a maximum of 15 days from now."
              : formData.stage === "Won (Order Received)"
              ? "Stage is Won (Order Received) — you can schedule a follow-up for a maximum of 15 days from now."
              : hasOrder
              ? "Order exists for this customer — you can schedule a follow-up for a maximum of 15 days from now."
              : nextFollowupDateLimits.isNewLead
              ? "This lead is less than 7 days old — you can only schedule a follow-up within the next 48 hours."
              : "This lead is older than 7 days — you can schedule a follow-up for a maximum of 15 days from now."}
          </p>
        </div>
      )}

      {/* Service Next Follow-up Date - Only for SERVICE SUPPORT */}
      {isServiceSupport && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Service Next Follow-up Date (IST)
          </label>
          <input
            type="datetime-local"
            name="service_next_followup"
            value={formData.service_next_followup}
            onChange={handleChange}
            min={nextFollowupDateLimits.min}
            max={nextFollowupDateLimits.max}
            disabled={isLoadingCustomer}
            className={`w-full px-4 py-2 border rounded-lg ${isLoadingCustomer ? "bg-gray-100 cursor-not-allowed" : ""}`}
          />
          <p className="mt-1 text-xs text-blue-600">
            {isLoadingCustomer
              ? "Loading lead information..."
              : "Schedule your next service follow-up (maximum 15 days from now)."}
          </p>
        </div>
      )}

      {/* GEM Next Follow-up Date - Only for GEM */}
      {isGEM && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            GEM Next Follow-up Date (IST)
          </label>
          <input
            type="datetime-local"
            name="gem_next_followup"
            value={formData.gem_next_followup}
            onChange={handleChange}
            min={nextFollowupDateLimits.min}
            max={nextFollowupDateLimits.max}
            disabled={isLoadingCustomer}
            className={`w-full px-4 py-2 border rounded-lg ${isLoadingCustomer ? "bg-gray-100 cursor-not-allowed" : ""}`}
          />
          <p className="mt-1 text-xs text-purple-600">
            {isLoadingCustomer
              ? "Loading lead information..."
              : "Schedule your next GEM follow-up (maximum 15 days from now)."}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-2 rounded-lg text-white ${
          isSubmitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-gray-600 hover:bg-gray-700"
        }`}
      >
        {isSubmitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
