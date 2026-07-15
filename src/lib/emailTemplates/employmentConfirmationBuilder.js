import fs from 'fs';
import path from 'path';

/**
 * Builds employment confirmation email HTML with dynamic data
 * @param {Object} data - Employee data object
 * @param {string} data.employee_name - Employee's full name
 * @param {string} data.employee_id - Employee ID
 * @param {string} data.designation - Job designation
 * @param {string} data.department - Department name
 * @param {string} data.joining_date - Date when employee joined (format: DD-MM-YYYY)
 * @param {string} data.confirmation_date - Date when employment was confirmed (format: DD-MM-YYYY)
 * @param {string} data.confirmation_letter_link - URL to confirmation letter
 * @param {number} [data.current_year] - Current year (defaults to new Date().getFullYear())
 * @returns {string} - HTML string with replaced placeholders
 */
export function buildEmploymentConfirmationEmail(data) {
  try {
    // Get the template file path
    const templatePath = path.join(
      process.cwd(),
      'src/lib/emailTemplates/employmentConfirmation.html'
    );

    // Read template
    let htmlContent = fs.readFileSync(templatePath, 'utf-8');

    // Prepare data with defaults
    const processedData = {
      employee_name: data.employee_name || 'Employee',
      employee_id: data.employee_id || 'N/A',
      designation: data.designation || 'N/A',
      department: data.department || 'N/A',
      joining_date: data.joining_date || 'N/A',
      confirmation_date: data.confirmation_date || 'N/A',
      confirmation_letter_link: data.confirmation_letter_link || '#',
      current_year: data.current_year || new Date().getFullYear(),
    };

    // Replace placeholders
    Object.keys(processedData).forEach((key) => {
      const placeholder = `{{${key}}}`;
      const value = processedData[key];
      htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
    });

    return htmlContent;
  } catch (error) {
    console.error('Error building employment confirmation email:', error);
    throw new Error(`Failed to build employment confirmation email: ${error.message}`);
  }
}

/**
 * Sends employment confirmation email to employee
 * Note: This is a placeholder function. Implement with your email service.
 * @param {string} employeeEmail - Employee's email address
 * @param {Object} employeeData - Employee data object (same as buildEmploymentConfirmationEmail)
 * @returns {Promise<Object>} - Email service response
 */
export async function sendEmploymentConfirmationEmail(employeeEmail, employeeData) {
  try {
    const htmlContent = buildEmploymentConfirmationEmail(employeeData);

    // TODO: Implement with your email service (e.g., nodemailer, SendGrid, AWS SES)
    // Example placeholder:
    // const response = await emailService.send({
    //   to: employeeEmail,
    //   subject: 'Employment Confirmation - DynaClean Industries',
    //   html: htmlContent,
    //   from: 'hr@dynacleanindustries.com',
    // });

    console.log(`Employment confirmation email prepared for: ${employeeEmail}`);
    return {
      success: true,
      message: 'Email prepared successfully',
      email: employeeEmail,
    };
  } catch (error) {
    console.error('Error sending employment confirmation email:', error);
    throw error;
  }
}

export default {
  buildEmploymentConfirmationEmail,
  sendEmploymentConfirmationEmail,
};
