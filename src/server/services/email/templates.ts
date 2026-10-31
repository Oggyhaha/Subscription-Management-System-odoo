export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function baseEmailHtml(title: string, bodyContent: string, actionButton?: { text: string; url: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; line-height: 1.5; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; color: #ffffff; padding: 24px 32px; font-weight: 600; font-size: 18px; letter-spacing: -0.01em; }
    .content { padding: 32px; font-size: 15px; color: #334155; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px; margin: 20px 0; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Brightloop Software</div>
    <div class="content">
      <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">${title}</h2>
      ${bodyContent}
      ${
        actionButton
          ? `<div><a href="${actionButton.url}" class="button" target="_blank">${actionButton.text}</a></div>`
          : ""
      }
      <p style="font-size: 13px; color: #64748b; margin-top: 24px;">If you did not request this email or need assistance, contact our billing team at support@brightloop.com.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Brightloop Software, Inc. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

// 1. Password Reset
export function passwordResetTemplate(resetUrl: string, name: string): EmailContent {
  const subject = "Reset your Brightloop Software password";
  const body = `
    <p>Hello ${name},</p>
    <p>We received a request to reset your password. Click the button below to set a new password for your Brightloop account. This link expires in 1 hour.</p>
  `;
  const text = `Hello ${name},\n\nWe received a request to reset your password. Use the following link to reset your password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;

  return {
    subject,
    html: baseEmailHtml("Password Reset Request", body, { text: "Reset Password", url: resetUrl }),
    text,
  };
}

// 2. Account Invitation
export function accountInvitationTemplate(
  inviteUrl: string,
  name: string,
  role: string,
  tempPassword?: string
): EmailContent {
  const subject = `You've been invited to Brightloop Software (${role})`;
  const body = `
    <p>Hello ${name},</p>
    <p>An administrator has invited you to join Brightloop Software as a <strong>${role}</strong> team member.</p>
    ${
      tempPassword
        ? `<p>Your temporary password is: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></p>`
        : ""
    }
    <p>Please click below to sign in and set up your permanent credentials.</p>
  `;
  const text = `Hello ${name},\n\nYou have been invited to join Brightloop Software as ${role}.\n${
    tempPassword ? `Your temporary password: ${tempPassword}\n\n` : ""
  }Log in here:\n${inviteUrl}`;

  return {
    subject,
    html: baseEmailHtml("Welcome to Brightloop", body, { text: "Accept Invitation & Log In", url: inviteUrl }),
    text,
  };
}

// 3. Quotation Delivery
export function quotationDeliveryTemplate(
  quoteNumber: string,
  totalAmount: string,
  viewUrl: string,
  customerName: string
): EmailContent {
  const subject = `Brightloop Quotation #${quoteNumber} for ${customerName}`;
  const body = `
    <p>Dear ${customerName},</p>
    <p>Thank you for choosing Brightloop Software. Your custom subscription quotation <strong>#${quoteNumber}</strong> is ready for review.</p>
    <p style="font-size: 18px; font-weight: 600; color: #0f172a;">Total Quote Value: ${totalAmount}</p>
    <p>You can review line items, terms, and confirm your subscription online by clicking below:</p>
  `;
  const text = `Dear ${customerName},\n\nYour quotation #${quoteNumber} is ready for review.\nTotal: ${totalAmount}\n\nReview quote online:\n${viewUrl}`;

  return {
    subject,
    html: baseEmailHtml(`Quotation #${quoteNumber}`, body, { text: "Review Quotation", url: viewUrl }),
    text,
  };
}

// 4. Invoice Delivery
export function invoiceDeliveryTemplate(
  invoiceNumber: string,
  amountDue: string,
  dueDate: string,
  viewUrl: string,
  customerName: string
): EmailContent {
  const subject = `Invoice #${invoiceNumber} from Brightloop Software - ${amountDue} due ${dueDate}`;
  const body = `
    <p>Dear ${customerName},</p>
    <p>Your subscription invoice <strong>#${invoiceNumber}</strong> has been generated.</p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <div><strong>Invoice Number:</strong> ${invoiceNumber}</div>
      <div><strong>Amount Due:</strong> ${amountDue}</div>
      <div><strong>Payment Due Date:</strong> ${dueDate}</div>
    </div>
    <p>Please review and complete your payment online:</p>
  `;
  const text = `Dear ${customerName},\n\nInvoice #${invoiceNumber} is due on ${dueDate}.\nAmount Due: ${amountDue}\n\nView and pay your invoice:\n${viewUrl}`;

  return {
    subject,
    html: baseEmailHtml(`Invoice #${invoiceNumber}`, body, { text: "View & Pay Invoice", url: viewUrl }),
    text,
  };
}

// 5. Payment Confirmation
export function paymentConfirmationTemplate(
  paymentNumber: string,
  invoiceNumber: string,
  amountPaid: string,
  paymentDate: string,
  customerName: string
): EmailContent {
  const subject = `Payment Received for Invoice #${invoiceNumber} - Thank You!`;
  const body = `
    <p>Dear ${customerName},</p>
    <p>We have successfully recorded your payment of <strong>${amountPaid}</strong> for invoice <strong>#${invoiceNumber}</strong> on ${paymentDate}.</p>
    <p><strong>Payment Reference:</strong> ${paymentNumber}</p>
    <p>Your subscription remains in active standing. Thank you for your business!</p>
  `;
  const text = `Dear ${customerName},\n\nPayment confirmed: ${amountPaid} received for invoice #${invoiceNumber} on ${paymentDate}.\nPayment Reference: ${paymentNumber}.\n\nThank you for choosing Brightloop Software!`;

  return {
    subject,
    html: baseEmailHtml("Payment Receipt", body),
    text,
  };
}

// 6. Renewal Reminder
export function renewalReminderTemplate(
  subscriptionNumber: string,
  planName: string,
  renewalDate: string,
  renewalAmount: string,
  customerName: string
): EmailContent {
  const subject = `Upcoming Renewal for Subscription #${subscriptionNumber} (${planName})`;
  const body = `
    <p>Dear ${customerName},</p>
    <p>This is a courtesy reminder that your subscription <strong>#${subscriptionNumber}</strong> (${planName}) is scheduled for automatic renewal on <strong>${renewalDate}</strong>.</p>
    <p><strong>Renewal Amount:</strong> ${renewalAmount}</p>
    <p>No action is required if you wish to continue your service uninterrupted. You can manage your plan at any time through the customer portal.</p>
  `;
  const text = `Dear ${customerName},\n\nYour subscription #${subscriptionNumber} (${planName}) will renew on ${renewalDate} for ${renewalAmount}.\n\nYou can review or manage your subscription in your customer portal.`;

  return {
    subject,
    html: baseEmailHtml("Subscription Renewal Reminder", body),
    text,
  };
}

