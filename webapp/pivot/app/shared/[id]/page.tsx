"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PanoramaViewerPage from "../../project/[id]/components/PanoramaViewerPage";
import PlaceLocationsTabContent from "../../project/[id]/components/EnhancedImageGrid";
import { Lock, Eye, ArrowLeft } from "lucide-react";

export default function SharedProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("walkthrough");

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);

        // Fetch the project
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("is_public", true)
          .single();

        if (projectError) throw projectError;

        if (!projectData) {
          setError("This project doesn't exist or is not publicly shared.");
          setLoading(false);
          return;
        }

        setProject(projectData);
      } catch (error) {
        console.error("Error fetching shared project:", error);
        setError(
          "Failed to load the project. It may not exist or is not publicly shared."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, supabase]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen text-foreground">
        <Header />
        <main className="flex-1 relative">
          <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
          <div className="container mx-auto px-4 py-8 relative z-10">
            <div className="text-center py-12">Loading project...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen text-foreground">
        <Header />
        <main className="flex-1 relative">
          <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
          <div className="container mx-auto px-4 py-8 relative z-10">
            <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-lg border border-border/40">
              <Lock className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {error}
              </p>
              <Link href="/">
                <Button className="bg-cyber-gradient hover:opacity-90">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="flex items-center mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <h1 className="text-2xl font-bold cyber-glow">
                  {project.name}
                </h1>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Eye className="mr-2 h-4 w-4" />
                <span>View-only Project</span>
              </div>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-6 bg-muted/100 border border-border/50">
              <TabsTrigger
                value="walkthrough"
                className="data-[state=active]:active-tab"
              >
                View 360° Tour
              </TabsTrigger>
              <TabsTrigger
                value="place-locations"
                className="data-[state=active]:active-tab"
              >
                Floor Plan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="walkthrough">
              <PanoramaViewerPage projectId={projectId} isSharedView={true} />
            </TabsContent>

            <TabsContent value="place-locations">
              <PlaceLocationsTabContent
                projectId={projectId}
                isSharedView={true}
              />
            </TabsContent>
          </Tabs>
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