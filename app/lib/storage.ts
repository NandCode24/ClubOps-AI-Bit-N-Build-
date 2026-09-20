import fs from "fs";
import path from "path";

export interface StoredFileResult {
  url: string;
  storageType: "local" | "cloud";
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Storage Abstraction for Meeting Audio Recordings
 * Saves recording to local server private storage with streaming endpoint
 */
export async function saveMeetingRecording(
  audioBuffer: Buffer,
  fileName: string,
  mimeType: string = "audio/webm"
): Promise<StoredFileResult> {
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const uploadDir = path.join(process.cwd(), "private_uploads", "recordings");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, safeName);
  fs.writeFileSync(filePath, audioBuffer);

  return {
    url: `/api/meetings/recordings/${safeName}`,
    storageType: "local",
    storagePath: filePath,
    fileName: safeName,
    mimeType,
    sizeBytes: audioBuffer.length,
  };
}

/**
 * Retrieve local recording audio stream
 */
export function getLocalRecordingFile(fileName: string): { filePath: string; mimeType: string } | null {
  const safeName = path.basename(fileName);
  const filePath = path.join(process.cwd(), "private_uploads", "recordings", safeName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const ext = safeName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    webm: "audio/webm",
    opus: "audio/opus",
    wav: "audio/wav",
    mp3: "audio/mp3",
    m4a: "audio/m4a",
    ogg: "audio/ogg",
  };

  return {
    filePath,
    mimeType: (ext && mimeMap[ext]) || "audio/webm",
  };
}
