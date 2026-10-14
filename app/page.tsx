import { redirect } from "next/navigation";

// The auth server has no home page. Send visitors to sign in.
export default function Home() {
  redirect("/sign-in");
}
