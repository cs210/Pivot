import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  Grid,
  List,
  Box,
  Loader2,
  Wand2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Panorama } from "../../../../../../hooks/usePanoramas";
import BlurWorkerURL from "@/workers/blurWorker.ts?worker"; // vite / next 14+

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
  /* ------------------------------------------------------------------ */
  /* -----------------------  BLUR & REDACT --------------------------- */
  /* ------------------------------------------------------------------ */
  const supabase = createClient();
  const [redactDialogOpen, setRedactDialogOpen] = useState(false);
  const [redactTarget, setRedactTarget] = useState<Panorama | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null); // visible canvas
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  const [scale, setScale] = useState(1); // display-scale factor
  const [rects, setRects] = useState<
    { x: number; y: number; w: number; h: number }[]
  >([]);

  const [drawing, setDrawing] = useState(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [saving, setSaving] = useState(false);
  const [blurredUrls, setBlurredUrls] = useState<Record<string, string>>({});

  const panoramasToShow = getProjectPanoramas();

  /* ------------------  CANVAS DRAW HELPERS ------------------ */
  const blurRect = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    r: { x: number; y: number; w: number; h: number },
    scaleFactor = 1
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.filter = "blur(10px)";
    ctx.drawImage(
      img,
      r.x / scaleFactor,
      r.y / scaleFactor,
      r.w / scaleFactor,
      r.h / scaleFactor,
      r.x,
      r.y,
      r.w,
      r.h
    );
    ctx.restore();

    // outline
    ctx.save();
    ctx.strokeStyle = "white";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  };

  const redraw = useCallback(
    (preview?: { x: number; y: number; w: number; h: number } | null) => {
      if (!canvasRef.current || !imgEl) return;
      const ctx = canvasRef.current.getContext("2d")!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(
        imgEl,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      rects.forEach((r) => blurRect(ctx, imgEl, r, scale));
      if (preview) blurRect(ctx, imgEl, preview, scale);
    },
    [imgEl, rects, scale]
  );

  /* ----------------  DIALOG OPEN & IMAGE LOAD ---------------- */
  const openRedactor = (p: Panorama) => {
    setRects([]);
    setRedactTarget(p);
    setRedactDialogOpen(true);
  };

  useEffect(() => {
    if (!redactDialogOpen || !redactTarget) return;
    let objectURL = "";

    const fetchAndLoad = async () => {
      const res = await fetch(redactTarget.url ?? "", { mode: "cors" });
      const blob = await res.blob();
      objectURL = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const maxDisplay = 800;
        const sc = img.width > maxDisplay ? maxDisplay / img.width : 1;
        setScale(sc);

        if (canvasRef.current) {
          canvasRef.current.width = img.width * sc;
          canvasRef.current.height = img.height * sc;
        }

        setImgEl(img);
        redraw();
      };
      img.src = objectURL;
    };

    fetchAndLoad();
    return () => {
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [redactDialogOpen, redactTarget, redraw]);

  /* -------------------  MOUSE HANDLERS ---------------------- */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    startPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !canvasRef.current) return;
    const rectCanvas = canvasRef.current.getBoundingClientRect();
    const curr = {
      x: e.clientX - rectCanvas.left,
      y: e.clientY - rectCanvas.top,
    };
    const preview = {
      x: Math.min(startPos.current.x, curr.x),
      y: Math.min(startPos.current.y, curr.y),
      w: Math.abs(curr.x - startPos.current.x),
      h: Math.abs(curr.y - startPos.current.y),
    };
    redraw(preview);
  };

  const handleMouseUp = () => {
    if (!drawing) return;
    setDrawing(false);
    setRects((prev) => [...prev, prevPreview.current!]);
    redraw();
  };

  // keep track of current preview rectangle
  const prevPreview = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  useEffect(() => {
    if (!drawing) prevPreview.current = null;
  }, [drawing]);

  /* -------------------  SAVE BLURRED IMAGE ------------------ */
  const handleSave = async () => {
    if (!redactTarget) return;
    setSaving(true);

    try {
      // fetch original JPEG once (as Blob) so CORS isn’t an issue
      const originalBlob = await (await fetch(redactTarget.url!)).blob();

      // spin up worker
      const worker = new Worker(new URL(BlurWorkerURL, import.meta.url));
      worker.postMessage({
        imageBlob: originalBlob,
        rects: rects.map((r) => ({
          x: Math.round(r.x / scale),
          y: Math.round(r.y / scale),
          w: Math.round(r.w / scale),
          h: Math.round(r.h / scale),
        })),
      });

      worker.onmessage = async (ev) => {
        const { blob } = ev.data as { blob: Blob };

        const bucket = redactTarget.is_public
          ? "panoramas-public"
          : "panoramas-private";

        await supabase.storage
          .from(bucket)
          .upload(redactTarget.storage_path, blob, {
            upsert: true,
            contentType: "image/jpeg",
          });

        // cache-bust & refresh UI
        const ts = Date.now();
        const newUrl = redactTarget.is_public
          ? supabase.storage
              .from(bucket)
              .getPublicUrl(redactTarget.storage_path).data.publicUrl +
            `?t=${ts}`
          : (
              await supabase.storage
                .from(bucket)
                .createSignedUrl(redactTarget.storage_path, 3600)
            ).data!.signedUrl + `&t=${ts}`;

        setBlurredUrls((prev) => ({ ...prev, [redactTarget.id]: newUrl }));
        setRedactDialogOpen(false);
        setSaving(false);
        worker.terminate();
      };
    } catch (err) {
      console.error(err);
      alert("Failed to save blurred image");
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* -------------------  MAIN COMPONENT UI --------------------------- */
  /* ------------------------------------------------------------------ */
  return (
    <div className="w-full">
      {/* ---------- main card ---------- */}
      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{"All 360° Images"}</CardTitle>
            <div className="flex space-x-2">
              {/* view toggle */}
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

              {/* generate button */}
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

              {/* upload */}
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

        {/* ---------- main content ---------- */}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
                  <div className="relative w-full pt-[100%]">
                    <div className="absolute inset-0">
                      <img
                        src={
                          blurredUrls[panorama.id] ??
                          panorama.thumbnail_url ??
                          panorama.url ??
                          ""
                        }
                        alt={panorama.name}
                        className="object-cover w-full h-full"
                      />
                      {panorama.is_processing && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-background/70 p-2 text-xs truncate">
                      {panorama.name}
                      {panorama.is_processing && " (Processing)"}
                    </div>
                    {/* ---- dropdown ---- */}
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

                          {/* NEW OPTION */}
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openRedactor(panorama);
                            }}
                            disabled={panorama.is_processing}
                          >
                            <Wand2 className="mr-2 h-4 w-4" />
                            Blur&nbsp;&amp;&nbsp;Redact
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
            // ---------- list view ----------
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
                      src={
                        blurredUrls[panorama.id] ??
                        panorama.thumbnail_url ??
                        panorama.url ??
                        ""
                      }
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

                        {/* NEW OPTION (list view) */}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openRedactor(panorama);
                          }}
                          disabled={panorama.is_processing}
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          Blur&nbsp;&amp;&nbsp;Redact
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

          {/* empty-state */}
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

      {/* -----------------  REDACTION DIALOG  ----------------- */}
      <Dialog open={redactDialogOpen} onOpenChange={setRedactDialogOpen}>
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Blur &amp; Redact</DialogTitle>
          </DialogHeader>

          <div className="w-full overflow-auto">
            <canvas
              ref={canvasRef}
              className="border rounded shadow max-w-full cursor-crosshair select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          </div>

          <DialogFooter className="space-x-2">
            <Button
              variant="secondary"
              onClick={() => setRedactDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-cyber-gradient hover:opacity-90"
              disabled={rects.length === 0 || saving}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Image"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
