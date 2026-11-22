import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"SnackSafe — Know what you eat", description:"Understand packaged snack nutrition and compare healthier choices." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }