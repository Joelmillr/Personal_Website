# Joel Andrew Miller — Personal Website

Personal portfolio website for Joel Andrew Miller, Aerospace Software Engineer at ITPS Canada and M.E.Sc. graduate from Western University. The site showcases research projects and publications in ML, computer vision, and signal processing, and hosts a live demo of a pilot Helmet-Mounted Display (HMD) system developed for aerospace flight test operations.

Live at: [joelandrewmiller.com](https://joelandrewmiller.com)

## Features

- **Portfolio**: Research projects, publications, and work experience
- **Interactive MNIST Demo**: Client-side handwritten digit recognition using TensorFlow.js
- **Flight Test HMD Display**: Live playback of a pilot HMD system driven by recorded flight test data, synchronized to cockpit video — available at `/webdisplay`

## Tech Stack

### Frontend
- HTML5, CSS3, vanilla JavaScript
- [Inter](https://fonts.google.com/specimen/Inter) typeface (Google Fonts)
- TensorFlow.js (MNIST model)

### Backend
- Node.js + Express
- Socket.IO (WebSocket support)
- csv-parse, gl-matrix, compression, dotenv

## Project Structure

```
Personal_Website/
├── public/                  # Main site
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── assets/              # Images, resume PDF
├── flight-display/          # HMD flight test display
│   ├── client/              # Browser-side app
│   ├── server/              # Express API + data processing
│   ├── merged_data.csv      # Recorded flight data
│   ├── youtube_timestamps.json
│   └── README.md            # Flight display documentation
├── server.js                # Main Express server
└── package.json
```

## Getting Started

### Prerequisites

- Node.js ≥ 18

### Install & Run

```bash
git clone https://github.com/Joelmillr/Personal_Website.git
cd Personal_Website
npm install
npm start
```

Open `http://localhost:3000`.

### Flight Display

The HMD display requires a `.env` file in `flight-display/`:

```env
YOUTUBE_VIDEO_ID=your_video_id_here
YOUTUBE_START_OFFSET=0.0
```

Then open `http://localhost:3000/webdisplay`.

See [flight-display/README.md](flight-display/README.md) for full setup and deployment details.

## Author

**Joel Andrew Miller**
- Email: joelmiller0430@gmail.com
- LinkedIn: [joelmillr](https://www.linkedin.com/in/joelmillr/)
- ORCID: [0009-0004-5678-6601](https://orcid.org/0009-0004-5678-6601)
