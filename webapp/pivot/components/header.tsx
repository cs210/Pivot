"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function Header() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    checkUser();
  }, [supabase]);

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Compass className="h-6 w-6 text-primary" />
          <span className="text-xl geometric-text gradient-text">Pivot</span>
        </Link>
        <nav className="flex gap-4">
          {pathname !== "/" && (
            <Link href="/">
              <Button
                variant="ghost"
                className="text-foreground hover:text-primary hover:bg-background/80 geometric-text"
              >
                Home
              </Button>
            </Link>
          )}
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="outline" className="glass-card geometric-text">
                  My Account
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="text-foreground hover:text-primary hover:bg-background/80 geometric-text"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-foreground hover:text-primary hover:bg-background/80 geometric-text"
                >
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-cyber-gradient hover:opacity-90 geometric-text">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
