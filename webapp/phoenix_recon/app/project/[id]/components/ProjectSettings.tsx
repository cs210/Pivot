import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

interface ProjectSettingsProps {
  projectId: string;
  projectName: string;
  setProjectName: (name: string) => void;
  handleUpdateProject: () => void;
}

export default function ProjectSettings({
  projectId,
  projectName,
  setProjectName,
  handleUpdateProject,
}: ProjectSettingsProps) {
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

      {/* Project settings content */}
      <div className="md:col-span-9">
        <Card className="bg-background/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="project-name"
                  className="text-white"
                >
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
      </div>
    </div>
  );
}