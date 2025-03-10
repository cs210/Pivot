"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
    };

    checkUser();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>This is a simple dashboard.</p>
      <Button onClick={handleSignOut} className="mt-4">
        Sign Out
      </Button>
    </div>
  );
}
