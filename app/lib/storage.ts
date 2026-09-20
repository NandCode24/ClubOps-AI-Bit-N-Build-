import fs from "fs";
import path from "path";
import { getAdminApp } from "./firebase-admin";

export interface StoredFileResult {
  url: string;
  storageType: "firebase" | "local";
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Storage Abstraction for Meeting Audio Recordings
 * Priority 1: Firebase Admin Storage (if bucket is configured & accessible)
 * Priority 2: Private server filesystem storage with authenticated download stream
 */
export async function saveMeetingRecording(
  audioBuffer: Buffer,
  fileName: string,
  mimeType: string = "audio/webm"
): Promise<StoredFileResult> {
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // Attempt Firebase Admin Storage
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.appspot.com` : null);

  if (bucketName) {
    try {
      const { getStorage } = await import("firebase-admin/storage");
      const app = getAdminApp();
      const storage = getStorage(app);
      const bucket = storage.bucket(bucketName);
      const storagePath = `recordings/meetings/${safeName}`;
      const file = bucket.file(storagePath);

      await file.save(audioBuffer, {
        contentType: mimeType,
        metadata: {
          contentType: mimeType,
          clubOpsUploadedAt: new Date().toISOString(),
        },
      });

      // Try signed URL valid for 30 days
      try {
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });

        return {
          url: signedUrl,
          storageType: "firebase",
          storagePath,
          fileName: safeName,
          mimeType,
          sizeBytes: audioBuffer.length,
        };
      } catch (signErr) {
        // Fallback to public or custom route if signed URL cannot be generated
        console.warn("Could not generate Firebase signed URL, using fallback:", signErr);
      }
    } catch (fbErr) {
      console.warn("Firebase Storage upload failed or unavailable, falling back to local private storage:", fbErr);
    }
  }

  // Fallback: Local Server Private Storage
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
