import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeImageUrl(url: string | undefined | null): string {
  if (!url) return "";
  const trimmed = url.trim();

  if (trimmed.includes("drive.google.com") || trimmed.includes("googleusercontent.com")) {
    const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                        trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                        trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w1000`;
    }
  }

  return trimmed;
}
