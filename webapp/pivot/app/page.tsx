"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CuboidIcon as Cube, Globe } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Header } from "@/components/header";
import dynamic from "next/dynamic";

// the URL of the default 360° image to display on the homepage
const HOMEPAGE_360_URL =
  "https://bahareuzhrlwdxwlovoa.supabase.co/storage/v1/object/public/panoramas//Homepage.jpg";

// Dynamically import ReactPhotoSphereViewer to avoid SSR issues
const ReactPhotoSphereViewer = dynamic(
  () =>
    import("react-photo-sphere-viewer").then(
      (mod) => mod.ReactPhotoSphereViewer
    ),
  { ssr: false }
);

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    checkUser();
  }, [supabase]);

  // to activate background blobs, find and delete "bg-muted"
  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <Header />
      <main className="flex-1">
        <section className="w-full py-6 md:py-12 lg:py-28 relative overflow-hidden">
          <div className="container px-4 md:px-6 relative z-10">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 xl:grid-cols-2">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none geometric-text">
                    Transform <br /> Still Images Into Interactive VR
                    Experiences.
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Upload your images and we'll convert them into immersive VR
                    environments that you can navigate, explore, and analyze.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href={user ? "/explore" : "/register"}>
                    <Button
                      size="lg"
                      className="bg-cyber-gradient hover:opacity-90 geometric-text"
                    >
                      Explore Spaces{" "}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                  <Link href={user ? "/dashboard" : "/register"}>
                    <Button
                      size="lg"
                      className="bg-cyber-gradient hover:opacity-90 geometric-text"
                    >
                      {user ? "Go to Dashboard" : "Start Creating"}{" "}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/how-it-works">
                    <Button
                      size="lg"
                      variant="outline"
                      className="glass-card geometric-text"
                    >
                      How It Works
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-full aspect-video overflow-hidden rounded-xl glass-card p-1">
                  <ReactPhotoSphereViewer
                    src={HOMEPAGE_360_URL}
                    width="100%"
                    height="100%"
                    defaultZoomLvl={0}
                    defaultYaw={0.3}
                    defaultPitch={0.65}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-6 md:py-12 lg:py-18 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl cyber-glow">
                  How Pivot Works
                </h2>
                <p className="max-w-[1200px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  From static images to interactive VR in four simple steps
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-4 lg:gap-12">
              <div className="flex flex-col items-center justify-center rounded-lg p-4 h-full">
                <div className="rounded-full bg-cyber-gradient p-2 mb-4">
                  <svg
                    className="h-6 w-6 text-foreground"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                    <path d="M12 12v9" />
                    <path d="m16 16-4-4-4 4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold cyber-glow w-full text-center mb-2 whitespace-nowrap">
                  Upload Images
                </h3>
                <p className="text-center text-muted-foreground w-full max-w-xs mx-auto">
                  Upload images taken on any device through our secure platform.
                </p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg p-4 h-full">
                <div className="rounded-full bg-cyber-gradient p-2 mb-4">
                  <Cube className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="text-xl font-bold cyber-glow w-full text-center mb-2 whitespace-nowrap">
                  Auto Processing
                </h3>
                <p className="text-center text-muted-foreground w-full max-w-xs mx-auto">
                  Our system automatically converts your images into seamless
                  360° panoramas.
                </p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg p-4 h-full">
                <div className="rounded-full bg-cyber-gradient p-2 mb-4">
                  <svg
                    className="h-6 w-6 text-foreground"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M9.5 11l4.5-4.5M9.5 15.5l4.5-4.5" />
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold cyber-glow w-full text-center mb-2 whitespace-nowrap">
                  Annotate & Analyze
                </h3>
                <p className="text-center text-muted-foreground w-full max-w-xs mx-auto">
                  Use our web platform to annotate environments with
                  observations and analysis.
                </p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg p-4 h-full">
                <div className="rounded-full bg-cyber-gradient p-2 mb-4">
                  <svg
                    className="h-6 w-6 text-foreground"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold cyber-glow w-full text-center mb-2 whitespace-nowrap">
                  Explore in VR
                </h3>
                <p className="text-center text-muted-foreground w-full max-w-xs mx-auto">
                  Access your interactive VR environments on any compatible
                  device.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-6 md:py-12 lg:py-18 relative">
          <div className="absolute inset-0"></div>
          <div className="container px-4 md:px-6 relative z-10">
            <div className="grid gap-10 px-10 md:gap-16 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                  Virtual Reality
                </div>
                <h2 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl cyber-glow">
                  Experience Locations Like You're Actually There
                </h2>
                <p className="text-muted-foreground md:text-xl/relaxed">
                  Our technology transforms ordinary still images into fully
                  navigable virtual environments. Move through spaces, explore
                  details, and experience locations from any angle.
                </p>
                <Link
                  href={user ? "/dashboard" : "/register"}
                  className="inline-flex items-center justify-center
             transition-colors focus-visible:outline-none
             focus-visible:ring-1 focus-visible:ring-ring
             disabled:pointer-events-none disabled:opacity-50"
                >
                  <Button
                    size="lg"
                    className="bg-cyber-gradient hover:opacity-90 geometric-text"
                  >
                    {user ? "Go to Dashboard" : "Start Creating"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="flex flex-col items-start space-y-4">
                <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                  Applications
                </div>
                <h3 className="text-2xl font-bold cyber-glow">Perfect For:</h3>
                <ul className="grid gap-2">
                  <li className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Real Estate Virtual Tours</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Tourism & Travel Experiences</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Construction & Architecture Documentation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Event & Venue Showcases</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Educational & Training Environments</span>
                  </li>
                </ul>
                <Link
                  href="/use-cases"
                  className="inline-flex items-center justify-center
             transition-colors focus-visible:outline-none
             focus-visible:ring-1 focus-visible:ring-ring
             disabled:pointer-events-none disabled:opacity-50"
                >
                  <Button className="bg-cyber-gradient hover:opacity-90 geometric-text">
                    View Use Cases
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-6 md:py-12 lg:py-18 bg-muted">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6 lg:gap-10">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight cyber-glow">
                Ready to Transform Your Images?
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Create immersive, interactive VR experiences from your images
                today.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-y-2">
              <div className="flex justify-center">
                <div className="flex justify-center">
                  <Link href="/register">
                    <Button
                      size="lg"
                      className="w-full min-[400px]:w-auto bg-cyber-gradient hover:opacity-90"
                    >
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border/40">
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
