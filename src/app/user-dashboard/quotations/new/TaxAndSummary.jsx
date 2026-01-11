// "use client";

// import React from "react";

// // A utility function to convert a number to words in the Indian numeral system
// const convertNumberToWords = (num) => {
//   if (num === null || num === undefined || isNaN(num) || num === 0) {
//     return "Zero Rupees Only.";
//   }

//   const s = num.toFixed(2).split(".");
//   let numToConvert = parseInt(s[0], 10);
//   const decimalPart = s[1];

//   const words = [];
//   const units = [
//     "",
//     "one",
//     "two",
//     "three",
//     "four",
//     "five",
//     "six",
//     "seven",
//     "eight",
//     "nine",
//   ];
//   const teens = [
//     "",
//     "eleven",
//     "twelve",
//     "thirteen",
//     "fourteen",
//     "fifteen",
//     "sixteen",
//     "seventeen",
//     "eighteen",
//     "nineteen",
//   ];
//   const tens = [
//     "",
//     "ten",
//     "twenty",
//     "thirty",
//     "forty",
//     "fifty",
//     "sixty",
//     "seventy",
//     "eighty",
//     "ninety",
//   ];
//   const suffixes = ["", "thousand", "lakh", "crore"];

//   const convertBlock = (n) => {
//     let blockWords = "";
//     const hundreds = Math.floor(n / 100);
//     const remainder = n % 100;

//     if (hundreds > 0) {
//       blockWords += units[hundreds] + " hundred";
//     }

//     if (remainder > 0) {
//       if (hundreds > 0) {
//         blockWords += " and ";
//       }
//       if (remainder < 10) {
//         blockWords += units[remainder];
//       } else if (remainder < 20) {
//         blockWords += teens[remainder - 10];
//       } else {
//         blockWords += tens[Math.floor(remainder / 10)];
//         if (remainder % 10 > 0) {
//           blockWords += "-" + units[remainder % 10];
//         }
//       }
//     }
//     return blockWords;
//   };

//   if (numToConvert === 0) {
//     words.push("zero");
//   } else {
//     // Process the last three digits (hundreds, tens, units)
//     let lastThree = numToConvert % 1000;
//     if (lastThree > 0) {
//       words.unshift(convertBlock(lastThree));
//     }
//     numToConvert = Math.floor(numToConvert / 1000);

//     // Process thousands, lakhs, and crores in blocks of two
//     let suffixIndex = 1;
//     while (numToConvert > 0) {
//       let block = numToConvert % 100;
//       if (block > 0) {
//         const blockWords = convertBlock(block);
//         words.unshift(`${blockWords} ${suffixes[suffixIndex]}`);
//       }
//       numToConvert = Math.floor(numToConvert / 100);
//       suffixIndex++;
//     }
//   }

//   let finalWords = words
//     .filter((word) => word)
//     .join(" ")
//     .replace(/\s+/g, " ")
//     .trim();

//   // Add decimal part if it exists
//   if (parseInt(decimalPart) > 0) {
//     finalWords += ` and ${decimalPart}/100`;
//   }

//   return `${finalWords} Rupees Only.`.replace(/\s+/g, " ").trim();
// };

// export default function TaxAndSummary({
//   subtotal,
//   cgst,
//   sgst,
//   igst,
//   grandTotal,
//   cgstRate,
//   sgstRate,
//   igstRate,
//   setCgstRate,
//   setSgstRate,
//   setIgstRate,
// }) {
//   const isCgstApplicable = cgst > 0;
//   const isSgstApplicable = sgst > 0;
//   const isIgstApplicable = igst > 0;

//   return (
//     <div className="flex flex-col md:flex-row gap-6 mt-6 p-4 border rounded-md bg-gray-50 shadow text-sm">
//       {/* Left side - Tax and Summary Details */}
//       <div className="flex-1 space-y-2">
//         <h4 className="font-semibold text-lg text-gray-800">Tax Summary</h4>
//         <div className="space-y-1">
//           <div className="flex justify-between items-center text-gray-600">
//             <span>Subtotal</span>
//             <span>₹ {subtotal?.toFixed(2)}</span>
//           </div>

//           <div className="flex justify-between items-center text-gray-600">
//             <label className="flex items-center gap-2">
//               CGST
//               <input
//                 type="number"
//                 value={cgstRate}
//                 onChange={(e) => setCgstRate(parseFloat(e.target.value) || 0)}
//                 className="w-12 text-center p-1 border rounded text-xs"
//               />
//               %
//             </label>
//             <span>₹ {isCgstApplicable ? cgst?.toFixed(2) : "0.00"}</span>
//           </div>

//           <div className="flex justify-between items-center text-gray-600">
//             <label className="flex items-center gap-2">
//               SGST
//               <input
//                 type="number"
//                 value={sgstRate}
//                 onChange={(e) => setSgstRate(parseFloat(e.target.value) || 0)}
//                 className="w-12 text-center p-1 border rounded text-xs"
//               />
//               %
//             </label>
//             <span>₹ {isSgstApplicable ? sgst?.toFixed(2) : "0.00"}</span>
//           </div>

//           <div className="flex justify-between items-center text-gray-600">
//             <label className="flex items-center gap-2">
//               IGST
//               <input
//                 type="number"
//                 value={igstRate}
//                 onChange={(e) => setIgstRate(parseFloat(e.target.value) || 0)}
//                 className="w-12 text-center p-1 border rounded text-xs"
//               />
//               %
//             </label>
//             <span>₹ {isIgstApplicable ? igst?.toFixed(2) : "0.00"}</span>
//           </div>
//         </div>
//       </div>

//       {/* Right side - Grand Total and Amount in Words */}
//       <div className="md:w-1/2 lg:w-1/3 flex flex-col justify-end">
//         <div className="border-t border-gray-300 pt-4 mt-4 md:mt-0 md:pt-0">
//           <div className="flex justify-between items-center font-bold text-lg text-emerald-700">
//             <span>Grand Total</span>
//             <span className="text-2xl">₹ {grandTotal?.toFixed(2)}</span>
//           </div>
//           <p className="mt-2 text-sm text-gray-600 italic">
//             Amount in words:
//             <br />
//             <span className="font-semibold capitalize">
//               {grandTotal
//                 ? convertNumberToWords(grandTotal)
//                 : "Zero Rupees Only."}
//             </span>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }

"use client";

import React from "react";

// A utility function to convert a number to words in the Indian numeral system
const convertNumberToWords = (num) => {
  if (num === null || num === undefined || isNaN(num) || num === 0) {
    return "Zero Rupees Only.";
  }

  const s = num.toFixed(2).split(".");
  let numToConvert = parseInt(s[0], 10);
  const decimalPart = s[1];

  const words = [];
  const units = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ];
  const teens = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "ten",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const suffixes = ["", "thousand", "lakh", "crore", "arab", "kharab"];

  const convertBlock = (n) => {
    if (n === 0) return "";
    let blockWords = "";
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;

    if (hundreds > 0) {
      blockWords += units[hundreds] + " hundred";
    }

    if (remainder > 0) {
      if (hundreds > 0) {
        blockWords += " and ";
      }
      if (remainder < 10) {
        blockWords += units[remainder];
      } else if (remainder < 20) {
        blockWords += teens[remainder - 10];
      } else {
        blockWords += tens[Math.floor(remainder / 10)];
        if (remainder % 10 > 0) {
          blockWords += "-" + units[remainder % 10];
        }
      }
    }
    return blockWords;
  };

  if (numToConvert === 0) {
    words.push("zero");
  } else {
    // Process the last three digits (hundreds, tens, units)
    let lastThree = numToConvert % 1000;
    if (lastThree > 0) {
      words.unshift(convertBlock(lastThree));
    }
    numToConvert = Math.floor(numToConvert / 1000);

    // Process thousands, lakhs, and crores in blocks of two
    let suffixIndex = 1;
    while (numToConvert > 0) {
      let block;
      if (suffixIndex === 1) {
        // Thousands are a block of two digits
        block = numToConvert % 100;
        numToConvert = Math.floor(numToConvert / 100);
      } else {
        // Other blocks are also two digits
        block = numToConvert % 100;
        numToConvert = Math.floor(numToConvert / 100);
      }

      if (block > 0) {
        const blockWords = convertBlock(block);
        words.unshift(`${blockWords} ${suffixes[suffixIndex]}`);
      }
      suffixIndex++;
    }
  }

  let finalWords = words
    .filter((word) => word)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // Add decimal part if it exists
  if (parseInt(decimalPart) > 0) {
    finalWords += ` and ${decimalPart}/100`;
  }

  return `${finalWords} Rupees Only.`.replace(/\s+/g, " ").trim();
};

export default function TaxAndSummary({
  subtotal,
  cgst,
  sgst,
  igst,
  grandTotal,
  cgstRate,
  sgstRate,
  igstRate,
  setCgstRate,
  setSgstRate,
  setIgstRate,
  interstate = false,
}) {

  return (
    <div className="flex flex-col md:flex-row gap-6 mt-6 p-4 border rounded-md bg-gray-50 shadow text-sm">
      {/* Left side - Tax and Summary Details */}
      <div className="flex-1 space-y-2">
        <h4 className="font-semibold text-lg text-gray-800">Tax Summary</h4>
        <div className="text-xs text-gray-600">
          Mode: {interstate ? (
            <span className="font-semibold text-indigo-700">Interstate (IGST)</span>
          ) : (
            <span className="font-semibold text-emerald-700">Intrastate (CGST + SGST)</span>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-gray-600">
            <span>Subtotal</span>
            <span>₹ {subtotal?.toFixed(2)}</span>
          </div>

          {!interstate && (
            <>
              <div className="flex justify-between items-center text-gray-600">
                <label className="flex items-center gap-2">
                  CGST
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cgstRate}
                    onChange={(e) => setCgstRate(parseFloat(e.target.value) || 0)}
                    className="w-12 text-center p-1 border rounded text-xs"
                  />
                  %
                </label>
                <span>₹ {cgst?.toFixed(2) || "0.00"}</span>
              </div>

              <div className="flex justify-between items-center text-gray-600">
                <label className="flex items-center gap-2">
                  SGST
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sgstRate}
                    onChange={(e) => setSgstRate(parseFloat(e.target.value) || 0)}
                    className="w-12 text-center p-1 border rounded text-xs"
                  />
                  %
                </label>
                <span>₹ {sgst?.toFixed(2) || "0.00"}</span>
              </div>
            </>
          )}

          {interstate && (
            <div className="flex justify-between items-center text-gray-600">
              <label className="flex items-center gap-2">
                IGST
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={igstRate}
                  onChange={(e) => setIgstRate(parseFloat(e.target.value) || 0)}
                  className="w-12 text-center p-1 border rounded text-xs"
                />
                %
              </label>
              <span>₹ {igst?.toFixed(2) || "0.00"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Grand Total and Amount in Words */}
      <div className="md:w-1/2 lg:w-1/3 flex flex-col justify-end">
        <div className="border-t border-gray-300 pt-4 mt-4 md:mt-0 md:pt-0">
          <div className="flex justify-between items-center font-bold text-lg text-emerald-700">
            <span>Grand Total</span>
            <span className="text-2xl">₹ {grandTotal?.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600 italic">
            Amount in words:
            <br />
            <span className="font-semibold capitalize">
              {grandTotal
                ? convertNumberToWords(grandTotal)
                : "Zero Rupees Only."}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
