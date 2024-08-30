"use client";

import React, { useState } from 'react';
import '@/styles/MediaDisplay.css';
import { MediaItem } from '@/data/mediaData'; // Import the type

interface MediaDisplayProps {
  media: MediaItem[];
}

const MediaDisplay: React.FC<MediaDisplayProps> = ({ media }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevClick = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? media.length - 1 : prevIndex - 1
    );
  };

  const handleNextClick = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === media.length - 1 ? 0 : prevIndex + 1
    );
  };

  const currentItem = media[currentIndex];

  return (
    <div className="media-display">
      <button className="arrow prev" onClick={handlePrevClick}>
        &lt;
      </button>

      <div className="media-item">
        {currentItem.type === 'image' ? (
          <img src={currentItem.src} alt={currentItem.alt} className="media-image" />
        ) : (
          <video
            key={currentItem.src}
            controls
            className="media-video"
          >
            <source src={currentItem.src} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {/* <p className="media-description">{currentItem.description}</p> */}

      <button className="arrow next" onClick={handleNextClick}>
        &gt;
      </button>
    </div>
  );
};

export default MediaDisplay;