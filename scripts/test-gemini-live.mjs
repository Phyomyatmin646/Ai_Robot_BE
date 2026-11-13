
import "dotenv/config";

import { GoogleGenAI, Modality } from "@google/genai";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.8-live";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from .env");
}

// Convert raw PCM audio into a valid WAV file.
function createWav(pcmBuffer) {
  if (pcmBuffer.length === 0 || pcmBuffer.length % 2 !== 0) {
    throw new Error("Invalid PCM audio data.");
  }

  const header = Buffer.alloc(44);

  const bytesPerSample = BITS_PER_SAMPLE / 8;
  const blockAlign = CHANNELS * bytesPerSample;
  const byteRate = SAMPLE_RATE * blockAlign;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function main() {
  const ai = new GoogleGenAI({
    apiKey: API_KEY,
    apiVersion: "v1beta",
  });

  const audioChunks = [];
  let session;
  let timeoutId;

  let resolveTurn;
  let rejectTurn;

  const turnPromise = new Promise((resolve, reject) => {
    resolveTurn = resolve;
    rejectTurn = reject;
  });

  try {
    console.log("Connecting to Gemini Live...");

    session = await ai.live.connect({
      model: MODEL,

      config: {
        responseModalities: [Modality.AUDIO],

        systemInstruction:
          "You are a friendly Myanmar-speaking voice assistant. Speak clearly and naturally. Keep your response short.",
      },

      callbacks: {
        onopen: () => {
          console.log("WebSocket connected!");
        },

        onmessage: (message) => {
          const parts =
            message.serverContent?.modelTurn?.parts ?? [];

          for (const part of parts) {
            if (part.text) {
              console.log("[TEXT]", part.text);
            }

            if (part.inlineData?.data) {
              const pcmChunk = Buffer.from(
                part.inlineData.data,
                "base64"
              );

              audioChunks.push(pcmChunk);

              console.log(
                `[AUDIO] Received ${pcmChunk.length} bytes`
              );

              console.log(
                "Mime type:",
                part.inlineData.mimeType
              );
            }
          }

          if (message.serverContent?.interrupted) {
            console.warn("Response was interrupted.");
          }

          if (message.serverContent?.turnComplete) {
            console.log("Gemini response completed.");
            resolveTurn();
          }
        },

        onerror: (error) => {
          rejectTurn(
            error?.error ??
            new Error(error?.message ?? "WebSocket error")
          );
        },

        onclose: (event) => {
          console.log("[CLOSED]", event?.reason ?? "");
        },
      },
    });

    console.log("Sending text prompt...");

    session.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [
            {
              text: "",
            },
          ],
        },
      ],
      turnComplete: true,
    });

    timeoutId = setTimeout(() => {
      rejectTurn(new Error("Gemini response timeout (30 seconds)."));
    }, 30000);

    await turnPromise;

    clearTimeout(timeoutId);
    timeoutId = undefined;

    if (audioChunks.length === 0) {
      throw new Error("No audio chunks received from Gemini.");
    }

    // Combine all received PCM chunks.
    const combinedPCM = Buffer.concat(audioChunks);

    console.log("\n=== AUDIO SUMMARY ===");
    console.log("Chunks:", audioChunks.length);
    console.log("Total PCM bytes:", combinedPCM.length);
    console.log("Sample rate:", SAMPLE_RATE);
    console.log("Channels:", CHANNELS);
    console.log("Bit depth:", BITS_PER_SAMPLE);

    // Convert PCM to WAV.
    const wavBuffer = createWav(combinedPCM);

    const outputDir = path.join(process.cwd(), "artifacts");

    await mkdir(outputDir, { recursive: true });

    const outputPath = path.join(
      outputDir,
      "gemini-live-response.wav"
    );

    await writeFile(outputPath, wavBuffer);

    const duration =
      combinedPCM.length /
      (SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8));

    console.log("\nSUCCESS!");
    console.log("WAV file:", outputPath);
    console.log("Audio duration:", duration.toFixed(2), "seconds");
    console.log("File size:", wavBuffer.length, "bytes");

  } catch (error) {
    console.error("\nAUDIO TEST FAILED:");
    console.error(error.message);
    process.exitCode = 1;

  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    session?.close();
  }
}

main();

