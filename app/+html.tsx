/**
 * HTML root para el build web (Expo Router SSG).
 * Solo se renderiza una vez en build time — no se ejecuta en el cliente.
 * Acá viven los meta tags de PWA, theme color, viewport y la registración
 * del service worker.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es-AR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#534AB7" />
        <meta name="application-name" content="Mi Agenda" />

        {/* iOS / Safari add-to-home-screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Mi Agenda" />
        <link rel="apple-touch-icon" href="/icon.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" href="/favicon.png" />

        {/* Inter (la tipografía base del design system unificado) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* Reset propio de Expo Router para que ScrollView no haga overscroll raro */}
        <ScrollViewStyleReset />

        {/* Body font + smoothing — equivalente al index.css de RH */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; }
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #F8FAFC;
                color: #0F172A;
                font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              /* Scrollbar sutil (idéntico a RH) */
              ::-webkit-scrollbar { width: 10px; height: 10px; }
              ::-webkit-scrollbar-track { background: transparent; }
              ::-webkit-scrollbar-thumb {
                background: rgba(100, 116, 139, 0.25);
                border-radius: 6px;
                border: 2px solid transparent;
                background-clip: padding-box;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: rgba(100, 116, 139, 0.45);
                background-clip: padding-box;
              }
            `,
          }}
        />

        {/* Registrar service worker (solo en producción / HTTPS) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function (e) {
                    console.warn('SW registration failed:', e);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
