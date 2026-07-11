import Link from "next/link";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { GoogleButton } from "@/components/auth/google-button";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Sign in to shouldcost.io</h1>
      <GoogleButton />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-hairline" />
        or
        <span className="h-px flex-1 bg-hairline" />
      </div>
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
