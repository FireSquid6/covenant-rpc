import { getServerSession } from "next-auth/next"
import { nextAuthConfig } from "@/lib/auth"
import Link from "next/link"
import SignOutButton from "./sign-out-button"

export default async function Header() {
  const session = await getServerSession(nextAuthConfig)

  return (
    <header className="navbar bg-base-200 shadow-md">
      <div className="navbar-start">
        <Link href="/" className="btn btn-ghost text-xl">
          Covenant Todo
        </Link>
      </div>
      
      <div className="navbar-end">
        {session ? (
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full">
                {session.user?.image ? (
                  <img src={session.user.image} alt="Profile" />
                ) : (
                  <div className="bg-primary text-primary-content flex items-center justify-center w-full h-full">
                    {session.user?.name?.charAt(0) || "U"}
                  </div>
                )}
              </div>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
              <li className="menu-title">
                <span>{session.user?.name}</span>
              </li>
              <li><SignOutButton /></li>
            </ul>
          </div>
        ) : (
          <Link href="/auth" className="btn btn-primary">
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}