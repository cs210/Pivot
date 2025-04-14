import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";
import { Folder } from "../../../hooks/useFolders";

interface FolderSidebarProps {
  folders: Folder[];
  currentFolder: Folder | null;
  setCurrentFolder: (folder: Folder | null) => void;
  setFolderToRename: (folder: Folder | null) => void;
  setNewFolderName: (name: string) => void;
  setRenameFolderDialogOpen: (open: boolean) => void;
  setCreateFolderDialogOpen: (open: boolean) => void;
  handleDeleteFolder: (folderId: string) => void;
}

export default function FolderSidebar({
  folders,
  currentFolder,
  setCurrentFolder,
  setFolderToRename,
  setNewFolderName,
  setRenameFolderDialogOpen,
  setCreateFolderDialogOpen,
  handleDeleteFolder,
}: FolderSidebarProps) {
  return (
    <div className="md:col-span-3">
      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Folders</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCreateFolderDialogOpen(true)}
          >
            <FolderPlus className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <nav className="flex flex-col space-y-1">
            <Button
              variant={currentFolder === null ? "default" : "ghost"}
              className={`justify-start ${
                currentFolder === null ? "bg-cyber-gradient" : ""
              }`}
              onClick={() => setCurrentFolder(null)}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              All 360° Images
            </Button>
            {folders.map((folder) => (
              <div key={folder.id} className="flex items-center">
                <Button
                  variant={
                    currentFolder?.id === folder.id ? "default" : "ghost"
                  }
                  className={`justify-start flex-1 ${
                    currentFolder?.id === folder.id ? "bg-cyber-gradient" : ""
                  }`}
                  onClick={() => setCurrentFolder(folder)}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {folder.name}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setFolderToRename(folder);
                        setNewFolderName(folder.name);
                        setRenameFolderDialogOpen(true);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteFolder(folder.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
