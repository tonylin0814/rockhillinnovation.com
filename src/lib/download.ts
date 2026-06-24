export function buildDownloadUrl(onedriveUrl: string, filename: string): string {
  const params = new URLSearchParams({
    name: filename,
    url: onedriveUrl,
  });

  return `/api/download?${params.toString()}`;
}
