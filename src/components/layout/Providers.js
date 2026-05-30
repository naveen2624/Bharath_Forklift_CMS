// LOCATION: src/components/layout/Providers.js
"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import { preloadLogoForPDF } from "@/lib/pdf/generators";

export default function Providers({ children }) {
  // Preload logo into memory so PDF generation can embed it instantly
  useEffect(() => {
    preloadLogoForPDF();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontFamily: "var(--font-outfit)" },
            success: { iconTheme: { primary: "#ea580c", secondary: "#fff" } },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
