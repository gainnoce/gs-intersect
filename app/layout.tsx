import type { Metadata } from "next";
import { Inter, Roboto_Slab } from "next/font/google";
import Link from "next/link";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "GS-Intersect",
  description: "Optimal power selection for group sequential and Simon 2-stage trial design",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoSlab.variable}`}>
      <body>
        <TooltipProvider>
          <NavBar />
          {children}
          <footer className="border-t border-az-light-platinum bg-white print-hidden">
            <div className="max-w-screen-2xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-[10px] text-az-platinum">
                For research use only. Results must be validated by a qualified biostatistician
                before use in any clinical programme.
              </p>
              <nav className="flex items-center gap-4 shrink-0">
                <Link href="/terms"   className="text-[10px] text-az-platinum hover:text-az-mulberry transition-colors">Terms of Use</Link>
                <Link href="/privacy" className="text-[10px] text-az-platinum hover:text-az-mulberry transition-colors">Privacy Policy</Link>
              </nav>
            </div>
          </footer>
        </TooltipProvider>
      </body>
    </html>
  );
}
