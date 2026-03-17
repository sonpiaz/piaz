import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { log } from "../types.js";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: config.r2.endpoint(),
      credentials: {
        accessKeyId: config.r2.accessKeyId(),
        secretAccessKey: config.r2.secretAccessKey(),
      },
    });
  }
  return _client;
}

function bucket() {
  return config.r2.bucket();
}

// Retry with exponential backoff (3 attempts)
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [500, 1500, 4000];
  for (let i = 0; i < delays.length; i++) {
    try {
      return await fn();
    } catch (e) {
      log("warn", `R2 ${label} attempt ${i + 1} failed`, {
        error: (e as Error).message,
      });
      if (i === delays.length - 1) throw e;
      await new Promise((r) => setTimeout(r, delays[i]));
    }
  }
  throw new Error("unreachable");
}

export async function readR2(path: string): Promise<string | null> {
  try {
    const resp = await withRetry(
      () =>
        getClient().send(
          new GetObjectCommand({ Bucket: bucket(), Key: path }),
        ),
      `GET ${path}`,
    );
    return (await resp.Body?.transformToString("utf-8")) ?? null;
  } catch (e: unknown) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}

export async function writeR2(path: string, content: string): Promise<void> {
  try {
    await withRetry(
      () =>
        getClient().send(
          new PutObjectCommand({
            Bucket: bucket(),
            Key: path,
            Body: content,
            ContentType: "application/jsonl",
          }),
        ),
      `PUT ${path}`,
    );
  } catch (e) {
    // All 3 retries failed — fall back to local buffer
    log("error", "R2 write failed after retries, buffering locally", {
      path,
      error: (e as Error).message,
    });
    const { bufferWrite } = await import("./local-buffer.js");
    await bufferWrite(path, content);
  }
}
