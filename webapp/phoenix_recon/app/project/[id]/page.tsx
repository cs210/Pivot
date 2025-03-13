"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlaceLocationsTabContent from "./components/EnhancedEnhancedImageGrid";
import PanoramaViewerPage from "./components/PanoramaViewerPage";
import ProjectHeader from "./components/ProjectHeader";
import ProjectSettings from "./components/ProjectSettings";
import RawImagesTab from "./components/tabs/RawImagesTab";
import PanoramasTab from "./components/tabs/PanoramasTab";
import { useProject } from "./hooks/useProject";

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState("raw-images");

  const {
    project,
    loading,
    projectName,
    setProjectName,
    isEditing,
    setIsEditing,
    handleUpdateProject,
  } = useProject(projectId, router);

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

  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <ProjectHeader
            project={project}
            projectName={projectName}
            setProjectName={setProjectName}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            handleUpdateProject={handleUpdateProject}
            router={router}
          />

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-6 bg-muted/50 border border-border/50">
              <TabsTrigger
                value="raw-images"
                className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
              >
                Raw Images
              </TabsTrigger>
              <TabsTrigger
                value="360-images"
                className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
              >
                360° Images
              </TabsTrigger>
              <TabsTrigger
                value="place-locations"
                className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
              >
                Place on Grid
              </TabsTrigger>
              <TabsTrigger
                value="walkthrough"
                className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
              >
                View & Annotate
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
              >
                Project Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="raw-images">
              <RawImagesTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="360-images">
              <PanoramasTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="place-locations">
              <PlaceLocationsTabContent projectId={projectId} />
            </TabsContent>

            <TabsContent value="walkthrough">
              <PanoramaViewerPage projectId={projectId} />
            </TabsContent>

            <TabsContent value="settings">
              <ProjectSettings
                projectId={projectId}
                projectName={projectName}
                setProjectName={setProjectName}
                handleUpdateProject={handleUpdateProject}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <footer className="border-t border-border/40 bg-background">
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
