import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { MpesaStkPushInput, MpesaStkPushResult } from "../../../src/types/app.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SANDBOX_BASE_URL = "https://sandbox.safaricom.co.ke";
const PRODUCTION_BASE_URL = "https://api.safaricom.co.ke";
const OAUTH_PATH = "/oauth/v1/generate?grant_type=client_credentials";
const STK_PUSH_PATH = "/mpesa/stkpush/v1/processrequest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getRequiredSecret(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getDarajaBaseUrl(mpesaEnv: string) {
  return mpesaEnv.toLowerCase() === "production"
    ? PRODUCTION_BASE_URL
    : SANDBOX_BASE_URL;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function generateTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function toBase64(value: string) {
  return btoa(value);
}

function normalizePhoneNumber(phoneNumber: string) {
  const trimmed = phoneNumber.trim().replace(/\s+/g, "");

  if (trimmed.startsWith("+")) {
    return trimmed.slice(1);
  }

  if (trimmed.startsWith("0")) {
    return `254${trimmed.slice(1)}`;
  }

  if (trimmed.startsWith("7") || trimmed.startsWith("1")) {
    return `254${trimmed}`;
  }

  return trimmed;
}

function getStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getField<T extends Record<string, unknown>>(body: T, ...keys: string[]) {
  for (const key of keys) {
    if (key in body && body[key] !== undefined && body[key] !== null) {
      return body[key];
    }
  }

  return undefined;
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getDarajaAccessToken(baseUrl: string, consumerKey: string, consumerSecret: string) {
  const response = await fetch(`${baseUrl}${OAUTH_PATH}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${toBase64(`${consumerKey}:${consumerSecret}`)}`,
    },
  });

  const responseText = await response.text();
  const payload = responseText ? safeParseJson(responseText) : null;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "errorMessage" in payload
        ? String(payload.errorMessage)
        : responseText || `${response.status} ${response.statusText}`;

    throw new Error(`Failed to get Daraja access token: ${errorMessage}`);
  }

  if (!payload || typeof payload !== "object" || !("access_token" in payload)) {
    throw new Error("Daraja OAuth response did not include an access token.");
  }

  const accessToken = payload.access_token;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Daraja OAuth response returned an invalid access token.");
  }

  return accessToken;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const input = (await request.json()) as MpesaStkPushInput & Record<string, unknown>;

    const rawPhoneNumber = getField(input, "phoneNumber", "phone", "msisdn");
    const rawAmount = getField(input, "amount");
    const rawAccountReference = getField(input, "accountReference", "reference", "account_reference");
    const rawTransactionDesc = getField(
      input,
      "transactionDesc",
      "description",
      "transactionDescription",
    );

    const phoneNumber = normalizePhoneNumber(getStringValue(rawPhoneNumber));
    const amount = Number(rawAmount);
    const accountReference = getStringValue(rawAccountReference);
    const transactionDesc = getStringValue(rawTransactionDesc);

    if (!phoneNumber) {
      return jsonResponse({ error: "A valid phoneNumber is required." }, 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "A valid amount greater than 0 is required." }, 400);
    }

    if (!accountReference) {
      return jsonResponse({ error: "accountReference is required." }, 400);
    }

    if (!transactionDesc) {
      return jsonResponse({ error: "transactionDesc is required." }, 400);
    }

    const mpesaEnv = Deno.env.get("MPESA_ENV")?.trim() || "sandbox";
    const consumerKey = getRequiredSecret("MPESA_CONSUMER_KEY");
    const consumerSecret = getRequiredSecret("MPESA_CONSUMER_SECRET");
    const shortCode = getRequiredSecret("MPESA_SHORTCODE");
    const passKey = getRequiredSecret("MPESA_PASSKEY");
    const callbackUrl = getRequiredSecret("MPESA_CALLBACK_URL");

    const baseUrl = getDarajaBaseUrl(mpesaEnv);
    const accessToken = await getDarajaAccessToken(baseUrl, consumerKey, consumerSecret);
    const timestamp = generateTimestamp();
    const password = toBase64(`${shortCode}${passKey}${timestamp}`);

    const darajaResponse = await fetch(`${baseUrl}${STK_PUSH_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amount),
        PartyA: phoneNumber,
        PartyB: shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc,
      }),
    });

    const responseText = await darajaResponse.text();
    const payload = responseText ? safeParseJson(responseText) : null;

    if (!darajaResponse.ok) {
      const errorMessage =
        payload && typeof payload === "object" && "errorMessage" in payload
          ? String(payload.errorMessage)
          : responseText || `${darajaResponse.status} ${darajaResponse.statusText}`;

      return jsonResponse(
        { error: `Daraja STK push request failed: ${errorMessage}` },
        darajaResponse.status,
      );
    }

    const merchantRequestId =
      payload && typeof payload === "object" && "MerchantRequestID" in payload
        ? String(payload.MerchantRequestID ?? "")
        : "";
    const checkoutRequestId =
      payload && typeof payload === "object" && "CheckoutRequestID" in payload
        ? String(payload.CheckoutRequestID ?? "")
        : "";
    const responseCode =
      payload && typeof payload === "object" && "ResponseCode" in payload
        ? String(payload.ResponseCode ?? "")
        : "";
    const responseDescription =
      payload && typeof payload === "object" && "ResponseDescription" in payload
        ? String(payload.ResponseDescription ?? "")
        : "";
    const customerMessage =
      payload && typeof payload === "object" && "CustomerMessage" in payload
        ? String(payload.CustomerMessage ?? "")
        : "";

    const result = {
      merchantRequestId,
      checkoutRequestId,
      responseCode,
      responseDescription,
      customerMessage,
      MerchantRequestID: merchantRequestId,
      CheckoutRequestID: checkoutRequestId,
      ResponseCode: responseCode,
      ResponseDescription: responseDescription,
      CustomerMessage: customerMessage,
    } as MpesaStkPushResult;

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error initiating STK push.";
    return jsonResponse({ error: message }, 500);
  }
});