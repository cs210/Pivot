"use client"

import { useState, useEffect, useRef } from "react"

interface VideoPlayerProps {
  url: string
  name?: string
}

export default function VideoPlayer({ url, name }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPanorama, setIsPanorama] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)
  const youtubePlayer = useRef<any>(null)

  useEffect(() => {
    // Function to extract video ID from various URL formats
    const extractVideoId = (url: string): string | null => {
      try {
        // Handle YouTube URLs
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
          const match = url.match(regExp);
          return (match && match[2].length === 11) ? match[2] : null;
        }
        
        // For direct video URLs, return null to use the native player
        return null;
      } catch (e) {
        console.error("Error extracting video ID:", e);
        return null;
      }
    };

    const videoId = extractVideoId(url);
    
    // Try to load the YouTube API
    const loadYouTubeApi = () => {
      if (!window.YT && videoId) {
        // Load YouTube API
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = initializeYouTubePlayer;
      } else if (window.YT && videoId) {
        // API already loaded
        initializeYouTubePlayer();
      } else {
        // No video ID or not a YouTube URL
        setIsLoading(false);
        if (!url.startsWith('http')) {
          setError("Invalid video URL");
        }
      }
    };
    
    // Initialize YouTube player
    const initializeYouTubePlayer = () => {
      if (!playerRef.current || !videoId) return;
      
      try {
        // Destroy previous player if exists
        if (youtubePlayer.current) {
          youtubePlayer.current.destroy();
        }
        
        // Force panorama/360 mode by adding the appropriate URL parameters
        setIsPanorama(true);
        
        youtubePlayer.current = new window.YT.Player(playerRef.current, {
          videoId: videoId,
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 1,
            modestbranding: 0, // Show full YouTube branding
            rel: 0, 
            showinfo: 1,
            fs: 1, // Enable fullscreen
            controls: 1, // Show controls
            // Parameters for 360° videos
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              setIsLoading(false);
              // Check if video is 360°
              if (event.target.getSphericalProperties) {
                const props = event.target.getSphericalProperties();
                setIsPanorama(!!props);
              }
            },
            onError: (event: any) => {
              console.error("YouTube player error:", event);
              setError("Error loading video");
              setIsLoading(false);
            },
          }
        });
      } catch (err) {
        console.error("Error initializing YouTube player:", err);
        setError(`Failed to initialize player: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };
    
    loadYouTubeApi();
    
    return () => {
      // Clean up YouTube player on unmount
      if (youtubePlayer.current) {
        youtubePlayer.current.destroy();
      }
      
      // Clean up global callback
      if (window.onYouTubeIframeAPIReady === initializeYouTubePlayer) {
        window.onYouTubeIframeAPIReady = null;
      }
    };
  }, [url]);

  // Show native player for direct video URLs
  const isDirectVideo = !url.includes('youtube.com') && !url.includes('youtu.be');

  if (!url) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-black cyber-border p-4 text-white">
        <p>No video available.</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-black cyber-border p-4 text-white">
        <p className="text-red-400">{error}</p>
        <p className="mt-2 text-sm">Please check that the video URL is accessible and in a supported format.</p>
        <p className="mt-2 text-sm break-all">URL: {url}</p>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-1 text-sm text-blue-400 hover:underline break-all"
        >
          Open video in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black cyber-border">
      <div className="aspect-video relative">
        {isDirectVideo ? (
          // Native player for direct video URLs
          <video
            className="w-full h-full"
            controls
            playsInline
            crossOrigin="anonymous"
            onCanPlay={() => setIsLoading(false)}
            onError={() => {
              setError("Error loading video");
              setIsLoading(false);
            }}
          >
            <source src={url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          // YouTube player div
          <div ref={playerRef} className="w-full h-full"></div>
        )}
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white z-10">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
              <p className="mt-2">Loading video...</p>
            </div>
          </div>
        )}
      </div>
      
      {name && (
        <div className="p-2 text-center">
          <span className="text-sm font-medium">{name}</span>
        </div>
      )}
      
      {!isDirectVideo && !isLoading && !isPanorama && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md mt-2">
          <p className="text-sm text-center">
            <strong>Note:</strong> For 360° viewing, please upload your video to YouTube as a 360° video.
          </p>
        </div>
      )}
    </div>
  );
}

// Add TypeScript declarations for YouTube API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
  }
}