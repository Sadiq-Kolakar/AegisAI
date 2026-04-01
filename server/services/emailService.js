/**
 * AegisAI Email Alert Service.
 * Uses Nodemailer to send severity alerts to a configured email address.
 */

const nodemailer = require('nodemailer');

// --- Transporter Configuration ---
// Configured via environment variables (e.g., Gmail with App Password, SendGrid, etc.)
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends a high-severity alert email.
 * @param {string} text - The content of the detected message.
 * @param {string} severity - Severity level (MILD, SEVERE).
 * @param {string} recipientEmail - Optional destination email from extension.
 * @returns {Promise<boolean>}
 */
const sendAlertEmail = async (text, severity, recipientEmail = null) => {
  const destination = recipientEmail || process.env.PARENT_EMAIL;
  
  if (!destination) {
    console.warn("[Email Service] No recipient email configured. Skipping alert.");
    return false;
  }

  const timestamp = new Date().toLocaleString();
  
  const mailOptions = {
    from: `"AegisAI Security Alert" <${process.env.EMAIL_USER}>`,
    to: destination,
    subject: `⚠️ AegisAI Alert: ${severity} MESSAGE DETECTED`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #e74c3c;">AegisAI Security Alert</h2>
        <p>A message with <strong>${severity}</strong> severity has been detected on WhatsApp Web.</p>
        <hr />
        <p><strong>Message Content:</strong></p>
        <blockquote style="background: #f9f9f9; border-left: 5px solid #ccc; margin: 1.5em 10px; padding: 0.5em 10px;">
          ${text}
        </blockquote>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
        <hr />
        <footer style="font-size: 12px; color: #777;">
          Sent by AegisAI Analysis Engine.
        </footer>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Alert email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("[Email Service] Failed to send email:", error.message);
    return false;
  }
};

module.exports = { sendAlertEmail };
