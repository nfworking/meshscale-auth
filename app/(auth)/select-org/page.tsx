import type { Metadata } from "next";
import { SelectOrgForm } from "@/components/select-org-form";

export const metadata: Metadata = { title: "Choose a workspace" };

export default function SelectOrgPage() {
  return <SelectOrgForm />;
}
