const AILY_FILE_ID = 'file_[a-zA-Z0-9]+';
const BARE_FILE_TOKEN_RE = new RegExp(`(^|[^/\\w])(${AILY_FILE_ID})\\b`, 'g');
const EXACT_FILE_ID_RE = new RegExp(`^${AILY_FILE_ID}$`);
const DOWNLOAD_FILE_ID_RE = new RegExp(
  `/(${AILY_FILE_ID})/o/image/download(?:\\?|$)`,
);

/** 从裸 file_ 编号或 Aily 下载 URL 里取出 file_id。 */
export function parseAilyFileId(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (EXACT_FILE_ID_RE.test(trimmed)) return trimmed;
  const fromDownload = trimmed.match(DOWNLOAD_FILE_ID_RE);
  if (fromDownload) return fromDownload[1];
  return undefined;
}

/** `{base}/ai/api/v1/aily/namespace/{appId}/{fileId}/o/image/download` */
export function ailyImageDownloadUrl(
  fileId: string,
  appId: string,
  fileBaseUrl: string,
): string {
  const base = fileBaseUrl.replace(/\/$/, '');
  return `${base}/ai/api/v1/aily/namespace/${encodeURIComponent(appId)}/${fileId}/o/image/download`;
}

/**
 * 把 Markdown / HTML 里的裸 `file_xxx` 换成 Aily 图片下载地址。
 * 已经在 `/file_xxx/o/image/download` 路径里的不再替换。
 */
export function rewriteAilyFileTokens(
  text: string,
  appId: string,
  fileBaseUrl: string,
): string {
  if (!text || !appId.trim() || !fileBaseUrl.trim()) return text;
  return text.replace(
    BARE_FILE_TOKEN_RE,
    (_full, prefix: string, id: string) =>
      `${prefix}${ailyImageDownloadUrl(id, appId, fileBaseUrl)}`,
  );
}
