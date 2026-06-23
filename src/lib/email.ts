import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "invoices@rockhillinnovation.com";

type InvoiceEmailParams = {
  to: { name: string; email: string }[];
  invoiceNumber: string;
  invoiceType: "pro_forma" | "deposit" | "final";
  invoiceDate: string;
  totalUsd: number;
  clientName: string;
  tradeId: string;
  pdfBuffer?: Buffer;
  pdfFileName?: string;
  pdfWebUrl?: string | null;
};

const TYPE_LABELS: Record<InvoiceEmailParams["invoiceType"], string> = {
  deposit: "Deposit Invoice",
  final: "Final Invoice",
  pro_forma: "Pro-Forma Invoice",
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function buildEmailHtml(params: InvoiceEmailParams): string {
  const typeLabel = TYPE_LABELS[params.invoiceType];
  const linkSection = params.pdfWebUrl
    ? `<p style="margin:16px 0;"><a href="${params.pdfWebUrl}" style="background:#0d1b34;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Download Invoice PDF</a></p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#0d1b34;padding:24px 32px;">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">Rock Hill Innovation Inc.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${typeLabel}</p>
              <p style="margin:0 0 24px;color:#0d1b34;font-size:26px;font-weight:700;font-family:monospace;">${params.invoiceNumber}</p>

              <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:40%;">Client</td>
                  <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0d1b34;font-size:13px;font-weight:600;">${params.clientName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">Invoice Date</td>
                  <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0d1b34;font-size:13px;">${params.invoiceDate}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#64748b;font-size:13px;">Amount</td>
                  <td style="padding:12px 0;color:#0d1b34;font-size:18px;font-weight:700;">${formatUsd(params.totalUsd)}</td>
                </tr>
              </table>

              <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
                Dear ${params.to[0]?.name ?? "Team"},<br><br>
                Please find your ${typeLabel.toLowerCase()} for trade <strong>${params.tradeId}</strong> ${params.pdfBuffer ? "attached to this email" : "available at the link below"}.
                ${params.pdfBuffer ? "" : "Please click the button below to download the invoice PDF."}
              </p>

              ${linkSection}

              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;">
                This email was sent by Rock Hill Innovation Inc.<br>
                Please do not reply directly to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendClientInvoiceEmail(
  params: InvoiceEmailParams
): Promise<{ success: true; messageId: string } | { error: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { error: "RESEND_API_KEY is not configured" };
  }

  const toAddresses = params.to.filter((contact) => contact.email?.trim());

  if (!toAddresses.length) {
    return { error: "No email addresses found for this client" };
  }

  const html = buildEmailHtml(params);

  try {
    const client = new Resend(apiKey);
    const { data, error } = await client.emails.send({
      attachments: params.pdfBuffer
        ? [
            {
              content: params.pdfBuffer,
              filename: params.pdfFileName ?? `${params.invoiceNumber}.pdf`,
            },
          ]
        : [],
      from: FROM_EMAIL,
      html,
      subject: `${TYPE_LABELS[params.invoiceType]}: ${params.invoiceNumber} - Rock Hill Innovation`,
      to: toAddresses.map((contact) => `${contact.name} <${contact.email}>`),
    });

    if (error) {
      return { error: error.message };
    }

    if (!data?.id) {
      return { error: "Email sent but no message ID returned" };
    }

    return { messageId: data.id, success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Email send failed" };
  }
}
