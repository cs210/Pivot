"use client"

import Link from "next/link"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Video, Trash2 } from "lucide-react"
import VideoUploader from "@/components/video-uploader"
import VideoFrameViewer from "@/components/video-frame-viewer"
import { Header } from "@/components/header"

interface Video {
  id: string
  name: string
  created_at: string
  url: string
  thumbnail?: string
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [activeTab, setActiveTab] = useState("videos")

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setUser(user)
      fetchVideos()
    }

    checkUser()
  }, [router, supabase])

  const fetchVideos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("videos").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setVideos(data || [])
    } catch (error) {
      console.error("Error fetching videos:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleVideoUploadSuccess = () => {
    fetchVideos()
  }

  const handleDeleteVideo = async (id: string) => {
    try {
      // First get the video to get the file path
      const { data: video } = await supabase.from("videos").select("*").eq("id", id).single()

      if (!video) return

      // Delete from storage
      const { error: storageError } = await supabase.storage.from("videos").remove([video.path])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase.from("videos").delete().eq("id", id)

      if (dbError) throw dbError

      // Update the videos list
      setVideos(videos.filter((v) => v.id !== id))
      if (selectedVideo?.id === id) {
        setSelectedVideo(null)
      }
    } catch (error) {
      console.error("Error deleting video:", error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const handleUploadFirstVideo = () => {
    setActiveTab("upload")
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold cyber-glow">Your Video Dashboard</h1>
            <Button onClick={handleSignOut} variant="outline" className="cyber-border">
              Sign Out
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 bg-muted/50 border border-border/50">
              <TabsTrigger
                value="videos"
                className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
                  activeTab === "videos" ? "bg-cyber-gradient text-foreground" : ""
                }`}
              >
                My Videos
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
                  activeTab === "upload" ? "bg-cyber-gradient text-foreground" : ""
                }`}
              >
                Upload Video
              </TabsTrigger>
            </TabsList>

            <TabsContent value="videos">
              {loading ? (
                <div className="text-center py-12">Loading your videos...</div>
              ) : videos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">You haven't uploaded any videos yet.</p>
                  <Button onClick={handleUploadFirstVideo} className="bg-cyber-gradient hover:opacity-90">
                    Upload Your First Video
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
                  <div className="md:col-span-4 space-y-4">
                    <h2 className="text-xl font-semibold mb-4 cyber-glow">Your Videos</h2>
                    {videos.map((video) => (
                      <Card
                        key={video.id}
                        className={`cursor-pointer hover:border-primary transition-colors bg-background/80 backdrop-blur-sm border-border/50 ${selectedVideo?.id === video.id ? "cyber-border" : ""}`}
                        onClick={() => setSelectedVideo(video)}
                      >
                        <CardContent className="p-4 flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <Video className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium text-foreground">{video.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(video.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteVideo(video.id)
                            }}
                            className="hover:bg-destructive/20 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="md:col-span-8">
                    {selectedVideo ? (
                      <div className="space-y-4">
                        <h2 className="text-xl font-semibold cyber-glow">{selectedVideo.name}</h2>
                        <VideoFrameViewer videoUrl={selectedVideo.url} videoName={selectedVideo.name} />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg border-border/50 bg-background/30">
                        <p className="text-muted-foreground">Select a video to play</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload">
              <VideoUploader onUploadSuccess={handleVideoUploadSuccess} userId={user?.id} />
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
            <Link className="text-sm font-medium text-muted-foreground hover:text-foreground" href="#">
              Terms of Service
            </Link>
            <Link className="text-sm font-medium text-muted-foreground hover:text-foreground" href="#">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

