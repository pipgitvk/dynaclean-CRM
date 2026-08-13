import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Function to extract text from PDF using a simple approach
async function extractTextFromPDF(filePath) {
  // Mock data based on DynaClean products - In production, you'd use pdf-parse library
  // For consistent testing, we'll return the same state based on file content
  
  // Sample DynaClean products for realistic demo
  const dynacleanProducts = [
    { name: "Vacuum Cleaner DSC-30", rate: 25000, qty: 1 },
    { name: "Vacuum Cleaner Dyna-40", rate: 35000, qty: 1 },
    { name: "Cleaning Solution 5L", rate: 500, qty: 5 },
    { name: "HEPA Filter Set", rate: 2000, qty: 2 },
    { name: "Carpet Cleaning Machine", rate: 45000, qty: 1 },
    { name: "Industrial Vacuum Pump", rate: 15000, qty: 1 }
  ];
  
  // Select 3 products for demo (fixed count)
  const selectedProducts = dynacleanProducts.slice(0, 3);
  
  let itemsText = "";
  let totalTax = 0;
  let totalAmount = 0;
  
  selectedProducts.forEach((product, index) => {
    const baseAmount = product.rate * product.qty;
    const taxAmount = Math.round(baseAmount * 0.18); // 18% GST
    const finalAmount = baseAmount + taxAmount;
    
    totalTax += taxAmount;
    totalAmount += finalAmount;
    
    itemsText += `${index + 1}. ${product.name} - Qty: ${product.qty} - Rate: ${product.rate} - Tax: 18% - Tax Amount: ${taxAmount} - Amount: ${finalAmount}\n      `;
  });
  
  // Fixed state for consistent testing - simulate Tamil Nadu
  return `
    Invoice No: DC-INV-${Math.floor(Math.random() * 1000)}
    Date: ${new Date().toLocaleDateString('en-GB')}
    Vendor: DynaClean Suppliers Pvt Ltd
    Phone: 9876543210
    State: Tamil Nadu
    
    Items:
    ${itemsText}
    
    Total Tax: ${totalTax}
    Total Amount: ${totalAmount}
  `;
}

// Function to extract text from image using OCR (mock implementation)
async function extractTextFromImage(filePath) {
  // Mock realistic data for image uploads - consistent state
  const products = [
    "Vacuum Cleaner Parts",
    "Motor Assembly", 
    "Cleaning Brushes Set",
    "Dust Collection Bags",
    "Electrical Components"
  ];
  
  const randomProduct = products[Math.floor(Math.random() * products.length)];
  const randomQty = Math.floor(Math.random() * 10) + 1;
  const randomRate = (Math.floor(Math.random() * 50) + 10) * 100; // 1000-5000 range
  const baseAmount = randomRate * randomQty;
  const taxAmount = Math.round(baseAmount * 0.18);
  const finalAmount = baseAmount + taxAmount;
  
  // Fixed state for image uploads - simulate Karnataka
  return `
    INVOICE
    Invoice No: IMG-${Math.floor(Math.random() * 1000)}
    Date: ${new Date().toLocaleDateString('en-GB')}
    Vendor: Parts Suppliers Co
    Phone: 9876543211
    State: Karnataka
    
    Item: ${randomProduct}
    Quantity: ${randomQty}
    Rate: ${randomRate}
    GST: 18%
    Tax Amount: ${taxAmount}
    Total: ${finalAmount}
  `;
}

// Function to parse extracted text and extract structured data
function parseInvoiceText(text) {
  const invoiceData = {
    invoiceNo: "",
    vendor: "",
    phone: "",
    date: "",
    state: "",
    items: [],
    totalAmount: "",
    totalTax: ""
  };

  try {
    // Extract invoice number
    const invoiceMatch = text.match(/invoice\s*no[:\s]*([^\n\r]+)/i);
    if (invoiceMatch) {
      invoiceData.invoiceNo = invoiceMatch[1].trim();
    }

    // Extract vendor/supplier name
    const vendorMatch = text.match(/vendor[:\s]*([^\n\r]+)|supplier[:\s]*([^\n\r]+)/i);
    if (vendorMatch) {
      invoiceData.vendor = (vendorMatch[1] || vendorMatch[2] || "").trim();
    }

    // Extract phone number
    const phoneMatch = text.match(/phone[:\s]*([0-9\s\-\+\(\)]{10,15})/i);
    if (phoneMatch) {
      invoiceData.phone = phoneMatch[1].replace(/\s/g, "").trim();
    }

    // Extract date
    const dateMatch = text.match(/date[:\s]*([0-9\/\-\.]{8,12})/i);
    if (dateMatch) {
      invoiceData.date = dateMatch[1].trim();
    }

    // Extract state information with better pattern matching
    let stateMatch = text.match(/(?:state|billing\s*state|ship\s*to\s*state)[:\s]*([^\n\r,]+)/i);
    if (stateMatch) {
      invoiceData.state = stateMatch[1].trim();
    }

    // Try to match common Indian states in the text (as fallback)
    const indianStates = [
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
      "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
      "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
      "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
      "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
      "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
      "Jammu and Kashmir", "Ladakh"
    ];
    
    if (!invoiceData.state) {
      for (const state of indianStates) {
        const regex = new RegExp(`\\b${state}\\b`, 'i');
        if (regex.test(text)) {
          invoiceData.state = state;
          break;
        }
      }
    }

    // Extract items (improved pattern matching for better product names)
    const itemMatches = text.match(/(\d+\.?\s*[^\n\r]*(?:qty|quantity)[:\s]*\d+[^\n\r]*)/gi);
    if (itemMatches) {
      itemMatches.forEach((itemLine, index) => {
        const qtyMatch = itemLine.match(/(?:qty|quantity)[:\s]*(\d+)/i);
        const rateMatch = itemLine.match(/rate[:\s]*(\d+(?:\.\d+)?)/i);
        const taxMatch = itemLine.match(/tax[:\s]*(\d+)%?/i);
        const taxAmountMatch = itemLine.match(/tax[^:]*amount[:\s]*(\d+(?:\.\d+)?)/i);
        const amountMatch = itemLine.match(/(?:^|\s)amount[:\s]*(\d+(?:\.\d+)?)/i);
        
        // Extract item name (everything before qty/quantity, clean it up)
        let itemName = "";
        const itemNameMatch = itemLine.match(/^\d*\.?\s*([^-]+?)\s*-?\s*(?:qty|quantity)/i);
        if (itemNameMatch) {
          itemName = itemNameMatch[1].trim();
          // Remove common prefixes/suffixes
          itemName = itemName.replace(/^(item|product)\s*/i, '');
          itemName = itemName.replace(/\s*(item|product)$/i, '');
        } else {
          // Fallback: try to get a meaningful name from the line
          const cleanLine = itemLine.replace(/^\d*\.?\s*/, '').replace(/qty.*$/i, '').trim();
          itemName = cleanLine || `Item ${index + 1}`;
        }
        
        const qty = Number(qtyMatch ? qtyMatch[1] : 1);
        const rate = Number(rateMatch ? rateMatch[1] : 0);
        const taxPerc = taxMatch ? Number(taxMatch[1]) : 18;
        
        // Calculate amounts if not provided (no discount)
        const baseAmount = qty * rate;
        let calculatedTaxAmount = 0;
        let calculatedFinalAmount = 0;
        
        if (taxAmountMatch) {
          calculatedTaxAmount = Number(taxAmountMatch[1]);
        } else if (rate > 0) {
          calculatedTaxAmount = Math.round(baseAmount * (taxPerc / 100));
        }
        
        if (amountMatch) {
          calculatedFinalAmount = Number(amountMatch[1]);
        } else if (rate > 0) {
          calculatedFinalAmount = baseAmount + calculatedTaxAmount;
        }
        
        invoiceData.items.push({
          id: index + 1,
          item: itemName,
          qty: String(qty),
          unit: "PCS",
          priceType: "With Tax",
          priceUnit: String(rate),
          taxPerc: `${taxPerc}%`,
          taxAmt: calculatedTaxAmount > 0 ? String(calculatedTaxAmount) : "",
          amount: calculatedFinalAmount > 0 ? String(calculatedFinalAmount) : ""
        });
      });
    }

    // If no items found, try alternative pattern for single item
    if (invoiceData.items.length === 0) {
      const simpleItemMatch = text.match(/item[:\s]*([^\n\r]+)/i);
      const qtyMatch = text.match(/quantity[:\s]*(\d+)/i);
      const rateMatch = text.match(/rate[:\s]*(\d+(?:\.\d+)?)/i);
      const gstMatch = text.match(/gst[:\s]*(\d+)%?/i);
      const taxAmountMatch = text.match(/tax[^:]*amount[:\s]*(\d+(?:\.\d+)?)/i);
      const totalMatch = text.match(/total[:\s]*(\d+(?:\.\d+)?)/i);
      
      if (simpleItemMatch) {
        let itemName = simpleItemMatch[1].trim();
        // Clean up the item name
        itemName = itemName.replace(/^(item|product)\s*/i, '');
        itemName = itemName.replace(/\s*(item|product)$/i, '');
        
        const qty = Number(qtyMatch ? qtyMatch[1] : 1);
        const rate = Number(rateMatch ? rateMatch[1] : 0);
        const taxPerc = gstMatch ? Number(gstMatch[1]) : 18;
        
        // Calculate amounts
        const baseAmount = qty * rate;
        let calculatedTaxAmount = 0;
        let calculatedFinalAmount = 0;
        
        if (taxAmountMatch) {
          calculatedTaxAmount = Number(taxAmountMatch[1]);
        } else if (rate > 0) {
          calculatedTaxAmount = Math.round(baseAmount * (taxPerc / 100));
        }
        
        if (totalMatch) {
          calculatedFinalAmount = Number(totalMatch[1]);
        } else if (rate > 0) {
          calculatedFinalAmount = baseAmount + calculatedTaxAmount;
        }
        
        invoiceData.items.push({
          id: 1,
          item: itemName,
          qty: String(qty),
          unit: "PCS",
          priceType: "With Tax",
          priceUnit: String(rate),
          taxPerc: `${taxPerc}%`,
          taxAmt: calculatedTaxAmount > 0 ? String(calculatedTaxAmount) : "",
          amount: calculatedFinalAmount > 0 ? String(calculatedFinalAmount) : ""
        });
      }
    }

    // Extract totals
    const totalAmountMatch = text.match(/total[^:]*amount[:\s]*(\d+(?:\.\d+)?)/i);
    if (totalAmountMatch) {
      invoiceData.totalAmount = totalAmountMatch[1];
    }

    const totalTaxMatch = text.match(/total[^:]*tax[:\s]*(\d+(?:\.\d+)?)/i);
    if (totalTaxMatch) {
      invoiceData.totalTax = totalTaxMatch[1];
    }

  } catch (error) {
    console.error("Error parsing invoice text:", error);
  }

  return invoiceData;
}

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const formData = await req.formData();
    const file = formData.get("bill");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "bills");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save file
    const fileName = `bill_${Date.now()}_${file.name}`;
    const filePath = path.join(uploadsDir, fileName);
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(filePath, buffer);

    let extractedText = "";
    
    // Extract text based on file type
    if (file.type === "application/pdf") {
      extractedText = await extractTextFromPDF(filePath);
    } else if (file.type.startsWith("image/")) {
      extractedText = await extractTextFromImage(filePath);
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported file type. Please upload PDF, JPG, PNG files only." },
        { status: 400 }
      );
    }

    // Parse the extracted text to get structured data
    const parsedData = parseInvoiceText(extractedText);

    console.log("Extracted Text:", extractedText);
    console.log("Parsed State:", parsedData.state);

    // Clean up uploaded file (optional)
    // fs.unlinkSync(filePath);

    return NextResponse.json({
      success: true,
      data: {
        extractedText,
        parsedData,
        fileName
      }
    });

  } catch (error) {
    console.error("Error processing bill upload:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}