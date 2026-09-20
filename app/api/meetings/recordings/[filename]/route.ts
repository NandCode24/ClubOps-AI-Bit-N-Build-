import { NextRequest, NextResponse } from "next/server";
import { getLocalRecordingFile } from "../../../../lib/storage";
import { getAuthUser } from "../../../../lib/db";
import fs from "fs";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { filename } = await context.params;
    const fileInfo = getLocalRecordingFile(filename);

    if (!fileInfo) {
      return NextResponse.json({ success: false, message: "Recording file not found" }, { status: 404 });
    }

    const stat = fs.statSync(fileInfo.filePath);
    const range = request.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(fileInfo.filePath, { start, end });

      // Convert Node ReadStream to Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        },
      });

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": fileInfo.mimeType,
        },
      });
    }

    const fileStream = fs.createReadStream(fileInfo.filePath);
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Length": stat.size.toString(),
        "Content-Type": fileInfo.mimeType,
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("Error streaming recording:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error streaming audio" },
      { status: 500 }
    );
  }
}
