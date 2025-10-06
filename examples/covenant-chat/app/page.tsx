import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });


  return (
    <div>
      Hello, world!
      <p>
        {session === null ? "Not logged in." : `You are logged in as ${session.user.id}`}
      </p>
      <div className="flex flex-col ml-8 m-4">
        <Link href="/auth" className="link link-primary">
          Auth Page
        </Link>
        <Link href="/servers" className="link link-primary">
          Servers Page
        </Link>
      </div>
    </div>
  )
}
