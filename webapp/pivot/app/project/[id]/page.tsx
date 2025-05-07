"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PanoramaViewerPage from "./components/PanoramaViewerPage";
import ProjectHeader from "./components/ProjectHeader";
import ProjectSettings from "./components/ProjectSettings";
import RawImagesTab from "./components/tabs/RawImagesTab";
import PanoramasTab from "./components/tabs/PanoramasTab";
import { useProject } from "../../../hooks/useProject";
import { cacheProject } from "../../../hooks/cache-service";
import PlaceLocationsTabContent from "./components/EnhancedImageGrid";
import { Button } from "@/components/ui/button";
import ShareDialog from "./components/ShareDialog";
import {
  Share2,
  Building,
} from "lucide-react";

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState("raw-images");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");

  const {
    project,
    loading,
    projectName,
    inOrganization,
    setProjectName,
    setInOrganization,
    isEditing,
    setIsEditing,
    handleUpdateProjectName,
    handleToggleProjectOrg,
    handleUpdateMetadata,
  } = useProject(projectId, router);

  useEffect(() => {
    if (project) {
      // Generate the share link when project loads
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/shared/${projectId}`;
      setShareLink(link);
    }
  }, [project, projectId]);

  const handleShareButtonClick = () => {
    setShareDialogOpen(true);
  };

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
          <div className="flex justify-between items-center mb-6">
            <ProjectHeader
              project={project}
              projectName={projectName}
              setProjectName={setProjectName}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              handleUpdateProjectName={handleUpdateProjectName}
              router={router}
            />

            <Button
              onClick={handleShareButtonClick}
              variant={inOrganization ? "default" : "outline"}
              className={
                inOrganization ? "bg-cyber-gradient hover:opacity-90" : "cyber-border"
              }
            >
              {inOrganization ? (
                <>
                  <Building className="mr-2 h-4 w-4" />
                  Shared with Organization
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share with Organization
                </>
              )}
            </Button>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-6 bg-muted/100 border border-border/50">
              <TabsTrigger
                value="raw-images"
                className="data-[state=active]:active-tab"
              >
                Raw Images
              </TabsTrigger>
              <TabsTrigger
                value="360-images"
                className="data-[state=active]:active-tab"
              >
                360° Images
              </TabsTrigger>
              <TabsTrigger
                value="place-locations"
                className="data-[state=active]:active-tab"
              >
                Place on Grid
              </TabsTrigger>
              <TabsTrigger
                value="walkthrough"
                className="data-[state=active]:active-tab"
              >
                View & Annotate
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="data-[state=active]:active-tab"
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
                  handleUpdateProject={handleUpdateProjectName}
                  inOrganization={inOrganization}
                  handleToggleProjectOrg={handleToggleProjectOrg}
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

      <ShareDialog 
        open={shareDialogOpen} 
        onOpenChange={setShareDialogOpen}
        shareLink={shareLink}
        currentProject={project}
        handleToggleProjectOrg={handleToggleProjectOrg}
        handleUpdateMetadata={handleUpdateMetadata}
      />
    </div>
  );
}
