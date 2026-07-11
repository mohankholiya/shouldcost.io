import Link from "next/link";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { GoogleButton } from "@/components/auth/google-button";

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Create your workspace</h1>
      <GoogleButton />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-hairline" />
        or
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <MagicLinkForm mode="signup" />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
