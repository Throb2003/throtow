// Vercel Environment Variables Template
// Copy this template and add your values in the Vercel Dashboard
// Settings → Environment Variables → Add

[
  {
    "key": "VITE_SUPABASE_URL",
    "value": "https://rqovpgpatspyjanwrosj.supabase.co",
    "target": ["production", "preview", "development"]
  },
  {
    "key": "VITE_SUPABASE_ANON_KEY",
    "value": "sb_publishable_EPlMGOkU08R_v4kxafwQ-Q_FCqnh_Iv",
    "target": ["production", "preview", "development"]
  },
  {
    "key": "VITE_SUPABASE_FUNCTIONS_URL",
    "value": "https:///rqovpgpatspyjanwrosj.supabase.co/functions/v1",
    "target": ["production", "preview", "development"],
    "optional": true
  },
  {
    "key": "VITE_MAP_DEFAULT_LAT",
    "value": "-1.286389",
    "target": ["production", "preview", "development"],
    "optional": true
  },
  {
    "key": "VITE_MAP_DEFAULT_LNG",
    "value": "36.817223",
    "target": ["production", "preview", "development"],
    "optional": true
  }
]

/*
 * INSTRUCTIONS:
 * 
 * 1. Get Supabase credentials:
 *    - Go to supabase.com → Your Project → Settings → API
 *    - Copy URL and anon key
 * 
 * 2. In Vercel Dashboard:
 *    - Go to your project
 *    - Click "Settings" → "Environment Variables"
 *    - Add each variable above with your values
 *    - Select target: "Production", "Preview", "Development"
 *    - Click "Save"
 * 
 * 3. Redeploy:
 *    - Go to "Deployments"
 *    - Click the three dots on the latest deployment
 *    - Click "Redeploy"
 * 
 * REQUIRED VARIABLES:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * 
 * OPTIONAL VARIABLES:
 * - VITE_SUPABASE_FUNCTIONS_URL (auto-generated if not set)
 * - VITE_MAP_DEFAULT_LAT (defaults to Nairobi)
 * - VITE_MAP_DEFAULT_LNG (defaults to Nairobi)
 */
