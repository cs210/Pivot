import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  Grid,
  List,
  Box,
  Loader2,
} from "lucide-react";
import { Panorama } from "../../../hooks/usePanoramas";

interface PanoramaGridProps {
  panoramas: Panorama[];
  selectedPanoramas: string[];
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  uploading: boolean;
  processing: boolean;
  panoramaFileInputRef: React.RefObject<HTMLInputElement>;
  togglePanoramaSelection: (panoramaId: string) => void;
  handlePanoramaUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeletePanorama: (panoramaId: string, showAlert?: boolean) => void;
  setPanoramaToRename: (panorama: Panorama | null) => void;
  setNewPanoramaName: (name: string) => void;
  setRenamePanoramaDialogOpen: (open: boolean) => void;
  setGenerate360DialogOpen: (open: boolean) => void;
  getProjectPanoramas: () => Panorama[];
}

export default function PanoramaGrid({
  panoramas,
  selectedPanoramas,
  viewMode,
  setViewMode,
  uploading,
  processing,
  panoramaFileInputRef,
  togglePanoramaSelection,
  handlePanoramaUpload,
  handleDeletePanorama,
  setPanoramaToRename,
  setNewPanoramaName,
  setRenamePanoramaDialogOpen,
  setGenerate360DialogOpen,
  getProjectPanoramas,
}: PanoramaGridProps) {
  // Determine which panoramas to show based on currentFolder
  const panoramasToShow = getProjectPanoramas();

  return (
    <div className="md:col-span-9">
      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {"All 360° Images"}
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setViewMode(viewMode === "grid" ? "list" : "grid")
                }
                title={
                  viewMode === "grid"
                    ? "Switch to list view"
                    : "Switch to grid view"
                }
                className="bg-cyber-gradient hover:opacity-90"
              >
                {viewMode === "grid" ? (
                  <List className="h-4 w-4" />
                ) : (
                  <Grid className="h-4 w-4" />
                )}
              </Button>

              {/* Generate 360 Images button */}
              <Button
                variant="outline"
                onClick={() => setGenerate360DialogOpen(true)}
                disabled={processing}
                className="bg-cyber-gradient hover:opacity-90"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Box className="mr-2 h-4 w-4" />
                    Generate 360° Images
                  </>
                )}
              </Button>

              {/* Panorama upload button */}
              <Button
                className="bg-cyber-gradient hover:opacity-90"
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                <label className="cursor-pointer">
                  Upload 360° Images
                  <input
                    ref={panoramaFileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={handlePanoramaUpload}
                    disabled={uploading}
                  />
                </label>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {uploading || processing ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {uploading
                  ? "Uploading images..."
                  : "Processing 360° images..."}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {panoramasToShow.map((panorama) => (
                <Card
                  key={panorama.id}
                  className={`cursor-pointer overflow-hidden hover:border-primary transition-colors ${
                    selectedPanoramas.includes(panorama.id)
                      ? "border-2 border-primary"
                      : "border-border/50"
                  }`}
                  onClick={() => togglePanoramaSelection(panorama.id)}
                >
                  <div className="aspect-square relative">
                    <img
                      src={panorama.url}
                      alt={panorama.name}
                      className="object-cover w-full h-full"
                    />
                    {panorama.is_processing && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-background/70 p-2 text-xs truncate">
                      {panorama.name}
                      {panorama.is_processing && " (Processing)"}
                    </div>
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 bg-background/50"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setPanoramaToRename(panorama);
                              setNewPanoramaName(panorama.name);
                              setRenamePanoramaDialogOpen(true);
                            }}
                            disabled={panorama.is_processing}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePanorama(panorama.id);
                            }}
                            disabled={panorama.is_processing}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {panoramasToShow.map((panorama) => (
                <div
                  key={panorama.id}
                  className={`flex items-center p-2 rounded border ${
                    selectedPanoramas.includes(panorama.id)
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:bg-muted/20"
                  }`}
                  onClick={() => togglePanoramaSelection(panorama.id)}
                >
                  <div className="h-10 w-10 mr-4 overflow-hidden rounded">
                    <img
                      src={panorama.url}
                      alt={panorama.name}
                      className="object-cover w-full h-full"
                    />
                    {panorama.is_processing && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 truncate">
                    {panorama.name}
                    {panorama.is_processing && " (Processing)"}
                  </div>
                  <div className="flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setPanoramaToRename(panorama);
                            setNewPanoramaName(panorama.name);
                            setRenamePanoramaDialogOpen(true);
                          }}
                          disabled={panorama.is_processing}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePanorama(panorama.id);
                          }}
                          disabled={panorama.is_processing}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}

          {panoramasToShow.length === 0 && (
            <div className="text-center py-12">
              <Box className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No 360° images found. Upload or generate some images to get
                started.
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setGenerate360DialogOpen(true)}
                >
                  <Box className="mr-2 h-4 w-4" />
                  Generate from Images
                </Button>
                <Button className="bg-cyber-gradient hover:opacity-90">
                  <Upload className="mr-2 h-4 w-4" />
                  <label className="cursor-pointer">
                    Upload 360° Images
                    <input
                      ref={panoramaFileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={handlePanoramaUpload}
                    />
                  </label>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
