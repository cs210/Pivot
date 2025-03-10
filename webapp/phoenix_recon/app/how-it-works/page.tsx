import { Header } from "@/components/header";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HowItWorks() {
  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <h1 className="text-3xl font-bold mb-6 cyber-glow">How It Works</h1>
          <div className="space-y-6">
            <section className="p-6 rounded-lg bg-muted/30 cyber-border">
              <h2 className="text-2xl font-semibold mb-3 cyber-glow">
                1. Upload Your 360° Video
              </h2>
              <p className="text-muted-foreground">
                Simply upload your 360° video footage through our secure
                platform.
              </p>
            </section>
            <section className="p-6 rounded-lg bg-muted/30 cyber-border">
              <h2 className="text-2xl font-semibold mb-3 cyber-glow">
                2. Automatic Processing
              </h2>
              <p className="text-muted-foreground">
                Our advanced system converts your videos into navigable 3D
                environments.
              </p>
            </section>
            <section className="p-6 rounded-lg bg-muted/30 cyber-border">
              <h2 className="text-2xl font-semibold mb-3 cyber-glow">
                3. Explore in VR
              </h2>
              <p className="text-muted-foreground">
                Access and interact with your newly created VR environments on
                any compatible device.
              </p>
            </section>
          </div>
          <div className="mt-8">
            <Link href="/">
              <Button className="bg-cyber-gradient hover:opacity-90">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <footer className="border-t border-border/40">
        <div className="container flex flex-col gap-2 py-4 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
          <p className="text-center text-sm text-muted-foreground md:text-left">
            © 2024 Phoenix Recon. All rights reserved.
          </p>
          <nav className="flex items-center justify-center gap-4 md:gap-6">
            <Link
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              href="#"
            >
              Terms of Service
            </Link>
            <Link
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              href="#"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
