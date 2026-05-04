# THROTOW Real App TODO (Marketing Readiness)

## ✅ COMPLETED (investigation)
- [x] Landing CTA + auth panel toggle implementation reviewed (`app/src/pages/LandingPage.tsx`)
- [x] Routing/auth guard reviewed (`app/src/App.tsx`)
- [x] Auth bootstrap + login/register functions reviewed (`app/src/contexts/AuthContext.tsx`)
- [x] SEO metadata gap identified (`app/index.html` only has `<title>`)
- [x] Autocomplete console warning reproduced cause identified (Login/Register inputs missing `autocomplete`)
- [x] Shared `Input` component forwards props correctly (`app/src/components/ui/input.tsx`)
- [x] Admin login page reviewed for auth UX parity (`app/src/pages/AdminLoginPage.tsx`)
- [x] Shared `Button` component reviewed (no obvious CTA click interference) (`app/src/components/ui/button.tsx`)

---

## 🚨 MUST FIX BEFORE MARKETING (conversion blockers)
- [ ] Make “Create account” reliably take the user to the signup UI on all viewports  
  - [ ] If auth panel is below the fold, add scroll-to-card when switching `activePanel`
  - [ ] Consider using real routes for auth (`/register`, `/login`) instead of local state toggles for shareability
- [ ] Add correct `autocomplete` attributes to all auth inputs  
  - [ ] Login email: `autocomplete="email"`
  - [ ] Login password: `autocomplete="current-password"`
  - [ ] Register full name: `autocomplete="name"`
  - [ ] Register email: `autocomplete="email"`
  - [ ] Register phone: `autocomplete="tel"`
  - [ ] Register password + confirm: `autocomplete="new-password"`
- [ ] Add SEO + social share metadata (Vercel/ads readiness) in `app/index.html`
  - [ ] `meta name="description"`
  - [ ] OpenGraph tags (`og:title`, `og:description`, `og:image`, etc.)
  - [ ] Twitter card tags
  - [ ] favicon + (optional) `rel="canonical"`

---

## ⭐ CONVERSION + TRUST IMPROVEMENTS
- [ ] Add a trust strip on landing with specific claims (not vague)
  - [ ] Security/privacy statement link
  - [ ] Clear explanation of payment handling (Mpesa flow specifics)
  - [ ] Support contact options (WhatsApp/call/email + hours)
  - [ ] Coverage statement (e.g., Nairobi areas / radius)
- [ ] Replace “demo/placeholder” style phrasing with what actually happens in your product
- [ ] Improve auth microcopy for marketing trust
  - [ ] Clarify what happens after registration (confirmation? immediate login?)
  - [ ] Make error states actionable (e.g., invalid password, unverified email, etc.)

---

## ✅ POLISH / QUALITY CHECKS
- [ ] Verify responsive layout at mobile widths (~360px)
  - [ ] “Create account” CTA is visible and takes user to the signup card
  - [ ] Tabs/register form never appear “stuck” behind the fold
- [ ] Accessibility + UX polish
  - [ ] Ensure focus states are visible for keyboard navigation
  - [ ] Ensure all buttons have correct labels and hit areas
- [ ] Run verification before launch
  - [ ] `npm run build`
  - [ ] `tsc --noEmit`
  - [ ] Check console/network errors on: Landing → Register → Dashboard redirect (by role)

---

## 🎯 LAUNCH VERIFICATION CHECKLIST
- [ ] Landing → “Create account” → Register form appears (no dead-end)
- [ ] Register submit: successful path shows success message + redirects (or returns to sign in)
- [ ] Login submit: redirects to correct dashboard by role
- [ ] Social share preview looks good (title/description/image)
- [ ] No auth console warnings (especially autocomplete)
