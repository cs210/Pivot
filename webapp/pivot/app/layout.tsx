import type React from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BodyWrapper } from "./BodyWrapper";
import { ensureImageStorageBucket } from "@/utils/setup-supabase";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Pivot - VR Experiences",
  description: "Transform your still images into interactive VR experiences",
};

export const viewport: Viewport = {
  themeColor: "#050517",
};

// Check bucket existence but don't try to create it (moved to useEffect in a client component)
if (typeof window !== "undefined") {
  // Only run in browser environment
  ensureImageStorageBucket().then((exists) => {
    if (exists) {
      console.log("Images storage bucket is available");
    } else {
      console.warn(
        "Images storage bucket may not exist - please create it in your Supabase dashboard"
      );
    }
  });
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="blob-container">
          {[...Array(9)].map((_, index) => (
            <div
              key={index}
              className={`blob blob-${index + 1}`}
              style={{
                backgroundImage: `url(/images/blobs/blob-${index + 1}.png)`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
