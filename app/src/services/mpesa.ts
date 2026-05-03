import { supabase } from "@/lib/supabase";
import type { MpesaStkPushInput, MpesaStkPushResult } from "@/types/app";

const FUNCTION_NAME = "mpesa-stk-push";

async function extractFunctionError(error: unknown): Promise<string> {
  if (!error || typeof error !== "object") {
    return "Unknown Supabase Edge Function error.";
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "Unknown Supabase Edge Function error.";

  const context = "context" in error ? error.context : undefined;

  if (context instanceof Response) {
    try {
      const payload = await context.json();

      if (payload && typeof payload === "object") {
        if ("error" in payload && typeof payload.error === "string") {
          return payload.error;
        }

        if ("message" in payload && typeof payload.message === "string") {
          return payload.message;
        }
      }
    } catch {
      if (context.statusText) {
        return `${message} (${context.status} ${context.statusText})`;
      }
    }
  }

  return message;
}

export async function initiateMpesaStkPush(
  input: MpesaStkPushInput,
): Promise<MpesaStkPushResult> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: input,
  });

  if (error) {
    const details = await extractFunctionError(error);
    throw new Error(`Failed to initiate M-Pesa STK push: ${details}`);
  }

  if (!data) {
    throw new Error("Failed to initiate M-Pesa STK push: empty response received.");
  }

  return data as MpesaStkPushResult;
}