export interface ExtractedFrame {
    dataUrl: string
    timestamp: number
    index: number
  }
  
  export async function extractSparseFrames(
    videoUrl: string,
    framesCount = 5,
    crossOrigin = true,
  ): Promise<ExtractedFrame[]> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video")
      if (crossOrigin) {
        video.crossOrigin = "anonymous"
      }
  
      video.src = videoUrl
      video.muted = true
  
      const frames: ExtractedFrame[] = []
  
      video.onloadedmetadata = () => {
        const duration = video.duration
        const interval = duration / (framesCount + 1)
        let currentFrame = 0
  
        // Create canvas once and reuse
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
  
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }
  
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
  
        // Function to capture a frame at a specific time
        const captureFrame = (time: number) => {
          video.currentTime = time
        }
  
        // When time updates, capture the frame
        video.ontimeupdate = () => {
          // Draw current frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  
          // Convert to data URL
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
  
          // Store frame data
          frames.push({
            dataUrl,
            timestamp: video.currentTime,
            index: currentFrame,
          })
  
          currentFrame++
  
          // If we've captured all frames, resolve
          if (currentFrame >= framesCount) {
            // Sort frames by timestamp to ensure correct order
            frames.sort((a, b) => a.timestamp - b.timestamp)
            resolve(frames)
            return
          }
  
          // Capture next frame
          captureFrame(interval * (currentFrame + 1))
        }
  
        // Start capturing frames
        captureFrame(interval)
      }
  
      video.onerror = () => {
        reject(new Error("Error loading video"))
      }
  
      // Load the video
      video.load()
    })
  }
  
  export function formatTimestamp(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }
  
  