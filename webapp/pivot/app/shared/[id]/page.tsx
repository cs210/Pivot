"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PanoramaViewerPage from "../../project/[id]/components/PanoramaViewerPage";
import PlaceLocationsTabContent from "../../project/[id]/components/EnhancedImageGrid";
import { Lock, Eye, ArrowLeft, Building2 } from "lucide-react";

export default function SharedProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("walkthrough");
  const [organization, setOrganization] = useState<any>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);

        // Check if user is logged in
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();
        if (!session || authError) {
          router.push("/login");
          return;
        }

        // Get user's email domain
        const userDomain = session.user.email?.split("@")[1];
        if (!userDomain) {
          setError(
            "Unable to determine your organization. Please make sure you're logged in with a valid email."
          );
          setLoading(false);
          return;
        }

        // Fetch project and its organization
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select(
            `
            *,
            organizations (
              id,
              name,
              domain_restriction,
              description
            )
          `
          )
          .eq("id", projectId)
          .single();

        if (projectError || !projectData) {
          setError(
            "This project doesn't exist or you don't have access to it."
          );
          setLoading(false);
          return;
        }

        // Check if user belongs to the organization
        if (projectData.organization_id) {
          const orgDomain = projectData.organizations?.domain_restriction;

          if (orgDomain === userDomain) {
            setProject(projectData);
            setOrganization(projectData.organizations);
          } else {
            setError(
              `This project is only accessible to members of the ${
                projectData.organizations?.name || "organization"
              }.`
            );
          }
        } else {
          setError("This project is not shared with any organization.");
        }
      } catch (error) {
        console.error("Error fetching shared project:", error);
        setError("Failed to load the project. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, supabase, router]);

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
              <Link href="/login">
                <Button className="bg-cyber-gradient hover:opacity-90">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Sign In
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
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <Link href="/explore">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <h1 className="text-2xl font-bold cyber-glow">
                  {project.name}
                </h1>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Eye className="mr-2 h-4 w-4" />
                  <span>View-only Project</span>
                </div>
                {organization && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>Shared with {organization.name}</span>
                  </div>
                )}
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
