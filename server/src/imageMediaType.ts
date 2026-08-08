// Shared by the two AI vision routes (photo-log, label-scan) — Claude's
// vision input only accepts these four image types.
export const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export function isSupportedMediaType(mimetype: string): mimetype is SupportedMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(mimetype);
}
