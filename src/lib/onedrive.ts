import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

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
  const driveId = process.env.ONEDRIVE_DRIVE_ID;

  if (!driveId) {
    return {
      fileId: `mock-${Date.now()}`,
      webUrl: `https://mock.sharepoint.com/${encodeURIComponent(fileName)}`,
    };
  }

  const client = await getGraphClient();
  const filePath = buildFilePath({ category, fileName, tradeCode });
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
