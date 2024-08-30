import React from 'react';
import Container from "@/app/_components/container";
import { Header } from "@/app/_components/header";
import MediaDisplay from "@/app/_components/media-display";
import { media } from '@/data/mediaData'; // Import the media array
import "@/styles/HomePage.css";
import "@/styles/MediaDisplay.css"; // Import the CSS file

export default function Index() {
  return (
    <main>
      <Container>
        <Header />
        <section className="bio-section">
          <div className="bio-content">
            <h1 className="bio-title">About Joel Miller</h1>
            <p className="bio-description">
              I'm Joel Miller, a graduate student at Western University, specializing in the driver takeover process in autonomous vehicles. My research focuses on enhancing the safety and efficiency of autonomous vehicle technologies by developing adaptive systems that support drivers during critical transitions. With a background in Software Engineering and a collaborative specialization in Artificial Intelligence, I aim to push the boundaries of R&D in AI-driven transportation solutions.
            </p>
            <p className="bio-description">
              My journey has taken me through internships at the National Research Council of Canada and IBM, where I gained valuable industry experience. I've also published my first academic article and actively contribute as a reviewer for the Transportation Research Record. In addition to my academic pursuits, I'm passionate about exploring the intersections of heart rate behavior and environmental factors, such as those experienced at intersections.
            </p>
            <p className="bio-description">
              Beyond research, I enjoy working out, connecting with nature, and exploring my interests in space, rockets, and Formula 1. I'm currently building this personal website to showcase my projects and share insights from my work. Welcome to my corner of the web!
            </p>
          </div>

          {/* MediaDisplay Component */}
          <MediaDisplay media={media} />

        </section>
      </Container>
    </main>
  );
}