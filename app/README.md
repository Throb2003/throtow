# TOW App

A Vite + React + TypeScript frontend for roadside assistance workflows powered by Supabase.

## Development

1. Copy the example environment file:
   - `cp .env.example .env`
2. Fill in the frontend environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_FUNCTIONS_URL`
   - `VITE_MAP_DEFAULT_LAT`
   - `VITE_MAP_DEFAULT_LNG`
3. Install dependencies:
   - `npm install`
4. Start the app:
   - `npm run dev`

## Daraja via Supabase Edge Functions

This project uses Supabase Edge Functions to keep M-Pesa Daraja credentials off the client.

### Frontend wrapper

The customer payment UI should call:

- `src/services/mpesa.ts`
- export: `initiateMpesaStkPush(input)`

That wrapper invokes the Supabase Edge Function named `mpesa-stk-push` using the current Supabase client session when available.

### Required frontend env vars

Set these in your local `.env` file for Vite:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_FUNCTIONS_URL=
VITE_MAP_DEFAULT_LAT=-1.286389
VITE_MAP_DEFAULT_LNG=36.817223
```

### Required Supabase Edge Function secrets

Set these in Supabase secrets, not in Vite env files:

- `MPESA_ENV` (`sandbox` or `production`)
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`

Example:

```bash
supabase secrets set MPESA_ENV=sandbox MPESA_CONSUMER_KEY=your_key MPESA_CONSUMER_SECRET=your_secret MPESA_SHORTCODE=174379 MPESA_PASSKEY=your_passkey MPESA_CALLBACK_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/mpesa-callback
```

### Deploy the functions

```bash
supabase functions deploy mpesa-stk-push
supabase functions deploy mpesa-callback
```

### Function endpoints

- `supabase/functions/mpesa-stk-push/index.ts`
- `supabase/functions/mpesa-callback/index.ts`

`mpesa-stk-push` creates the STK Push request against Daraja.

`mpesa-callback` receives the Daraja callback payload, extracts the key payment fields, and is structured so database persistence can be added later through a secure write path.

## Notes

- Do not expose Daraja credentials in the frontend.
- Use `.env.example` as the template for local frontend setup.
- Ensure `MPESA_CALLBACK_URL` points to a publicly reachable deployment of the `mpesa-callback` function.