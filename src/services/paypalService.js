import { ApiError } from "../utils/apiError.js";

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

const getAccessToken = async () => {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(502, `PayPal auth failed: ${data.error_description || "unknown error"}`);
  }
  return data.access_token;
};

export const createPaypalOrder = async ({ amount, currency = "USD", campaign }) => {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: `Donation - ${campaign || "General Fund"}`,
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2),
          },
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(502, `PayPal order creation failed: ${data.message || "unknown error"}`);
  }
  return data; // contains id (order id), status, links
};

export const capturePaypalOrder = async (orderId) => {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(502, `PayPal capture failed: ${data.message || "unknown error"}`);
  }
  return data; // contains status (COMPLETED), purchase_units[0].payments.captures[0].id
};
