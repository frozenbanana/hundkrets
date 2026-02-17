# Hundkrets – Asset Generation Prompts for Nanobanana

Use these prompts to generate all necessary image and logo assets for Hundkrets. The app uses a warm, dog-themed color palette: bone (#f5e6d3), paw brown (#8b5a2b), grass green (#7cb342), fur (#d4a574).

---

## 1. Favicon (32×32 or 48×48 px)

**Prompt:**
```
Simple favicon for "Hundkrets" – a Swedish peer-to-peer dog-sitting exchange app. Minimalist icon: a single dog paw print or a stylized letter "H" that subtly suggests a paw. Warm brown (#8b5a2b) on cream/white background. Clean, flat design, readable at small sizes. No text. Square format, transparent or cream background.
```

**Output:** Save as `app/public/favicon.ico` (or favicon.png and convert)

---

## 2. Logo – Full Wordmark (for header/nav)

**Prompt:**
```
Logo wordmark "Hundkrets" for a Swedish dog-sitting exchange app. Clean, friendly typography. Warm brown (#8b5a2b) text. Optional: small dog paw or dog silhouette icon beside the text. Modern, rounded sans-serif style. Horizontal layout. Transparent background. Suitable for dark nav bar or light backgrounds. 400–600px wide.
```

**Output:** Save as `app/public/logo.svg` or `app/public/logo.png`

---

## 3. Logo – Icon Only (for compact use)

**Prompt:**
```
App icon for "Hundkrets" – dog-sitting community app. Simple circular or rounded-square icon. Two elements: a dog silhouette and a circular/community motif (e.g. two dogs, or a paw inside a circle). Warm brown (#8b5a2b) and cream (#f5e6d3). Friendly, minimal. 128×128px or 256×256px. Transparent or cream background.
```

**Output:** Save as `app/public/logo-icon.png`

---

## 4. Open Graph / Social Share Image (1200×630 px)

**Prompt:**
```
Social share image for "Hundkrets" – Swedish peer-to-peer dog-sitting app. Layout: "Hundkrets" as headline, tagline "Byt hundpassning med grannar. Res bekymmersfritt." (Swap dog-sitting with neighbors. Travel worry-free.) Warm, inviting illustration: two friendly dogs or a dog with a suitcase/travel theme. Color palette: cream (#f5e6d3), brown (#8b5a2b), soft green (#7cb342). Horizontal 1200×630px. No harsh edges, friendly and trustworthy feel.
```

**Output:** Save as `app/public/og-image.png`

---

## 5. Landing Page Hero Illustration (optional, ~600×400 px)

**Prompt:**
```
Friendly illustration for Hundkrets landing page. Two dog owners exchanging/handshaking with their dogs beside them. Or: a dog with a small suitcase, looking happy. Warm, soft colors: cream, brown, light green. Flat or semi-flat style. Conveys community, trust, and travel. No text in image.
```

**Output:** Save as `app/public/hero-illustration.png`

---

## Summary – Files to Generate

| Asset | Filename | Size | Purpose |
|-------|----------|------|---------|
| Favicon | `favicon.ico` | 32×32 | Browser tab |
| Logo wordmark | `logo.png` | ~400×80 | Nav, header |
| Logo icon | `logo-icon.png` | 128×128 | Compact branding |
| OG image | `og-image.png` | 1200×630 | Social sharing |
| Hero (optional) | `hero-illustration.png` | 600×400 | Landing page |

Place all files in `app/public/`. The favicon is already referenced at `/favicon.ico`. Add logo to AppShell when ready: `<img src="/logo.png" alt="Hundkrets" />`.
