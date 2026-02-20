import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="sv">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Hundkrets</title>
          <meta name="description" content="Hundkrets – byt hundpassning med grannar. Res bekymmersfritt." />
          <meta property="og:title" content="Hundkrets" />
          <meta property="og:description" content="Hundkrets – byt hundpassning med grannar. Res bekymmersfritt." />
          <meta property="og:image" content="/og-image.png" />
          <link rel="icon" type="image/png" href="/favicon.png" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
          <script defer src="https://umami.henrybergstrom.com/script.js" data-website-id="4741ad93-fdb2-4bed-8708-165f8e0bb69d" />
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
