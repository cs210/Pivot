"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Maximize, Minimize, Play, Pause } from "lucide-react"
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

interface VideoPlayerProps {
  url: string
  name?: string
}

export default function VideoPlayer({ url, name }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!videoRef.current || !url) return
    
    const handleCanPlay = () => {
      console.log("Video can play")
      setIsLoading(false)
    }
    
    const handleError = () => {
      console.error("Video error:", videoRef.current?.error)
      setIsLoading(false)
      setError(`Error loading video: ${videoRef.current?.error?.message || 'Unknown error'}`)
      
      // Try to provide more diagnostic information
      if (videoRef.current?.error) {
        const mediaError = videoRef.current.error;
        const errorDetails = {
          code: mediaError.code,
          // 1: MEDIA_ERR_ABORTED - fetching process aborted by user
          // 2: MEDIA_ERR_NETWORK - error occurred when downloading
          // 3: MEDIA_ERR_DECODE - error occurred when decoding
          // 4: MEDIA_ERR_SRC_NOT_SUPPORTED - audio/video not supported
          message: mediaError.message
        };
        console.error("Media error details:", errorDetails);
      }
    }
    
    // Initialize Plyr
    try {
      videoRef.current.addEventListener('canplay', handleCanPlay)
      videoRef.current.addEventListener('error', handleError)
      
      const plyr = new Plyr(videoRef.current, {
        controls: [
          'play-large', 'play', 'progress', 'current-time', 
          'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'
        ],
        seekTime: 10,
        hideControls: false,
        ratio: '16:9'
      })
      
      playerRef.current = plyr
      
      plyr.on('ready', () => {
        console.log("Plyr is ready")
      })
      
      plyr.on('error', (event) => {
        console.error("Plyr error:", event)
      })
    } catch (err) {
      console.error("Error initializing Plyr:", err)
      setError(`Error initializing player: ${err instanceof Error ? err.message : String(err)}`)
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('canplay', handleCanPlay)
        videoRef.current.removeEventListener('error', handleError)
      }
      
      if (playerRef.current) {
        playerRef.current.destroy()
      }
    }
  }, [url])

  if (!url) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-black cyber-border p-4 text-white">
        <p>No video available.</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-black cyber-border p-4 text-white">
        <p className="text-red-400">{error}</p>
        <p className="mt-2 text-sm">Please check that the video URL is accessible and in a supported format.</p>
        <p className="mt-2 text-sm break-all">URL: {url}</p>
        <p className="mt-4 text-sm">Try accessing the video directly:</p>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-1 text-sm text-blue-400 hover:underline break-all"
        >
          Open video in new tab
        </a>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className="relative w-full overflow-hidden rounded-lg bg-black cyber-border"
    >
      <div className="aspect-video relative">
        <video
          ref={videoRef}
          className="w-full h-full plyr"
          playsInline
          controls
          crossOrigin="anonymous"
        >
          <source src={url} type="video/mp4" />
          {/* Add more source elements for different formats if needed */}
          Your browser does not support the video tag.
        </video>
        
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
    </div>
  )
}