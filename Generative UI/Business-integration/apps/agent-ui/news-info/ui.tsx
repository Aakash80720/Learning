import React, { useState, useRef, useCallback, useEffect } from 'react';
import './styles.css';

interface YouTubeVideoProps {
  videoId: string;
  title: string;
  isVisible: boolean;
}

function YouTubeVideo({ videoId, title, isVisible }: YouTubeVideoProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      setIsFullscreen(false);
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // YouTube embed URL with parameters
  const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&fs=1&enablejsapi=1`;
  
  return (
    <div 
      ref={containerRef}
      className={`video-player-container ${isFullscreen ? 'fullscreen' : ''}`}
    >
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        className="youtube-iframe"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        loading="lazy"
      />
      
      {/* Fullscreen toggle button */}
      <button 
        className="fullscreen-btn"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
        )}
      </button>

      {/* Video title overlay */}
      <div className="video-title-overlay">
        <h3>{title}</h3>
      </div>
    </div>
  );
}

export interface VideoData {
  id: string;
  videoId: string;
  title: string;
}

export interface YouTubeCarouselProps {
  videos: VideoData[];
  autoplay?: boolean;
}

export function YouTubeCarousel({
  videos,
}: YouTubeCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  }, [videos.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
  }, [videos.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const currentVideo = videos[currentIndex];

  return (
    <div className="netflix-carousel-wrapper">
      {/* Header */}
      <div className="carousel-header">
        <h2 className="carousel-title">
          Trending Videos
        </h2>
        <span className="video-counter">
          {currentIndex + 1} / {videos.length}
        </span>
      </div>

      {/* Main video player - takes full width */}
      <div className="main-video-section">
        {/* Previous button */}
        <button 
          className="nav-btn prev" 
          onClick={prevSlide}
          aria-label="Previous video"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>

        {/* Video container */}
        <div className="video-wrapper">
          <YouTubeVideo
            key={currentVideo.videoId}
            videoId={currentVideo.videoId}
            title={currentVideo.title}
            isVisible={true}
          />
        </div>

        {/* Next button */}
        <button 
          className="nav-btn next" 
          onClick={nextSlide}
          aria-label="Next video"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="thumbnail-strip">
        {videos.map((video, index) => (
          <button
            key={video.id}
            className={`thumbnail-item ${index === currentIndex ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
            aria-label={`Play ${video.title}`}
          >
            <img 
              src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
              alt={video.title}
              className="thumbnail-img"
            />
            <div className="thumbnail-overlay">
              <span className="thumbnail-number">{index + 1}</span>
            </div>
            {index === currentIndex && (
              <div className="now-playing-indicator">
                <span>Now Playing</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Progress dots */}
      <div className="progress-dots">
        {videos.map((_, index) => (
          <button
            key={index}
            className={`dot ${index === currentIndex ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
            aria-label={`Go to video ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
