import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ variable: "--ff-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FoodNow",
  description: "Hot food from restaurants near you, in Hong Kong and Singapore.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} min-h-screen`}>{children}</body>
    </html>
  );
}
