import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "../../../app/lib/db";
import { getGroqClient } from "../../../app/lib/groq";
import { buildSystemPrompt, fetchLiveUserClubOpsContext } from "../../../app/lib/chatbot-knowledge";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid question." },
        { status: 400 }
      );
    }

    // 1. Get current authenticated user (if any)
    const user = await getAuthUser();

    // 2. Fetch live real-time club, event, and task state from Neon DB
    const liveContext = await fetchLiveUserClubOpsContext(user?.id || null);

    // 3. Assemble system prompt with live DB state + complete website manual
    const systemPrompt = buildSystemPrompt(liveContext);

    // 4. Sanitize and format conversation history for Groq
    const formattedMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Append last 8 turns of conversation for context
    if (Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-8);
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          formattedMessages.push({
            role: msg.role,
            content: String(msg.content || ""),
          });
        }
      }
    }

    // Append current user message
    formattedMessages.push({
      role: "user",
      content: message.trim(),
    });

    // 5. Connect to Groq Cloud LLM
    const client = getGroqClient();
    if (!client) {
      return NextResponse.json(
        {
          success: false,
          message: "Groq AI client is not configured. Please verify GROQ_API_KEY in .env.",
        },
        { status: 500 }
      );
    }

    const models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
    let lastError: Error | null = null;

    for (const model of models) {
      try {
        const stream = await client.chat.completions.create({
          model,
          messages: formattedMessages,
          temperature: 0.2,
          stream: true,
        });

        // Create ReadableStream to send text chunks to client in real-time
        const textEncoder = new TextEncoder();
        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of stream) {
                const text = chunk.choices[0]?.delta?.content || "";
                if (text) {
                  controller.enqueue(textEncoder.encode(text));
                }
              }
              controller.close();
            } catch (streamErr) {
              console.error("Stream reading error:", streamErr);
              controller.error(streamErr);
            }
          },
        });

        return new Response(readableStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Transfer-Encoding": "chunked",
          },
        });
      } catch (err) {
        console.warn(`Groq model ${model} failed, trying fallback model...`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error("Failed to generate response with Groq models.");
  } catch (error) {
    console.error("Error in POST /api/chat:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to process chat request.",
      },
      { status: 500 }
    );
  }
}
