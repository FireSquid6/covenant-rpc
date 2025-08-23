import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { nextAuthConfig } from "@/lib/auth"
import SignInButton from "@/components/sign-in-button"

export default async function AuthPage() {
  const session = await getServerSession(nextAuthConfig)

  if (session) {
    redirect("/")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-100">
      <div className="card w-96 bg-base-200 shadow-xl">
        <div className="card-body items-center text-center">
          <h2 className="card-title">Sign In</h2>
          <p>Welcome! Please sign in to continue.</p>
          <div className="card-actions justify-end">
            <SignInButton />
          </div>
        </div>
      </div>
    </div>
  )
}