import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--ff-display", subsets: ["latin"] });
const body = DM_Sans({ variable: "--ff-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FoodNow",
  description: "Hot food from restaurants near you, in Hong Kong and Singapore.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} min-h-screen`}>{children}</body>
    </html>
  );
}
