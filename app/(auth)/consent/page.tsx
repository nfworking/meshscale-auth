import type { Metadata } from "next";
import { ConsentForm } from "@/components/consent-form";

export const metadata: Metadata = { title: "Authorize access" };

export default function ConsentPage() {
  return <ConsentForm />;
}
