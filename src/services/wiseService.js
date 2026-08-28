import { ApiError } from "../utils/apiError.js";

const WISE_API_BASE = process.env.WISE_API_BASE || "https://api.wise.com";
const ACCOUNT_DETAILS_CACHE_MS = 10 * 60 * 1000;

let cachedProfileId = null;
let cachedAccountDetails = null;
let cachedAccountDetailsAt = 0;

const wiseFetch = async (path) => {
  const response = await fetch(`${WISE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.WISE_API_KEY}` },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, `Wise request failed: ${data.message || data.error || response.statusText}`);
  }
  return data;
};

const getProfileId = async () => {
  if (cachedProfileId) return cachedProfileId;

  const profiles = await wiseFetch("/v2/profiles");
  const profile = profiles.find((p) => p.type === "BUSINESS") || profiles[0];
  if (!profile) throw new ApiError(502, "No Wise profile is available for this API key");

  cachedProfileId = process.env.WISE_PROFILE_ID || profile.id;
  return cachedProfileId;
};

// Wise's raw response here is a rich "receive money" UI contract (legal
// disclaimers, per-field help text, a pre-formatted share blob) rather than
// flat bank fields, and its top-level `currency` is an object ({code, name}),
// not a plain string. We flatten it into something simple to render:
// { currency, currencyName, title, receiveOptions: [{ type, title, fields, shareText }] }.
export const getReceiveAccountDetails = async () => {
  if (cachedAccountDetails && Date.now() - cachedAccountDetailsAt < ACCOUNT_DETAILS_CACHE_MS) {
    return cachedAccountDetails;
  }

  const profileId = await getProfileId();
  const rawAccounts = await wiseFetch(`/v1/profiles/${profileId}/account-details`);

  const accounts = (Array.isArray(rawAccounts) ? rawAccounts : [])
    .filter((account) => account.status === "ACTIVE" && account.currency?.code)
    .map((account) => ({
      currency: account.currency.code,
      currencyName: account.currency.name,
      title: account.title,
      receiveOptions: (account.receiveOptions || []).map((option) => ({
        type: option.type,
        title: option.title,
        fields: (option.details || [])
          .filter((detail) => !detail.hidden && detail.body)
          .map((detail) => ({ label: detail.title, value: detail.body })),
        shareText: option.shareText,
      })),
    }));

  cachedAccountDetails = accounts;
  cachedAccountDetailsAt = Date.now();
  return accounts;
};

// Looks for a matching incoming (CREDIT) transaction on our Wise balance so a
// donor's self-reported transfer can be auto-confirmed instead of waiting on
// an admin. Requires an exact reference match — without one we can't safely
// tell one donor's transfer apart from another of the same amount/currency.
export const findMatchingWiseTransaction = async ({ currency, amount, reference }) => {
  if (!reference) return null;

  const profileId = await getProfileId();
  const balances = await wiseFetch(`/v4/profiles/${profileId}/balances?types=STANDARD`);
  const balance = (Array.isArray(balances) ? balances : []).find((b) => b.currency === currency);
  if (!balance) return null;

  const intervalEnd = new Date();
  const intervalStart = new Date(intervalEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const statement = await wiseFetch(
    `/v1/profiles/${profileId}/balance-statements/${balance.id}/statement.json` +
      `?currency=${currency}&intervalStart=${intervalStart.toISOString()}&intervalEnd=${intervalEnd.toISOString()}&type=COMPACT`
  );

  const target = Number(amount);
  const referenceLower = String(reference).toLowerCase();

  const match = (statement.transactions || []).find((txn) => {
    if (txn.type !== "CREDIT") return false;

    const txnAmount = Number(txn.amount?.value);
    if (!Number.isFinite(txnAmount) || Math.abs(txnAmount - target) > 0.01) return false;

    const haystack = [txn.referenceNumber, txn.details?.paymentReference, txn.details?.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(referenceLower);
  });

  return match || null;
};

export const generateWiseReference = () => `USWA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
