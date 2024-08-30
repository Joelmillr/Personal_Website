"use client";

import React, { useState } from "react";
import Link from "next/link";
import "@/styles/Header.css"; // Import the CSS file

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <header className="header-container">
      {/* Logo */}
      <div className="flex items-center">
        <h1 className="header-logo">
          <Link href="/" className="hover:underline flex items-center">
            joel miller
            <img
              src="/website_icon.png"
              alt="Website Logo"
              className="header-logo-icon"
            />
          </Link>
        </h1>
      </div>

      {/* Hamburger Menu Icon */}
      <div className="md:hidden">
        <button
          onClick={toggleMenu}
          className="header-hamburger"
          aria-label="Toggle menu"
        >
          {isOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Links for Larger Screens */}
      <nav className="header-nav hidden md:flex space-x-8">
        <Link href="/research" className="hover:underline">
          research
        </Link>
        <Link href="/research" className="hover:underline">
          projects
        </Link>
        <Link href="/Resume.pdf" target="_blank" className="hover:underline">
          resume
        </Link>
      </nav>

      {/* Dropdown Menu for Smaller Screens */}
      {isOpen && (
        <div className="header-dropdown md:hidden">
          <Link href="/research" className="hover:underline" onClick={toggleMenu}>
            research
          </Link>
          <Link href="/research" className="hover:underline" onClick={toggleMenu}>
            projects
          </Link>
          <Link href="/Resume.pdf" target="_blank" className="hover:underline" onClick={toggleMenu}>
            resume
          </Link>
        </div>
      )}
    </header>
  );
}

export default Header;