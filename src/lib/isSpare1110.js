export function isSpare1110(itemCode, spareNumber) {
  return (
    String(itemCode ?? "").trim() === "1110" ||
    String(spareNumber ?? "").trim() === "1110"
  );
}
