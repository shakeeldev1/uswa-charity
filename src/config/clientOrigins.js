// CLIENT_URL is a comma-separated list (local dev + production domains) so
// CORS can allow all of them at once. The first entry doubles as the
// canonical URL used when building links inside emails.
const DEFAULT_ORIGINS = "http://localhost:5173,https://uswaorg.uk,https://www.uswaorg.uk";

export const allowedOrigins = (process.env.CLIENT_URL || DEFAULT_ORIGINS)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const primaryClientUrl = allowedOrigins[0];
