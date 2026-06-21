import "./css/style.css";

import { Inter, Inter_Tight } from "next/font/google";
import Theme from "./theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const inter_tight = Inter_Tight({
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata = {
  title: "Laskad | Secure Biometric Verification",
  description: "Authorize your Laskad transactions instantly and securely using your device's biometric authentication (Face ID or fingerprint).",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: https://github.com/vercel/next.js/issues/44343 */}
      <body
        className={`${inter.variable} ${inter_tight.variable} font-inter antialiased bg-slate-950 text-gray-200 tracking-tight`}
      >
        <Theme>
          <div className="relative flex flex-col min-h-screen overflow-hidden supports-[overflow:clip]:overflow-clip">
            {children}
          </div>
        </Theme>
        {/* Service Worker Registration for PWA Install prompt */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('ServiceWorker registration successful with scope: ', reg.scope);
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
