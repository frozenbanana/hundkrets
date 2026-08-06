import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="sv">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
          <title>Hundkrets</title>
          <meta name="description" content="Hundkrets – byt hundpassning med grannar. Res bekymmersfritt." />
          <link rel="canonical" href={import.meta.env.VITE_SITE_URL || "https://hundkrets.se"} />
          <meta name="theme-color" content="#8b5a2b" />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={import.meta.env.VITE_SITE_URL || "https://hundkrets.se"} />
          <meta property="og:title" content="Hundkrets" />
          <meta property="og:description" content="Hundkrets – byt hundpassning med grannar. Res bekymmersfritt." />
          <meta property="og:image" content={`${import.meta.env.VITE_SITE_URL || "https://hundkrets.se"}/og-image.png`} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:locale" content="sv_SE" />
          <meta property="og:site_name" content="Hundkrets" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Hundkrets" />
          <meta name="twitter:description" content="Hundkrets – byt hundpassning med grannar. Res bekymmersfritt." />
          <meta name="twitter:image" content={`${import.meta.env.VITE_SITE_URL || "https://hundkrets.se"}/og-image.png`} />
          <link rel="icon" type="image/png" href="/favicon.png" />
          <link rel="apple-touch-icon" href="/favicon.png" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
          {/* Umami: script must resolve at this URL. If umami.henrybergstrom.com 404s, the host/tunnel is down — tracking silently no-ops. */}
          <script
            defer
            src="https://umami.henrybergstrom.com/script.js"
            data-website-id="4741ad93-fdb2-4bed-8708-165f8e0bb69d"
            data-domains="hundkrets.se,www.hundkrets.se"
          />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
