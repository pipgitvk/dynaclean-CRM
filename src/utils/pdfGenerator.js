import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PDF_REPORT_STYLES } from '@/utils/pdfReportStyles';
import {
  getPdfLogoUrl,
  getPdfSignatureOrigin,
  signatureSrcForInstallationPdf,
} from '@/utils/pdfCloudinaryAssets';

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
const generateHTMLTemplate = (reportData, productData, assetOptions = {}) => {
  const logoUrl = assetOptions.logoUrl || '/images/logo.png';
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
        <style>${PDF_REPORT_STYLES}</style>
    </head>
    <body>
        <div class="container">
            <div class="company-info">
                <div class="logo">
                    <img src="${logoUrl}" alt="Dynaclean Industries" class="logo" crossorigin="anonymous">
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
                    <td>${productData.contact_person || productData.site_person || ''}</td>
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

const generateInstallationHTMLTemplate = (
  reportData,
  productData,
  installData,
  trainees = [],
  assetOptions = {}
) => {
  const logoUrl = assetOptions.logoUrl || '/images/logo.png';
  const origin = assetOptions.origin || '';
  const instDate = formatDate(
    installData?.installation_date ||
      productData?.installation_date ||
      reportData?.completed_date
  );
  const contactPerson =
    productData?.contact_person || productData?.site_person || "";
  const rate = reportData.service_rate || installData?.service_rating || "";
  const installationComplete =
    String(reportData.status || "").toUpperCase() === "COMPLETED";

  const traineeRows =
    trainees && trainees.length > 0
      ? trainees
          .map(
            (t, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${t.name || ""}</td>
                            <td>${t.designation || ""}</td>
                            <td>${t.contact || ""}</td>
                        </tr>`
          )
          .join("")
      : `<tr><td colspan="4" style="text-align:center">—</td></tr>`;

  const engineerSrc = signatureSrcForInstallationPdf(
    reportData,
    'engineer',
    origin
  );
  const customerSrc = signatureSrcForInstallationPdf(
    reportData,
    'customer',
    origin
  );
  const engineerImg = engineerSrc
    ? `<img src="${engineerSrc}" alt="Engineer Signature" crossorigin="anonymous" style="max-width: 100%; max-height: 100%;">`
    : 'Signature';
  const customerImg = customerSrc
    ? `<img src="${customerSrc}" alt="Customer Signature" crossorigin="anonymous" style="max-width: 100%; max-height: 100%;">`
    : 'Signature';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Installation Report</title>
        <style>${PDF_REPORT_STYLES}</style>
    </head>
    <body>
        <div class="container">
            <div class="company-info">
                <div class="logo">
                    <img src="${logoUrl}" alt="Dynaclean Industries" class="logo" crossorigin="anonymous">
                </div>
                <div class="company-details">
                    <h1>DYNACLEAN INDUSTRIES</h1>
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

            <h2 class="installation-report-title">INSTALLATION REPORT</h2>

            <table>
                <tr>
                    <td><strong>Installation Date:</strong></td>
                    <td>${instDate}</td>
                    <td><strong>Report ID:</strong></td>
                    <td>${reportData.service_id || ""}</td>
                </tr>
                <tr>
                    <td><strong>Customer Name:</strong></td>
                    <td colspan="3">${productData.customer_name || ""}</td>
                </tr>
                <tr>
                    <td><strong>Address:</strong></td>
                    <td colspan="3">${productData.customer_address || ""}</td>
                </tr>
                <tr>
                    <td><strong>Installation Address:</strong></td>
                    <td colspan="3">${productData.installed_address || ""}</td>
                </tr>
                <tr>
                    <td><strong>Invoice Date:</strong></td>
                    <td>${formatDate(productData.invoice_date)}</td>
                    <td><strong>Invoice No:</strong></td>
                    <td>${productData.invoice_number || ""}</td>
                </tr>
                <tr>
                    <td><strong>Serial:</strong></td>
                    <td>${reportData.serial_number || ""}</td>
                    <td><strong>Contact Person:</strong></td>
                    <td>${contactPerson}</td>
                </tr>
                <tr>
                    <td><strong>Product Name:</strong></td>
                    <td>${productData.product_name || ""}</td>
                    <td><strong>Contact Number:</strong></td>
                    <td>${productData.contact || ""}</td>
                </tr>
                <tr>
                    <td><strong>Model:</strong></td>
                    <td>${productData.model || ""}</td>
                    <td><strong>Email:</strong></td>
                    <td>${productData.email || ""}</td>
                </tr>
            </table>

            <div class="service-group">
                <h3><strong>SERVICE RENDERED: INSTALLATION AND DEMONSTRATION</strong></h3>
                <div class="install-status-row">
                    <strong>Status of Installation:</strong>
                    <label><input type="radio" ${installationComplete ? "checked" : ""} disabled> Complete</label>
                    <label><input type="radio" ${!installationComplete ? "checked" : ""} disabled> Incomplete</label>
                </div>
                <div class="form-group">
                    <label>Defects found on inspection (if any):</label>
                    <span>${installData?.defects_on_inspection || ""}</span>
                </div>
                <div class="form-group">
                    <label>Engineer's Remarks:</label>
                    <span>${installData?.engineer_remarks || ""}</span>
                </div>
            </div>

            <div class="service-group">
                <h3><strong>CUSTOMER TRAINING AND DEMONSTRATION RECORD</strong></h3>
                <table>
                    <tr>
                        <th>S. No.</th>
                        <th>NAME OF TRAINEES</th>
                        <th>DESIGNATION</th>
                        <th>CONTACT NO.</th>
                    </tr>
                    ${traineeRows}
                </table>

                <div class="rating-section">
                    <div class="form-group">
                        <label><strong>Please Rate the service:</strong></label>
                    </div>
                    <div class="rating-options">
                        <div class="rating-option">
                            <input type="radio" ${rate === "extremelySatisfied" ? "checked" : ""} disabled>
                            <span>Extremely satisfied</span>
                        </div>
                        <div class="rating-option">
                            <input type="radio" ${rate === "satisfied" ? "checked" : ""} disabled>
                            <span>Satisfied</span>
                        </div>
                        <div class="rating-option">
                            <input type="radio" ${rate === "dissatisfied" ? "checked" : ""} disabled>
                            <span>Dissatisfied</span>
                        </div>
                        <div class="rating-option">
                            <input type="radio" ${rate === "annoyed" ? "checked" : ""} disabled>
                            <span>Annoyed</span>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label><strong>Customer Feedback:</strong></label>
                    <span>${reportData.feedback || installData?.customer_feedback || ""}</span>
                </div>

                <div class="signature-section">
                    <div class="signature-group">
                        <div><strong>Authorized Person Signature:</strong></div>
                        <div class="signature-box">${engineerImg}</div>
                        <div class="signature-details">
                            <div><strong>Name:</strong> ${reportData.authorised_person_name || ""}</div>
                            <div><strong>Designation:</strong> ${reportData.authorised_person_designation || ""}</div>
                            <div><strong>Contact Number:</strong> ${reportData.authorised_person_mobile || ""}</div>
                        </div>
                    </div>
                    <div class="signature-group">
                        <div><strong>Customer Signature:</strong></div>
                        <div class="signature-box">${customerImg}</div>
                        <div class="signature-details">
                            <div><strong>Name:</strong> ${reportData.customer_name || ""}</div>
                            <div><strong>Designation:</strong> ${reportData.customer_designation || ""}</div>
                            <div><strong>Contact Number:</strong> ${reportData.customer_mobile || ""}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

export const generateServiceReportPDF = async (
  reportData,
  productData,
  installData = null,
  trainees = [],
  options = {}
) => {
  try {
    const origin = getPdfSignatureOrigin(
      typeof window !== 'undefined' ? window.location.origin : ''
    );
    const logoUrl = getPdfLogoUrl();
    const assetOptions = { logoUrl, origin };

    const useInstallation = options.isInstallationLayout === true;
    const htmlContent = useInstallation
      ? generateInstallationHTMLTemplate(
          reportData,
          productData,
          installData,
          trainees,
          assetOptions
        )
      : generateHTMLTemplate(reportData, productData, assetOptions);

    // Create a temporary container element
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = htmlContent;
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '800px';
    document.body.appendChild(tempContainer);

    const canvas = await html2canvas(tempContainer, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794
    });

    // Remove temporary container
    document.body.removeChild(tempContainer);

    // JPEG at 85% quality — significantly smaller than PNG
    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calculate scaling to fit on single page
    const imgWidth = pageWidth - 20; // 10mm margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const maxHeight = pageHeight - 20;
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;

    if (imgHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = (canvas.width * finalHeight) / canvas.height;
    }

    const xOffset = (pageWidth - finalWidth) / 2;
    const yOffset = 10;

    pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight);


    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const downloadPDF = (pdf, filename) => {
  pdf.save(filename || 'service-report.pdf');
};  