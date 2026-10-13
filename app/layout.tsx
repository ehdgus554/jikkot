import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jikkot.ehdgus554.workers.dev"),
  title: "직꼿",
  description: "직꼿",
  openGraph: {
    title: "직꼿",
    siteName: "직꼿",
    description: "",
    url: "https://jikkot.ehdgus554.workers.dev/",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/assets/brand/wordmark-ui.png",
        width: 360,
        height: 126,
        alt: "직꼿",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "직꼿",
    description: "",
    images: ["/assets/brand/wordmark-ui.png"],
  },
  icons: {
    icon: { url: "/assets/brand/wordmark-ui.png", type: "image/png" },
    shortcut: "/assets/brand/wordmark-ui.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFDFB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preload"
          href="/assets/fonts/LINESeedKR-Rg.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/LINESeedKR-Bd.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Nunito-variable.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
