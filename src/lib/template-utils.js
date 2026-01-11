import { getDbConnection } from '@/lib/db';
import nodemailer from 'nodemailer';

/**
 * Fetch the active email template for a specific type
 * @param {string} type - Template type: 'INSTALLATION', 'SERVICE_COMPLETION', 'COMPLAINT', 'DISPATCH'
 * @returns {Promise<Object>} Template object with subject_line and html_content
 */
export async function getActiveTemplate(type) {
    try {
        const conn = await getDbConnection();
        const [rows] = await conn.execute(
            `SELECT template_id, template_name, subject_line, html_content 
       FROM email_templates 
       WHERE template_type = ? AND is_active = 1 
       LIMIT 1`,
            [type]
        );

        if (rows.length === 0) {
            throw new Error(`No active template found for type: ${type}`);
        }

        return rows[0];
    } catch (error) {
        console.error('Error fetching active template:', error);
        throw error;
    }
}

/**
 * Replace template variables with actual data
 * @param {string} template - Template string with {{variables}}
 * @param {Object} data - Object containing variable values
 * @returns {string} Processed template with replaced variables
 */
export function replaceVariables(template, data) {
    let processed = template;

    // Replace all variables in the format {{variable_name}}
    Object.keys(data).forEach((key) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        const value = data[key] || 'N/A';
        processed = processed.replace(regex, value);
    });

    // Remove any remaining unreplaced variables
    processed = processed.replace(/{{[^}]+}}/g, 'N/A');

    return processed;
}

/**
 * Send email using template system
 * @param {string} templateType - Type of template to use
 * @param {Object} data - Data to replace in template
 * @param {Object} emailConfig - Email configuration (to, cc, bcc, from)
 * @returns {Promise<Object>} Email send result
 */
export async function sendTemplatedEmail(templateType, data, emailConfig) {
    try {
        // Fetch active template
        const template = await getActiveTemplate(templateType);

        // Replace variables in both subject and body
        const subject = replaceVariables(template.subject_line, data);
        const htmlContent = replaceVariables(template.html_content, data);

        // Create transporter
        const transporter = nodemailer.createTransport({
            host: emailConfig.host || process.env.SMTP_HOST,
            port: Number(emailConfig.port || process.env.SMTP_PORT),
            secure: Number(emailConfig.port || process.env.SMTP_PORT) === 465,
            auth: {
                user: emailConfig.auth?.user || process.env.SMTP_USER,
                pass: emailConfig.auth?.pass || process.env.SMTP_PASS,
            },
        });

        // Prepare email options
        const mailOptions = {
            from: emailConfig.from || `"Dynaclean Industries" <${process.env.SMTP_USER}>`,
            to: emailConfig.to,
            subject: subject,
            html: htmlContent,
        };

        // Add optional fields
        if (emailConfig.cc) mailOptions.cc = emailConfig.cc;
        if (emailConfig.bcc) mailOptions.bcc = emailConfig.bcc;
        if (emailConfig.attachments) mailOptions.attachments = emailConfig.attachments;

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
            templateUsed: template.template_name,
        };
    } catch (error) {
        console.error('❌ Error sending templated email:', error);
        throw error;
    }
}

/**
 * Get all available variables for email templates
 * @returns {Object} Object containing variable categories and descriptions
 */
export function getAvailableVariables() {
    return {
        customer: [
            { name: 'customer_name', description: 'Customer name' },
            { name: 'customer_designation', description: 'Customer designation' },
            { name: 'customer_mobile', description: 'Customer mobile number' },
        ],
        service: [
            { name: 'service_id', description: 'Service request ID' },
            { name: 'service_type', description: 'Type of service' },
            { name: 'status', description: 'Current service status' },
            { name: 'complaint_date', description: 'Complaint/service date' },
            { name: 'complaint_summary', description: 'Complaint description' },
            { name: 'completion_remark', description: 'Service completion remarks' },
            { name: 'completed_date', description: 'Completion date' },
        ],
        product: [
            { name: 'serial_number', description: 'Product serial number' },
            { name: 'product_name', description: 'Product name' },
            { name: 'model', description: 'Product model' },
        ],
        location: [
            { name: 'location', description: 'Service/installation location' },
            { name: 'installation_address', description: 'Installation address' },
            { name: 'installed_address', description: 'Installed address' },
        ],
        site_contact: [
            { name: 'site_person', description: 'Site contact person name' },
            { name: 'site_email', description: 'Site contact email' },
            { name: 'site_contact', description: 'Site contact number' },
        ],
        dispatch: [
            { name: 'order_id', description: 'Order ID' },
            { name: 'quote_number', description: 'Quotation number' },
            { name: 'company_name', description: 'Company name' },
            { name: 'delivery_location', description: 'Delivery address' },
            { name: 'booking_id', description: 'Tracking ID / Booking ID' },
            { name: 'booking_url', description: 'Tracking URL' },
            { name: 'dispatch_person', description: 'Person who dispatched' },
            { name: 'dispatch_date', description: 'Date of dispatch' },
            { name: 'item_details', description: 'Dispatched items details (HTML table)' },
        ],
        other: [
            { name: 'feedback_link', description: 'Auto-generated feedback link' },
            { name: 'current_year', description: 'Current year' },
            { name: 'assigned_to', description: 'Service engineer assigned' },
        ],
        order_approval: [
            { name: 'order_id', description: 'Order ID' },
            { name: 'quote_number', description: 'Quotation number' },
            { name: 'company_name', description: 'Company name' },
            { name: 'client_name', description: 'Client name' },
            { name: 'created_by', description: 'Who created the order' },
            { name: 'status', description: 'Approval status' },
            { name: 'delivery_location', description: 'Delivery location' },
        ]
    };
}
