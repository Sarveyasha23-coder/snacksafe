import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnackSafe — Know what you eat",
  description: "Understand packaged snack nutrition, inspect ingredient labels, and compare food products with transparent data limitations.",
  applicationName: "SnackSafe",
  robots: { index: true, follow: true },
  openGraph: {
    title: "SnackSafe — Know what you eat",
    description: "Understand packaged snack nutrition and compare food labels.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
