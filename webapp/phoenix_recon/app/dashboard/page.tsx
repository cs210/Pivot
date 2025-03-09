"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Trash2, Image as ImageIcon, Grid } from "lucide-react";
import VideoUploader from "@/components/video-uploader";
import VideoFrameViewer from "@/components/video-frame-viewer";
import { Header } from "@/components/header";
import ImageUploader from "@/components/image-uploader";
import { StorageCheck } from "@/components/storage-check";
import { EnhancedImageGrid } from "@/components/enhanced-image-grid";

interface Video {
  id: string;
  name: string;
  created_at: string;
  url: string;
  thumbnail?: string;
}

interface Image {
  id: string;
  name: string;
  created_at: string;
  url: string;
  path: string;
}

interface GridItem {
  id: string;
  imageId: string | null;
  position: number;
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [videos, setVideos] = useState<Video[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [activeTab, setActiveTab] = useState("videos");
  const [gridItems, setGridItems] = useState<GridItem[]>(
    Array(9)
      .fill(null)
      .map((_, i) => ({
        id: `grid-${i}`,
        imageId: null,
        position: i,
      }))
  );

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
      fetchImages();
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

  const fetchImages = async () => {
    try {
      setImageLoading(true);

      // First check if the images table exists
      const { error: tableCheckError } = await supabase
        .from("images")
        .select("count")
        .limit(1)
        .single();

      if (tableCheckError && tableCheckError.code === "PGRST116") {
        console.warn(
          "Images table doesn't exist yet. Creating empty images array."
        );
        setImages([]);
        return;
      }

      // If table exists, proceed with fetching images
      const { data, error } = await supabase
        .from("images")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error("Error fetching images:", error);
      // Set images to empty array to prevent further errors
      setImages([]);
    } finally {
      setImageLoading(false);
    }
  };

  const handleVideoUploadSuccess = () => {
    fetchVideos();
  };

  const handleImageUploadSuccess = () => {
    fetchImages();
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

  const handleDeleteImage = async (id: string) => {
    try {
      // First get the image to get the file path
      const { data: image } = await supabase
        .from("images")
        .select("*")
        .eq("id", id)
        .single();

      if (!image) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("images")
        .remove([image.path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("images")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      // Update the images list
      setImages(images.filter((img) => img.id !== id));
      if (selectedImage?.id === id) {
        setSelectedImage(null);
      }

      // Remove image from any grid items
      setGridItems(
        gridItems.map((item) =>
          item.imageId === id ? { ...item, imageId: null } : item
        )
      );
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleUploadFirstVideo = () => {
    setActiveTab("upload");
  };

  const handleUploadFirstImage = () => {
    setActiveTab("upload-image");
  };

  const handleDrop = (imageId: string, gridPosition: number) => {
    // Update the grid item at the specified position with the image ID
    setGridItems(
      gridItems.map((item) =>
        item.position === gridPosition ? { ...item, imageId } : item
      )
    );
  };

  const handleRemoveFromGrid = (position: number) => {
    setGridItems(
      gridItems.map((item) =>
        item.position === position ? { ...item, imageId: null } : item
      )
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <StorageCheck />
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold cyber-glow">Your Dashboard</h1>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="cyber-border"
            >
              Sign Out
            </Button>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-6 bg-muted/50 border border-border/50">
              <TabsTrigger
                value="videos"
                className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
                  activeTab === "videos"
                    ? "bg-cyber-gradient text-foreground"
                    : ""
                }`}
              >
                My Videos
              </TabsTrigger>
              <TabsTrigger
                value="images"
                className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
                  activeTab === "images"
                    ? "bg-cyber-gradient text-foreground"
                    : ""
                }`}
              >
                My Images
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
                  activeTab === "upload"
                    ? "bg-cyber-gradient text-foreground"
                    : ""
                }`}
              >
                Upload Video
              </TabsTrigger>
              <TabsTrigger
                value="upload-image"
                className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
                  activeTab === "upload-image"
                    ? "bg-cyber-gradient text-foreground"
                    : ""
                }`}
              >
                Upload Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="videos">
              {loading ? (
                <div className="text-center py-12">Loading your videos...</div>
              ) : videos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    You haven't uploaded any videos yet.
                  </p>
                  <Button
                    onClick={handleUploadFirstVideo}
                    className="bg-cyber-gradient hover:opacity-90"
                  >
                    Upload Your First Video
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
                  <div className="md:col-span-4 space-y-4">
                    <h2 className="text-xl font-semibold mb-4 cyber-glow">
                      Your Videos
                    </h2>
                    {videos.map((video) => (
                      <Card
                        key={video.id}
                        className={`cursor-pointer hover:border-primary transition-colors bg-background/80 backdrop-blur-sm border-border/50 ${
                          selectedVideo?.id === video.id ? "cyber-border" : ""
                        }`}
                        onClick={() => setSelectedVideo(video)}
                      >
                        <CardContent className="p-4 flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <Video className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium text-foreground">
                                {video.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(
                                  video.created_at
                                ).toLocaleDateString()}
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
                        <h2 className="text-xl font-semibold cyber-glow">
                          {selectedVideo.name}
                        </h2>
                        <VideoFrameViewer
                          videoUrl={selectedVideo.url}
                          videoName={selectedVideo.name}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg border-border/50 bg-background/30">
                        <p className="text-muted-foreground">
                          Select a video to play
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="images">
              {imageLoading ? (
                <div className="text-center py-12">Loading your images...</div>
              ) : images.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    You haven't uploaded any images yet.
                  </p>
                  <Button
                    onClick={handleUploadFirstImage}
                    className="bg-cyber-gradient hover:opacity-90"
                  >
                    Upload Your First Image
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
                  <div className="md:col-span-4 space-y-4">
                    <h2 className="text-xl font-semibold mb-4 cyber-glow">
                      Your Images
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag any image card to the grid on the right
                    </p>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                      {images.map((image) => (
                        <Card
                          key={image.id}
                          className={`cursor-grab hover:border-primary transition-colors bg-background/80 backdrop-blur-sm border-border/50 ${
                            selectedImage?.id === image.id ? "cyber-border" : ""
                          }`}
                          onClick={() => setSelectedImage(image)}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("imageId", image.id);
                            setSelectedImage(image);
                          }}
                        >
                          <CardContent className="p-4 flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <img
                                src={image.url}
                                alt={image.name}
                                className="h-16 w-16 object-cover rounded-md"
                                draggable={false} // Prevent default image drag behavior
                              />
                              <div>
                                <p className="font-medium text-foreground">
                                  {image.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(
                                    image.created_at
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation(); // Stop card click
                                e.preventDefault(); // Prevent drag start
                                handleDeleteImage(image.id);
                              }}
                              className="hover:bg-destructive/20 hover:text-destructive"
                              draggable={false} // Prevent button from being draggable
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-8">
                    <EnhancedImageGrid
                      images={images}
                      initialGridItems={gridItems}
                      onGridChange={(newGridItems) =>
                        setGridItems(newGridItems)
                      }
                    />

                    {selectedImage && (
                      <div className="mt-6">
                        <h3 className="text-lg font-medium mb-3">
                          Selected Image: {selectedImage.name}
                        </h3>
                        <div className="border border-border rounded-lg overflow-hidden">
                          <img
                            src={selectedImage.url}
                            alt={selectedImage.name}
                            className="w-full object-contain max-h-[300px]"
                          />
                        </div>
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

            <TabsContent value="upload-image">
              <ImageUploader
                onUploadSuccess={handleImageUploadSuccess}
                userId={user?.id}
              />
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
