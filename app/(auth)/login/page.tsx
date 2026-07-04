import Link from "next/link";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Sign in to shouldcost.io</h1>
      <MagicLinkForm mode="login" />
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          Create your workspace
        </Link>
      </p>
    </div>
  );
}
