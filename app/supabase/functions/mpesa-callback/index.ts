import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getMetadataValue(items: unknown[], name: string) {
  const match = items.find((item) => {
    return item && typeof item === "object" && "Name" in item && item.Name === name;
  });

  if (!match || typeof match !== "object" || !("Value" in match)) {
    return null;
  }

  return match.Value ?? null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const payload = await request.json();

    const stkCallback =
      payload &&
      typeof payload === "object" &&
      "Body" in payload &&
      payload.Body &&
      typeof payload.Body === "object" &&
      "stkCallback" in payload.Body
        ? payload.Body.stkCallback
        : null;

    const metadataItems =
      stkCallback &&
      typeof stkCallback === "object" &&
      "CallbackMetadata" in stkCallback &&
      stkCallback.CallbackMetadata &&
      typeof stkCallback.CallbackMetadata === "object" &&
      "Item" in stkCallback.CallbackMetadata &&
      Array.isArray(stkCallback.CallbackMetadata.Item)
        ? stkCallback.CallbackMetadata.Item
        : [];

    const parsedCallback = {
      merchantRequestId:
        stkCallback && typeof stkCallback === "object" && "MerchantRequestID" in stkCallback
          ? stkCallback.MerchantRequestID ?? null
          : null,
      checkoutRequestId:
        stkCallback && typeof stkCallback === "object" && "CheckoutRequestID" in stkCallback
          ? stkCallback.CheckoutRequestID ?? null
          : null,
      resultCode:
        stkCallback && typeof stkCallback === "object" && "ResultCode" in stkCallback
          ? stkCallback.ResultCode ?? null
          : null,
      resultDescription:
        stkCallback && typeof stkCallback === "object" && "ResultDesc" in stkCallback
          ? stkCallback.ResultDesc ?? null
          : null,
      receiptNumber: getMetadataValue(metadataItems, "MpesaReceiptNumber"),
      amount: getMetadataValue(metadataItems, "Amount"),
      phoneNumber: getMetadataValue(metadataItems, "PhoneNumber"),
    };

    // Persistence point:
    // Add secure database persistence here once the final write path is available,
    // for example by updating a payments table using a service-role backed client.

    return jsonResponse({
      success: true,
      message: "M-Pesa callback received.",
      data: parsedCallback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid callback payload.";
    return jsonResponse({ error: message }, 400);
  }
});