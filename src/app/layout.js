import { Outfit, Syne, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/layout/Providers";
import "@/styles/globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata = {
  title: "Bharath Forklift CMS",
  description: "Enterprise Company Management System for Bharath Forklift",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${syne.variable} ${jetbrains.variable} font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
