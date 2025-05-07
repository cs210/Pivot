import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Save, Settings } from "lucide-react";

interface ProjectHeaderProps {
  project: any;
  projectName: string;
  setProjectName: (name: string) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  handleUpdateProjectName: () => void;
  router: any;
}

export default function ProjectHeader({
  project,
  projectName,
  setProjectName,
  isEditing,
  setIsEditing,
  handleUpdateProjectName,
  router,
}: ProjectHeaderProps) {
  return (
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
              onClick={handleUpdateProjectName}
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
            <h1 className="text-3xl font-bold cyber-glow">
              {project?.name}
            </h1>
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
  );
}