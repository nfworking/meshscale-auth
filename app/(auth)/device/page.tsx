import type { Metadata } from "next";
import { DeviceForm } from "@/components/device-form";

export const metadata: Metadata = { title: "Approve a device" };

export default function DevicePage() {
  return <DeviceForm />;
}
