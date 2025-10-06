import { authClient } from "@/client/auth"
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";

export default async function AuthPage() {
  const { data: session, error } = await authClient.getSession();

  if (error !== null) {
    redirect("/");
  }

  if (session !== null) {
    redirect("/");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-100">
      <div className="card w-96 bg-base-200 shadow-xl">
        <div className="card-body items-center text-center">
          <h2 className="card-title">Sign In</h2>
          <div className="card-actions justify-end">
            <SignInButton />
          </div>
        </div>
      </div>
    </div>
  )
}
