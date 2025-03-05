"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Film, ImageIcon, ChevronLeft, ChevronRight, Loader2, Compass } from "lucide-react"
import VideoPlayer from "@/components/video-player"
import PanoramaViewer from "@/components/panorama-viewer"
import { extractSparseFrames, type ExtractedFrame, formatTimestamp } from "@/utils/frame-extractor"

interface VideoFrameViewerProps {
  videoUrl: string
  videoName?: string
  onExtractedFrames?: (frames: ExtractedFrame[]) => void
  initialFrameCount?: number
}

export default function VideoFrameViewer({
  videoUrl,
  videoName,
  onExtractedFrames,
  initialFrameCount = 5,
}: VideoFrameViewerProps) {
  const [activeTab, setActiveTab] = useState("video")
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([])
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [isExtracting, setIsExtracting] = useState(false)
  const [frameCount, setFrameCount] = useState(initialFrameCount)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Reset frames when video URL changes
    setExtractedFrames([])
    setCurrentFrameIndex(0)
  }, [videoUrl])

  const handleExtractFrames = async () => {
    if (!videoUrl) return

    try {
      setIsExtracting(true)
      setError(null)

      const frames = await extractSparseFrames(videoUrl, frameCount)

      setExtractedFrames(frames)
      setCurrentFrameIndex(0)

      if (onExtractedFrames) {
        onExtractedFrames(frames)
      }

      // Switch to frames tab if we have frames
      if (frames.length > 0) {
        setActiveTab("frames")
      }
    } catch (err) {
      console.error("Error extracting frames:", err)
      setError(`Failed to extract frames: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFrameCountChange = (value: number[]) => {
    setFrameCount(value[0])
  }

  const goToNextFrame = () => {
    if (extractedFrames.length === 0) return
    setCurrentFrameIndex((prevIndex) => (prevIndex + 1) % extractedFrames.length)
  }

  const goToPreviousFrame = () => {
    if (extractedFrames.length === 0) return
    setCurrentFrameIndex((prevIndex) => (prevIndex === 0 ? extractedFrames.length - 1 : prevIndex - 1))
  }

  const currentFrame = extractedFrames[currentFrameIndex]

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-muted/50 border border-border/50">
          <TabsTrigger
            value="video"
            className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
              activeTab === "video" ? "bg-cyber-gradient text-foreground" : ""
            }`}
          >
            <Film className="w-4 h-4 mr-2" />
            Video
          </TabsTrigger>
          <TabsTrigger
            value="frames"
            className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
              activeTab === "frames" ? "bg-cyber-gradient text-foreground" : ""
            }`}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Frames
          </TabsTrigger>
          <TabsTrigger
            value="360-view"
            className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
              activeTab === "360-view" ? "bg-cyber-gradient text-foreground" : ""
            }`}
            disabled={extractedFrames.length === 0}
          >
            <Compass className="w-4 h-4 mr-2" />
            360° View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="video" className="space-y-4">
          <Card className="p-0 overflow-hidden cyber-border">
            <VideoPlayer url={videoUrl} name={videoName} />
          </Card>

          <Card className="bg-background/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-lg font-medium">Extract Frames for 360° View</h3>
              <p className="text-sm text-muted-foreground">
                Extract frames from this video to view in 360° mode. Adjust the number of frames to extract.
              </p>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Number of frames: {frameCount}</span>
                </div>
                <Slider
                  value={[frameCount]}
                  min={3}
                  max={20}
                  step={1}
                  onValueChange={handleFrameCountChange}
                  className="[&>span:first-child]:h-1 [&>span:first-child]:bg-muted [&_[role=slider]]:bg-primary [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-cyber-gradient"
                />
              </div>

              <Button
                onClick={handleExtractFrames}
                disabled={isExtracting || !videoUrl}
                className="w-full bg-cyber-gradient hover:opacity-90"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting Frames...
                  </>
                ) : (
                  <>Extract {frameCount} Frames</>
                )}
              </Button>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frames" className="space-y-4">
          {extractedFrames.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No frames have been extracted yet. Go to the Video tab to extract frames.
              </p>
              <Button onClick={() => setActiveTab("video")} className="bg-cyber-gradient hover:opacity-90">
                Go to Video
              </Button>
            </div>
          ) : (
            <>
              <Card className="p-0 overflow-hidden cyber-border">
                <div className="aspect-video relative">
                  <img
                    src={currentFrame.dataUrl || "/placeholder.svg"}
                    alt={`Frame ${currentFrameIndex + 1}`}
                    className="w-full h-full object-contain bg-black"
                  />

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={goToPreviousFrame}
                          className="text-white hover:bg-white/10"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>

                        <span className="text-sm">
                          Frame {currentFrameIndex + 1} / {extractedFrames.length} (
                          {formatTimestamp(currentFrame.timestamp)})
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={goToNextFrame}
                          className="text-white hover:bg-white/10"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("360-view")}
                        className="text-white border-white/30 hover:bg-white/10 text-xs"
                      >
                        View in 360°
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-5 gap-2">
                {extractedFrames.map((frame, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentFrameIndex(index)}
                    className={`cursor-pointer aspect-video overflow-hidden rounded border-2 ${
                      currentFrameIndex === index ? "border-primary" : "border-transparent hover:border-muted"
                    }`}
                  >
                    <img
                      src={frame.dataUrl || "/placeholder.svg"}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="360-view" className="space-y-4">
          {extractedFrames.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No frames have been extracted yet. Go to the Video tab to extract frames.
              </p>
              <Button onClick={() => setActiveTab("video")} className="bg-cyber-gradient hover:opacity-90">
                Go to Video
              </Button>
            </div>
          ) : (
            <>
              <PanoramaViewer frames={extractedFrames} initialFrameIndex={currentFrameIndex} />

              <div className="p-4 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50">
                <h3 className="text-lg font-medium mb-2">360° Navigation Instructions</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Click and drag to look around in 360°</li>
                  <li>• Use the timeline or arrow buttons to move between frames</li>
                  <li>• Click the reset button to return to the center view</li>
                  <li>• Use fullscreen for an immersive experience</li>
                </ul>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

