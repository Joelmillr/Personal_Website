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

        {/* Main Content Section */}
        <section className="main-content-section">
          <div className="content-columns">

            {/* Intro */}
            <div className="bio-content">
                <h1 className="bio-title">hi!</h1>
              {/* Bio */}
              <p className="bio-description">
                Welcome to my corner of the web!
              </p>
              <p className="bio-description">
                Currently I am a graduate student at Western University, working towards my M.E.Sc. in Software Engineering with a specialization in Artificial Intelligence.
                I wanted to create a space where I could share projects, experience, and research with others. I am passionate about software development, machine learning, and data science.
              </p>
            </div>

            {/* MediaDisplay Component */}
            <MediaDisplay media={media} />
            
          </div>
        </section>

      </Container>
    </main>
  );
}