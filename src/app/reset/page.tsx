import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/ResetForm";
import { resetPasswordAction } from "./actions";

const ERR: Record<string, string> = {
  "Passwords do not match": "Passwords do not match.",
};

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? "";

  return (
    <AuthShell>
      {!token ? (
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Invalid reset link</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">This password reset link is missing or malformed. Request a fresh one.</p>
          <p className="mt-6 text-sm"><Link href="/forgot" className="text-accent hover:underline">Request a new link</Link></p>
        </div>
      ) : (
        <ResetForm action={resetPasswordAction} token={token} errorMessage={sp.err ? ERR[sp.err] ?? decodeURIComponent(sp.err) : null} />
      )}
    </AuthShell>
  );
}
