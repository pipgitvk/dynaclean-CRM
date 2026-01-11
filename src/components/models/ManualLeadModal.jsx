import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useUser } from "../../context/UserContext";

export default function ManualLeadModal({ show, onClose }) {
  const [rawText, setRawText] = useState("");
  const [analyzed, setAnalyzed] = useState(null);
  const [leadSources, setLeadSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [leadCampaign, setLeadCampaign] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const { user } = useUser();

  useEffect(() => {
    if (show) {
      fetch("/api/lead-sources")
        .then((res) => res.json())
        .then((data) => setLeadSources(data))
        .catch(console.error);
    }
  }, [show]);

  const analyzeLead = () => {
    const lines = rawText
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let name = lines[0] || "";
    let address = [];
    let email = "";
    let phone = "";
    let product = "";

    // Iterate through all lines starting from the second one (assuming the first is the name)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // HIGH-PRIORITY PHONE CHECK: If the line contains "+91-", get the 10 digits after it.
      if (line.includes("+91-") && phone === "") {
        const match = line.match(/\+91-\s*(\d{10})/);
        if (match && match[1]) {
          phone = match[1];
        }
        // Use continue to prevent this line from being parsed as anything else
        continue;
      }

      // Check for email
      if (line.includes("@") && email === "") {
        email = line;
        continue;
      }

      // Skip "Member Since" line
      if (line.toLowerCase().includes("member since")) {
        continue;
      }

      // Fallback phone check (for numbers without +91-)
      if (/^\d{10}$/.test(line.replace(/[^\d]/g, "")) && phone === "") {
        phone = line.replace(/[^\d]/g, "").slice(-10);
        continue;
      }

      // Heuristic for product: The last non-empty line
      // This is a simple assumption, a more complex regex could be used
      const isProductCandidate =
        i > 3 &&
        !line.includes("+") &&
        !line.includes("@") &&
        !line.match(/\d{10}/);
      if (isProductCandidate) {
        product = line;
      }

      // If it's not any of the above, it's likely an address line
      if (email === "" && phone === "") {
        // Only push to address if email/phone haven't been found yet.
        address.push(line);
      }
    }

    setAnalyzed({
      name,
      address: address.join(" ").trim(),
      email,
      phone,
      product,
    });
  };

  const resetForm = () => {
    setRawText("");
    setAnalyzed(null);
    setSelectedSource("");
    setLeadCampaign("");
    setFollowupNotes("");
  };

  const submitLead = async () => {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const fields = {
      first_name: analyzed.name,
      last_name: "",
      email: analyzed.email,
      phone: analyzed.phone,
      address: analyzed.address,
      company: analyzed.company,
      lead_source: selectedSource,
      lead_campaign: leadCampaign,
      status: "New",
      followup_notes: followupNotes,
      communication_history: "",
      products_interest: analyzed.product,
      sales_representative: selectedSource,
      assigned_to: user?.username || "",
      tags: "",
      notes: followupNotes,
      next_follow_date: now,
      date_created: now,
      visiting_card: "",
      communication_mode: "Phone",
    };

    const res = await fetch("/api/lead-distribute-Indiamart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    const data = await res.json();
    if (res.ok) {
      toast.success("Lead submitted successfully!");
      resetForm();
      onClose();
    } else {
      toast.error("Error: " + data.error);
    }
  };

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white p-4 sm:p-6 rounded shadow-lg w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg sm:text-xl font-semibold">Manually Assign Lead</h2>

        {!analyzed ? (
          <>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste lead text here..."
              className="w-full h-32 sm:h-40 p-2 border rounded text-sm sm:text-base"
            />
            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 mt-4">
              <button onClick={onClose} className="text-gray-600 underline text-sm sm:text-base order-2 sm:order-1">
                Cancel
              </button>
              <button
                onClick={analyzeLead}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm sm:text-base order-1 sm:order-2"
              >
                Analyze
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="block text-sm sm:text-base">
                Name:{" "}
                <input
                  value={analyzed.name}
                  onChange={(e) =>
                    setAnalyzed({ ...analyzed, name: e.target.value })
                  }
                  className="border p-1 w-full rounded text-sm sm:text-base"
                />
              </label>
              <label className="block text-sm sm:text-base">
                Address:{" "}
                <input
                  value={analyzed.address}
                  onChange={(e) =>
                    setAnalyzed({ ...analyzed, address: e.target.value })
                  }
                  className="border p-1 w-full rounded text-sm sm:text-base"
                />
              </label>
              <label className="block text-sm sm:text-base">
                Email:{" "}
                <input
                  value={analyzed.email}
                  onChange={(e) =>
                    setAnalyzed({ ...analyzed, email: e.target.value })
                  }
                  className="border p-1 w-full rounded text-sm sm:text-base"
                />
              </label>
              <label className="block text-sm sm:text-base">
                Company:{" "}
                <input
                  value={analyzed.company}
                  onChange={(e) =>
                    setAnalyzed({ ...analyzed, company: e.target.value })
                  }
                  className="border p-1 w-full rounded text-sm sm:text-base"
                />
              </label>
              <label className="block text-sm sm:text-base">
                Phone:{" "}
                <input
                  value={analyzed.phone}
                  onChange={(e) =>
                    setAnalyzed({ ...analyzed, phone: e.target.value })
                  }
                  className="border p-1 w-full rounded text-sm sm:text-base"
                />
              </label>
              <label className="block text-sm sm:text-base">
                Product:{" "}
                <input
                  value={analyzed.product}
                  onChange={(e) =>
                    setAnalyzed({ ...analyzed, product: e.target.value })
                  }
                  className="border p-1 w-full rounded text-sm sm:text-base"
                />
              </label>
              <label className="block text-sm sm:text-base">
                Lead Campaign:
                <select
                  value={leadCampaign}
                  onChange={(e) => setLeadCampaign(e.target.value)}
                  className="w-full border p-1 rounded text-sm sm:text-base"
                >
                  <option value="">Select campaign</option>
                  <option value="india_mart">India Mart</option>
                  <option value="social_media">Social Media</option>
                  <option value="google_ads">Google Ads</option>
                  <option value="visit">Visit</option>
                  <option value="website_visit">Website Visit</option>
                  <option value="reference">Reference</option>
                </select>
              </label>
              <label className="block text-sm sm:text-base">
                Follow-up Notes:
                <textarea
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  placeholder="Enter follow-up notes"
                  className="w-full h-16 sm:h-20 p-2 border rounded text-sm sm:text-base"
                />
              </label>
              <label className="block text-sm sm:text-base">
                Assign To:
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full border p-1 rounded text-sm sm:text-base"
                >
                  <option value="">Select source</option>
                  {leadSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm text-gray-600">
                Assigned By (you): {user?.username || "-"}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 mt-4">
              <button onClick={onClose} className="text-gray-600 underline text-sm sm:text-base order-2 sm:order-1">
                Cancel
              </button>
              <button
                onClick={submitLead}
                disabled={!selectedSource || !leadCampaign}
                className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
              >
                Send to {selectedSource || "..."}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
