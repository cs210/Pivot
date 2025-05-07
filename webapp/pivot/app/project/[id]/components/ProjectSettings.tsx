import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Share2, AlertCircle, Building } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ProjectSettingsProps {
  projectId: string;
  projectName: string;
  setProjectName: (name: string) => void;
  handleUpdateProject: () => void;
  inOrganization: boolean;
  handleToggleProjectOrg?: () => void;
}

export default function ProjectSettings({
  projectId,
  projectName,
  setProjectName,
  handleUpdateProject,
  inOrganization = false,
  handleToggleProjectOrg,
}: ProjectSettingsProps) {
  const [activeSection, setActiveSection] = useState("general");
  const [isToggling, setIsToggling] = useState(false);

  const handleShareToggle = async () => {
    if (!handleToggleProjectOrg) return;

    setIsToggling(true);
    try {
      await handleToggleProjectOrg();
    } catch (error) {
      console.error("Error toggling organization access:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Project settings sidebar */}
      <div className="md:col-span-3">
        <Card className="bg-background/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <nav className="flex flex-col space-y-1">
              <Button
                variant={activeSection === "general" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveSection("general")}
              >
                General
              </Button>
              {/* <Button
                variant={activeSection === "sharing" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveSection("sharing")}
              >
                Sharing
              </Button> */}
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => setActiveSection("team")}
              >
                Team Members
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => setActiveSection("integrations")}
              >
                Integrations
              </Button>
            </nav>
          </CardContent>
        </Card>
      </div>

      {/* Project settings content */}
      <div className="md:col-span-9">
        {activeSection === "general" && (
          <Card className="bg-background/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-white">
                    Project Name
                  </Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="text-white bg-background/70 border-white/20"
                  />
                </div>
                <Button
                  onClick={handleUpdateProject}
                  className="bg-cyber-gradient hover:opacity-90"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "sharing" && (
          <Card className="bg-background/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Sharing Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-md">
                  <div className="space-y-1">
                    <h3 className="font-medium">Organization Access</h3>
                    <p className="text-sm text-muted-foreground">
                      When enabled, anyone in your organization can access this project with the link
                    </p>
                  </div>
                  <Switch
                    checked={inOrganization}
                    onCheckedChange={handleShareToggle}
                    disabled={isToggling}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <Button
                  onClick={handleShareToggle}
                  disabled={isToggling}
                  variant={inOrganization ? "default" : "outline"}
                  className={`w-full ${
                    inOrganization
                      ? "bg-cyber-gradient hover:opacity-90"
                      : "cyber-border"
                  }`}
                >
                  <Building className="mr-2 h-4 w-4" />
                  {isToggling ? (
                    "Processing..."
                  ) : inOrganization ? (
                    "Disable Organization Access"
                  ) : (
                    "Enable Organization Access"
                  )}
                </Button>

                {inOrganization && (
                  <Button
                    onClick={() => window.open(`/shared/${projectId}`, "_blank")}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    View Shared Project
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "team" && (
          <Card className="bg-background/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-center text-muted-foreground">
                Team member management is coming soon.
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "integrations" && (
          <Card className="bg-background/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-center text-muted-foreground">
                Integration options will be available in a future update.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}