import { Header } from "@/components/header";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UseCases() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <h1 className="text-3xl font-bold mb-6 cyber-glow">Use Cases</h1>
          <div className="space-y-6">
            <section className="p-6 rounded-lg bg-muted/30 cyber-border">
              <h2 className="text-2xl font-semibold mb-3 cyber-glow">
                Real Estate Virtual Tours
              </h2>
              <p className="text-muted-foreground">
                Provide immersive property tours, allowing potential buyers to
                explore homes from anywhere.
              </p>
            </section>
            <section className="p-6 rounded-lg bg-muted/30 cyber-border">
              <h2 className="text-2xl font-semibold mb-3 cyber-glow">
                Tourism & Travel Experiences
              </h2>
              <p className="text-muted-foreground">
                Offer virtual visits to tourist destinations, hotels, and
                attractions.
              </p>
            </section>
            <section className="p-6 rounded-lg bg-muted/30 cyber-border">
              <h2 className="text-2xl font-semibold mb-3 cyber-glow">
                Construction & Architecture Documentation
              </h2>
              <p className="text-muted-foreground">
                Document construction progress and architectural designs in
                interactive 3D environments.
              </p>
            </section>
            <section className="p-6 rounded-lg bg-muted/30 cyber-border">
              <h2 className="text-2xl font-semibold mb-3 cyber-glow">
                Event & Venue Showcases
              </h2>
              <p className="text-muted-foreground">
                Create virtual walkthroughs of event spaces and venues for
                planning and marketing purposes.
              </p>
            </section>
            <section className="p-6 rounded-lg bg-muted/30 cyber-border">
              <h2 className="text-2xl font-semibold mb-3 cyber-glow">
                Educational & Training Environments
              </h2>
              <p className="text-muted-foreground">
                Develop immersive learning experiences and virtual training
                simulations.
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
      <footer className="border-t border-border/40 bg-background">
        <div className="container flex flex-col gap-2 py-4 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
          <p className="text-center text-sm text-muted-foreground md:text-left">
            © 2025 Pivot. All rights reserved.
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
