export const numberToWords = (num) => {
  if (typeof num === "string") {
    num = num.replace(/,/g, ""); // remove commas
  }
  num = parseFloat(num); // convert to number
  if (isNaN(num)) return "Invalid number";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertTwoDigit = (n) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  };

  const convertInteger = (num) => {
    if (num === 0) return "Zero";
    if (num > 999999999) return "Overflow";

    const n = ("000000000" + num)
      .substr(-9)
      .match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "Invalid number";

    let str = "";
    str += n[1] != 0 ? convertTwoDigit(Number(n[1])) + " Crore " : "";
    str += n[2] != 0 ? convertTwoDigit(Number(n[2])) + " Lakh " : "";
    str += n[3] != 0 ? convertTwoDigit(Number(n[3])) + " Thousand " : "";
    str += n[4] != 0 ? a[Number(n[4])] + " Hundred " : "";
    str += n[5] != 0 ? (str != "" ? "and " : "") + convertTwoDigit(Number(n[5])) + " " : "";
    return str.trim();
  };

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100); // paise

  let words = convertInteger(integerPart) + " Rupees";
  if (decimalPart > 0) {
    words += " and " + convertInteger(decimalPart) + " Paise";
  }

  return words + " Only";
};
