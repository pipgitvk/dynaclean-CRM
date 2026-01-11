import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const CHECKLIST_ITEMS = [
  "Voltage (V)",
  "Condition of Motor",
  "Check Squeegee blades / Adjust",
  "Amperages (Amps)",
  "Greasing Cleaned / Done",
  "Condition of Handle",
  "Switches Checked",
  "Filters Cleaned / Checked",
  "Condition of Wheels",
  "Condition of Elec Cable",
  "Condition of Belt",
  "Check Oil / TOP UP Done",
  "Fuse Checked",
  "Condition of Coupling / Drive Disk",
  "Check Battery Condition / Electrolyte",
  "Condition of Carbon Brush",
  "Condition of Rubber Brush",
  "Check Brush Condition",
];

// Helper function to format dates
const formatDate = (dateString) => {
  if (!dateString) return '';
  const dateObj = new Date(dateString);
  if (isNaN(dateObj)) return dateString;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
};

// Normalize signature value (handles filename, relative path, absolute URL, or data URL)
const resolveSignatureSrc = (rawValue, dataValue) => {
  // Explicit data URL (or precomputed URL) wins
  if (dataValue) {
    return String(dataValue).trim();
  }

  if (!rawValue) return '';
  const value = String(rawValue).trim();

  // If it's already a full URL or data URL, use as‑is
  if (value.startsWith('data:') || /^https?:\/\//i.test(value)) {
    return value;
  }

  // If it already looks like a path
  if (value.includes('/')) {
    // If it already starts at root (e.g. "/signatures/abc.png"), keep it
    if (value.startsWith('/')) return value;
    // Otherwise prefix with a leading slash
    return `/${value}`;
  }

  // Otherwise treat it as a plain filename in /signatures
  return `/signatures/${value}`;
};

// Generate HTML template for the service report
const generateHTMLTemplate = (reportData, productData) => {
  const checklistArray = reportData.checklist ? reportData.checklist.split(',') : [];

  const engineerSignSrc = resolveSignatureSrc(
    reportData.authorised_person_sign,
    reportData.authorised_person_sign_data
  );
  const customerSignSrc = resolveSignatureSrc(
    reportData.customer_sign,
    reportData.customer_sign_data
  );

  // Parse spare parts data
  let sparePartsData = [];
  if (reportData.replaced_parts && Array.isArray(reportData.replaced_parts)) {
    sparePartsData = reportData.replaced_parts.map((part, index) => ({
      serial: index + 1,
      replaced: part.replaced || '',
      toBeReplaced: part.to_be_replaced || ''
    }));
  } else if (reportData.replaced && reportData.to_be_replaced) {
    const replacedItems = reportData.replaced.split(',').map(item => item.trim()).filter(item => item);
    const toBeReplacedItems = reportData.to_be_replaced.split(',').map(item => item.trim()).filter(item => item);
    const maxItems = Math.max(replacedItems.length, toBeReplacedItems.length);
    sparePartsData = Array.from({ length: maxItems }, (_, index) => ({
      serial: index + 1,
      replaced: replacedItems[index] || '',
      toBeReplaced: toBeReplacedItems[index] || ''
    }));
  } else {
    sparePartsData = [{ serial: 1, replaced: '', toBeReplaced: '' }];
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Service Report</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 10px;
                font-size: 9px;
                line-height: 1.2;
            }
                

            .container {
                max-width: 800px;
                margin: 0 auto;
                border: 1px solid #000;
                padding: 10px;
            }

            .company-info {
                display: flex;
                align-items: flex-start;
                justify-content: left;
                margin-bottom: 10px;
                gap: 15px;
                font-size: 14px;
            }

            .logo {
                max-width: 120px;
                height: auto;
                text-align: left;
                vertical-align: middle;
            }

            .company-details h1 {
                color: #c41e3a;
                margin: 0 0 5px 0;
                font-size: 18px;
            }

            .company-details p {
                margin: 2px 0;
                font-size: 12px;
            }

            .contact-info {
                display: flex;
                align-items: center;
                margin: 1px 0;
            }

            .contact-info p {
                margin: 0;
                font-size: 12px; /* contact lines */
            }

            .contact-info .icon {
                font-size: 10px;
                margin-right: 3px;
            }

            h2 {
                text-align: center;
                margin: 12px 0;
                font-size: 16px;
                color: #000;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8px;
                border: 0.5px solid #666;
            }

            th, td {
                border: 0.5px solid #666;
                line-height: 2.3;
                padding: 3px;
                text-align: left;
                vertical-align: middle;
                font-size: 12px; /* table data font size */
                color: #000;
            }

            .service-group {
                border: 1px solid #000;
                padding: 6px;
                margin: 6px 0;
            }

            .service-group h3 {
                color: #000;
                text-transform: uppercase;
                margin: 0 0 6px 0;
                font-size: 12px;
            }

            .form-group {
                display: flex;
                align-items: center;
                margin: 3px 0;
            }

            .form-group label {
                min-width: 100px;
                font-weight: bold;
                font-size: 12px;
            }
            .form-group span {
                min-width: 100px;
                font-size: 12px;
            }

            .checkbox-group {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 6px;
                margin: 6px 0;
                color: #000;
            }

            .checkbox-item {
                display: flex;
                align-items: center;
                font-size: 12px;
            }

            .checkbox-item input[type="checkbox"] {
                margin-right: 3px;
                transform: scale(0.8);
            }

            .signature-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-top: 10px;
            }

            .signature-group {
                border: 1px solid #000;
                padding: 6px;
                text-align: center;
            }

            .signature-box {
                border: 1px solid #000;
                height: 80px;
                margin: 6px 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: #f9f9f9;
            }

            .signature-details {
                text-align: left;
                font-size: 10px;
            }

            .signature-details div {
                margin: 1px 0;
            }

            .rating-section {
                margin: 6px 0;
            }

            .rating-options {
                display: flex;
                gap: 10px;
                margin: 3px 0;
                flex-wrap: wrap;
            }

            .rating-option {
                display: flex;
                align-items: center;
                font-size: 10px;
            }

            .rating-option input[type="radio"] {
                margin-right: 3px;
                transform: scale(0.8);
            }

            @media print {
                @page {
                    size: A4;
                    margin: 0.5in;
                }
                
                body {
                    font-size: 12px !important;
                }
                
                .container {
                    border: none;
                    padding: 0;
                }
                
                .signature-box {
                    height: 100px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="company-info">
                <div class="logo">
                    <img src="/images/logo.png" alt="Dynaclean Industries" class="logo">
                </div>
                <div class="company-details">
                    <h1>DYNACLEAN INDUSTRIES PRIVATE LIMITED</h1>
                    <p>1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,</p> 
                    <p>Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu, Pin: 641006.</p>
                    <div class="contact-info">
                        <span class="icon">&#9993;</span>
                        <p>service@dynacleanindustries.com, sales@dynacleanindustries.com</p>
                    </div>
                    <div class="contact-info">
                        <span class="icon">&#9990;</span>
                        <p>011-45143666, +91-9205551085, +91-7982456944</p>
                    </div>
                </div>
            </div>

            <h2>SERVICE REPORT</h2>

            <table>
                <tr>
                    <td><strong>Service Date:</strong></td>
                    <td>${formatDate(reportData.complaint_date)}</td>
                    <td><strong>Report ID:</strong></td>
                    <td>${reportData.service_id || ''}</td>
                </tr>
                <tr>
                    <td><strong>Customer Name:</strong></td>
                    <td colspan="3">${productData.customer_name || ''}</td>
                </tr>
                <tr>
                    <td><strong>Address:</strong></td>
                    <td colspan="3">${productData.customer_address || ''}</td>
                </tr>
                <tr>
                    <td><strong>Installation Address:</strong></td>
                    <td colspan="3">${productData.installed_address || ''}</td>
                </tr>
                <tr>
                    <td><strong>Invoice Date:</strong></td>
                    <td>${formatDate(productData.invoice_date)}</td>
                    <td><strong>Invoice No:</strong></td>
                    <td>${productData.invoice_number || ''}</td>
                </tr>
                <tr>
                    <td><strong>Serial:</strong></td>
                    <td>${reportData.serial_number || ''}</td>
                    <td><strong>Contact Person:</strong></td>
                    <td>${productData.contact_person || ''}</td>
                </tr>
                <tr>
                    <td><strong>Product Name:</strong></td>
                    <td>${productData.product_name || ''}</td>
                    <td><strong>Contact Number:</strong></td>
                    <td>${productData.contact || ''}</td>
                </tr>
                <tr>
                    <td><strong>Model:</strong></td>
                    <td>${productData.model || ''}</td>
                    <td><strong>Email:</strong></td>
                    <td>${productData.email || ''}</td>
                </tr>
            </table>

            <div class="service-group">
                <h3><strong>CHECKLIST</strong></h3>
                <div class="checkbox-group">
                    ${CHECKLIST_ITEMS.map(item => `
                        <div class="checkbox-item">
                            <input type="checkbox" ${checklistArray.includes(item) ? 'checked' : ''} disabled>
                            <span>${item}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="service-group">
                <h3><strong>SERVICE RENDERED</strong></h3>
                <div class="form-group">
                    <label>Nature of Complaint:</label>
                    <span>${reportData.nature_of_complaints || ''}</span>
                </div>
                <div class="form-group">
                    <label>Observation:</label>
                    <span>${reportData.observation || ''}</span>
                </div>
                <div class="form-group">
                    <label>Action Taken:</label>
                    <span>${reportData.action_taken || ''}</span>
                </div>
            </div>

            <div class="service-group">
                <h3><strong>SPARE PARTS DETAILS</g strong></h3>
                <table>
                    <tr>
                        <th>S. No.</th>
                        <th>REPLACED</th>
                        <th>TO BE REPLACED</th>
                    </tr>
                    ${sparePartsData.map(part => `
                        <tr>
                            <td>${part.serial}</td>
                            <td>${part.replaced}</td>
                            <td>${part.toBeReplaced}</td>
                        </tr>
                    `).join('')}
                </table>

                <div class="rating-section">
                    <div class="form-group">
                        <label><strong>Please Rate the service:</strong></label>
                    </div>
                    <div class="rating-options">
                        <div class="rating-option">
                            <input type="radio" ${reportData.service_rate === 'extremelySatisfied' ? 'checked' : ''} disabled>
                            <span>Extremely satisfied</span>
                        </div>
                        <div class="rating-option">
                            <input type="radio" ${reportData.service_rate === 'satisfied' ? 'checked' : ''} disabled>
                            <span>Satisfied</span>
                        </div>
                        <div class="rating-option">
                            <input type="radio" ${reportData.service_rate === 'dissatisfied' ? 'checked' : ''} disabled>
                            <span>Dissatisfied</span>
                        </div>
                        <div class="rating-option">
                            <input type="radio" ${reportData.service_rate === 'annoyed' ? 'checked' : ''} disabled>
                            <span>Annoyed</span>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label><strong>Customer Feedback:</strong></label>
                    <span>${reportData.feedback || ''}</span>
                </div>

                <div class="signature-section">
                    <div class="signature-group">
                        <div><strong>Authorized Person Signature:</strong></div>
                        <div class="signature-box">
                            ${engineerSignSrc
      ? `<img src="${engineerSignSrc}" alt="Engineer Signature" style="max-width: 100%; max-height: 100%;">`
      : 'Signature'}
                        </div>
                        <div class="signature-details">
                            <div><strong>Name:</strong> ${reportData.authorised_person_name || ''}</div>
                            <div><strong>Designation:</strong> ${reportData.authorised_person_designation || ''}</div>
                            <div><strong>Contact Number:</strong> ${reportData.authorised_person_mobile || ''}</div>
                        </div>
                    </div>

                    <div class="signature-group">
                        <div><strong>Customer Signature:</strong></div>
                        <div class="signature-box">
                            ${customerSignSrc
      ? `<img src="${customerSignSrc}" alt="Customer Signature" style="max-width: 100%; max-height: 100%;">`
      : 'Signature'}
                        </div>
                        <div class="signature-details">
                            <div><strong>Name:</strong> ${reportData.customer_name || ''}</div>
                            <div><strong>Designation:</strong> ${reportData.customer_designation || ''}</div>
                            <div><strong>Contact Number:</strong> ${reportData.customer_mobile || ''}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

export const generateServiceReportPDF = async (reportData, productData, installData = null, trainees = []) => {
  try {
    // Generate HTML template
    const htmlContent = generateHTMLTemplate(reportData, productData);

    // Create a temporary container element
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = htmlContent;
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '800px';
    document.body.appendChild(tempContainer);

    // Convert HTML to canvas using html2canvas
    // const canvas = await html2canvas(tempContainer, {
    //   scale: 1.5, // Reduced scale to fit single page
    //   useCORS: true,
    //   allowTaint: true,
    //   backgroundColor: '#ffffff',
    //   width: 800,
    //   height: tempContainer.scrollHeight
    // });

    const canvas = await html2canvas(tempContainer, {
      scale: 2,         // higher DPI for sharper text
      useCORS: true,
      allowTaint: true,  // Allow rendering of data URLs
      backgroundColor: '#ffffff',
      width: 794,       // A4 width in px
      windowWidth: 794
    });


    // Remove temporary container
    document.body.removeChild(tempContainer);

    // Create PDF from canvas - SINGLE PAGE
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calculate scaling to fit on single page
    const imgWidth = pageWidth - 20; // 10mm margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // If content is too tall, scale it down to fit on one page
    const maxHeight = pageHeight - 20; // 10mm margin top and bottom
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;

    if (imgHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = (canvas.width * finalHeight) / canvas.height;
    }

    // Center the content on the page
    // const xOffset = (pageWidth - finalWidth) / 2;
    // const yOffset = (pageHeight - finalHeight) / 2;

    // Center horizontally, but stick to top (10mm margin)
    const xOffset = (pageWidth - finalWidth) / 2;
    const yOffset = 10; // start 10mm from top


    // Add image to single page
    // pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

    // Add image to single page, aligned to top
    pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);


    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const downloadPDF = (pdf, filename) => {
  pdf.save(filename || 'service-report.pdf');
};  