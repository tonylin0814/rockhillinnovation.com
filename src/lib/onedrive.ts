import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

/**
 * Required Azure AD application permissions for this service principal:
 * - Files.ReadWrite.All  (OneDrive upload/download)
 * - Mail.ReadWrite       (Outlook draft creation via createOutlookDraft)
 *
 * Required env vars:
 * - ONEDRIVE_TENANT_ID, ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET
 * - ONEDRIVE_DRIVE_ID
 * - OUTLOOK_USER_ID   (UPN or object ID of the mailbox, e.g. tony@company.com)
 */

type UploadParams = {
  tradeCode: string;
  category: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function sanitizePathPart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim();
}

function buildFilePath({ category, fileName, tradeCode }: Pick<UploadParams, "category" | "fileName" | "tradeCode">) {
  return `/RockHillInnovation/Trades/${sanitizePathPart(tradeCode)}/${sanitizePathPart(category)}/${sanitizePathPart(
    fileName
  )}`;
}

function buildProductImagePath({ fileName, productCode }: { fileName: string; productCode: string }) {
  return `/RockHillInnovation/Products/${sanitizePathPart(productCode)}/Images/${sanitizePathPart(fileName)}`;
}

export async function getGraphClient() {
  const credential = new ClientSecretCredential(
    requireEnv("ONEDRIVE_TENANT_ID"),
    requireEnv("ONEDRIVE_CLIENT_ID"),
    requireEnv("ONEDRIVE_CLIENT_SECRET")
  );
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.initWithMiddleware({ authProvider });
}

export async function uploadToOneDrive({
  category,
  fileBuffer,
  fileName,
  mimeType,
  tradeCode,
}: UploadParams): Promise<{ fileId: string; webUrl: string }> {
  const driveId = requireEnv("ONEDRIVE_DRIVE_ID");

  const client = await getGraphClient();
  const filePath = buildFilePath({ category, fileName, tradeCode });
  const item = await client
    .api(`/drives/${driveId}/root:${filePath}:/content`)
    .header("Content-Type", mimeType || "application/octet-stream")
    .put(fileBuffer);

  return { fileId: item.id, webUrl: item.webUrl };
}

export async function uploadProductImageToOneDrive({
  fileBuffer,
  fileName,
  mimeType,
  productCode,
}: {
  productCode: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
}): Promise<{ fileId: string; webUrl: string }> {
  const driveId = requireEnv("ONEDRIVE_DRIVE_ID");

  const client = await getGraphClient();
  const filePath = buildProductImagePath({ fileName, productCode });
  const item = await client
    .api(`/drives/${driveId}/root:${filePath}:/content`)
    .header("Content-Type", mimeType || "application/octet-stream")
    .put(fileBuffer);

  return { fileId: item.id, webUrl: item.webUrl };
}

export async function getOneDriveFileUrl(fileId: string): Promise<string | null> {
  const driveId = process.env.ONEDRIVE_DRIVE_ID;

  if (!driveId) {
    return null;
  }

  try {
    const client = await getGraphClient();
    const item = await client.api(`/drives/${driveId}/items/${fileId}`).get();
    return item.webUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Download a file from OneDrive by its web URL (sharing URL).
 * Uses the Graph API /shares endpoint to resolve the file and get a
 * pre-authenticated download URL.
 * Returns null in mock mode (no ONEDRIVE_DRIVE_ID) or on any error.
 */
export async function downloadFromOneDrive(webUrl: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const driveId = process.env.ONEDRIVE_DRIVE_ID;

  if (!driveId) {
    return null;
  }

  try {
    const client = await getGraphClient();
    const base64 = Buffer.from(webUrl)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const encodedUrl = `u!${base64}`;
    const item = await client.api(`/shares/${encodedUrl}/driveItem`).get();
    const downloadUrl: string | undefined = item["@microsoft.graph.downloadUrl"];

    if (!downloadUrl) {
      return null;
    }

    const response = await fetch(downloadUrl);

    if (!response.ok) {
      return null;
    }

    const mimeType = response.headers.get("Content-Type") ?? "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();

    return { buffer: Buffer.from(arrayBuffer), mimeType };
  } catch {
    return null;
  }
}

export async function createOutlookDraft(params: {
  to: Array<{ name: string; email: string }>;
  bcc?: Array<{ name: string; email: string }>;
  subject: string;
  bodyHtml: string;
  attachmentBuffer?: Buffer;
  attachmentFileName?: string;
}): Promise<{ webLink: string } | { error: string }> {
  const userId = process.env.OUTLOOK_USER_ID;

  if (!userId) {
    return { error: "OUTLOOK_USER_ID is not configured" };
  }

  try {
    const client = await getGraphClient();

    const message: Record<string, unknown> = {
      bccRecipients: (params.bcc ?? []).map((contact) => ({
        emailAddress: { address: contact.email, name: contact.name },
      })),
      body: {
        content: params.bodyHtml,
        contentType: "HTML",
      },
      subject: params.subject,
      toRecipients: params.to.map((contact) => ({
        emailAddress: { address: contact.email, name: contact.name },
      })),
    };

    if (params.attachmentBuffer && params.attachmentFileName) {
      message.attachments = [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          contentBytes: params.attachmentBuffer.toString("base64"),
          contentType: "application/pdf",
          name: params.attachmentFileName,
        },
      ];
    }

    const draft = await client.api(`/users/${userId}/messages`).post(message);
    return { webLink: draft.webLink };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create Outlook draft",
    };
  }
}
