export const SBI_TRAIN_CLASS_OPTIONS = [
  { value: "Sleeper (SL)", label: "Sleeper (SL)" },
  { value: "AC 3 Tier (3A)", label: "AC 3 Tier (3A)" },
  { value: "AC 2 Tier (2A)", label: "AC 2 Tier (2A)" },
  { value: "AC 1 Tier / First AC (1A)", label: "AC 1 Tier / First AC (1A)" },
  { value: "Second Sitting (2S)", label: "Second Sitting (2S)" },
  { value: "Chair Car (CC)", label: "Chair Car (CC)" },
  { value: "General (GN)", label: "General (GN)" },
];

export function isSbiTrainTravelMode(travelMode) {
  const mode = String(travelMode || "").toLowerCase();
  return mode === "train booked by company" || mode === "train booked by self";
}