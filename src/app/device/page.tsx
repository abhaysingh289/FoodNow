import type { Metadata } from "next";
import { DeviceFrame } from "@/components/view/DeviceFrame";
import { safeSrc } from "@/lib/viewMode";

export const metadata: Metadata = { title: "FoodNow · Phone preview" };

export default async function DevicePage({ searchParams }: { searchParams: Promise<{ src?: string | string[] }> }) {
  const { src } = await searchParams;
  return <DeviceFrame src={safeSrc(Array.isArray(src) ? src[0] : src)} />;
}
