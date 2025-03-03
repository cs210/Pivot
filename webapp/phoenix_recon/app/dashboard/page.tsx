"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Trash2 } from "lucide-react";
import VideoUploader from "@/components/video-uploader";
import VideoPlayer from "@/components/video-player";

interface Video {
  id: string;
  name: string;
  created_at: string;
  url: string;
  thumbnail?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

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
      fetchVideos();
    };

    checkUser();
  }, [router, supabase]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error("Error fetching videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUploadSuccess = () => {
    fetchVideos();
  };

  const handleDeleteVideo = async (id: string) => {
    try {
      // First get the video to get the file path
      const { data: video } = await supabase
        .from("videos")
        .select("*")
        .eq("id", id)
        .single();

      if (!video) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("videos")
        .remove([video.path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("videos")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      // Update the videos list
      setVideos(videos.filter((v) => v.id !== id));
      if (selectedVideo?.id === id) {
        setSelectedVideo(null);
      }
    } catch (error) {
      console.error("Error deleting video:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleUploadFirstVideo = () => {
    const uploadTab = document.querySelector(
      '[data-state="inactive"][data-value="upload"]'
    ) as HTMLButtonElement;
    if (uploadTab) {
      uploadTab.click();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Video Dashboard</h1>
        <Button onClick={handleSignOut} variant="outline">
          Sign Out
        </Button>
      </div>

      <Tabs defaultValue="videos" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="videos">My Videos</TabsTrigger>
          <TabsTrigger value="upload">Upload Video</TabsTrigger>
        </TabsList>

        <TabsContent value="videos">
          {loading ? (
            <div className="text-center py-12">Loading your videos...</div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                You haven't uploaded any videos yet.
              </p>
              <Button onClick={handleUploadFirstVideo}>
                Upload Your First Video
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
              <div className="md:col-span-4 space-y-4">
                <h2 className="text-xl font-semibold mb-4">Your Videos</h2>
                {videos.map((video) => (
                  <Card
                    key={video.id}
                    className={`cursor-pointer hover:border-primary transition-colors ${
                      selectedVideo?.id === video.id ? "border-primary" : ""
                    }`}
                    onClick={() => setSelectedVideo(video)}
                  >
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <Video className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="font-medium">{video.name}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(video.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVideo(video.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="md:col-span-8">
                {selectedVideo ? (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold">
                      {selectedVideo.name}
                    </h2>
                    <VideoPlayer url={selectedVideo.url} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <p className="text-gray-500">Select a video to play</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload">
          <VideoUploader
            onUploadSuccess={handleVideoUploadSuccess}
            userId={user?.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
