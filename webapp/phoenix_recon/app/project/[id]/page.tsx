"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/header";
import { ChevronLeft, Save, Settings } from "lucide-react";

interface Project {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
}

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
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
      fetchProjectDetails();
    };

    checkUser();
  }, [router, supabase, projectId]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setProject(data);
      setProjectName(data.name);
    } catch (error) {
      console.error("Error fetching project:", error);
      // If project not found, redirect to dashboard
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!projectName.trim()) {
      alert("Please enter a project name");
      return;
    }

    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: projectName.trim() })
        .eq("id", projectId);

      if (error) throw error;

      setProject(prev => prev ? {...prev, name: projectName.trim()} : null);
      setIsEditing(false);
      alert("Project updated successfully");
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project");
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          {loading ? (
            <div className="text-center py-12">Loading project...</div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-8">
                <Button 
                  variant="outline" 
                  className="cyber-border" 
                  onClick={() => router.push("/dashboard")}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
                
                <div className="flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-4">
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="text-xl font-bold text-white bg-background/70 border-white/20"
                      />
                      <Button 
                        onClick={handleUpdateProject}
                        className="bg-cyber-gradient hover:opacity-90"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setProjectName(project?.name || "");
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <h1 className="text-3xl font-bold cyber-glow">{project?.name}</h1>
                      <Button 
                        variant="ghost" 
                        className="ml-2"
                        onClick={() => setIsEditing(true)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                {/* Project sidebar */}
                <div className="md:col-span-3">
                  <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle>Project Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <nav className="flex flex-col space-y-1">
                        <Button variant="ghost" className="justify-start">
                          General
                        </Button>
                        <Button variant="ghost" className="justify-start">
                          Team Members
                        </Button>
                        <Button variant="ghost" className="justify-start">
                          Integrations
                        </Button>
                      </nav>
                    </CardContent>
                  </Card>
                </div>

                {/* Main content area */}
                <div className="md:col-span-9">
                  <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle>Project Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-6 bg-muted/20 rounded-lg border border-border/40 text-center">
                        <p className="text-muted-foreground">
                          This is where your project content will go. Add your custom project editing components here.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
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