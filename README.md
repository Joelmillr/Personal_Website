# Personal Portfolio Website

A retro early-internet styled personal portfolio website showcasing research projects, experience, and interactive demos in Machine Learning, Computer Vision, and Signal Processing.

## 🎨 Design Philosophy

This website features a **retro early-internet aesthetic** (1990s-early 2000s) while maintaining modern functionality and accessibility. The design emphasizes:

- **Polished Retro**: Captures the charm of early web design without broken elements
- **Basic HTML First**: Relies primarily on semantic HTML with minimal CSS complexity
- **Consistent Styling**: Unified design language across main site and webdisplay
- **Functional**: All current functionality maintained while updating aesthetics

## 🚀 Features

- **Personal Portfolio**: Showcases research projects, publications, and experience
- **Interactive MNIST Demo**: Hand-drawn digit recognition using TensorFlow.js
- **Flight Test Display**: Real-time flight data visualization with synchronized video playback
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Accessibility**: WCAG-compliant with keyboard navigation and screen reader support

## 🛠️ Tech Stack

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Retro styling with CSS variables
- **JavaScript**: Vanilla JS for interactions
- **TensorFlow.js**: MNIST digit recognition model

### Backend
- **Node.js**: Express server
- **Socket.IO**: Real-time WebSocket communication
- **csv-parse**: CSV data processing
- **gl-matrix**: Quaternion math for flight data

## 📁 Project Structure

```
Personal_Website/
├── public/                 # Main website files
│   ├── index.html         # Main HTML
│   ├── styles.css         # Retro CSS styling
│   ├── script.js          # JavaScript functionality
│   └── assets/            # Images and PDFs
├── flight-display/        # Flight test display application
│   ├── client/           # Client-side files
│   ├── server/           # Node.js server modules
│   └── merged_data.csv   # Flight data
├── server.js              # Main Express server
└── package.json           # Dependencies
```

## 🎨 Design System

### Color Palette

The website uses a muted retro color palette for better readability:

```css
/* Primary Background */
--bg-primary: #E8E8E8;        /* Light Gray */
--bg-secondary: #D0D0D0;       /* Medium Gray */

/* Accent Colors */
--accent-green: #4CAF50;       /* Muted Green */
--accent-green-bright: #66BB6A; /* Lighter Green */
--accent-yellow: #FFC107;       /* Amber Yellow */
--accent-magenta: #9C27B0;     /* Muted Magenta */
--accent-cyan: #00BCD4;         /* Muted Cyan */

/* Text Colors */
--text-dark: #212121;           /* Dark Gray */
--text-light: #FFFFFF;          /* White */

/* Link Colors */
--link-unvisited: #66BB6A;      /* Lighter Green */
--link-visited: #4CAF50;        /* Muted Green */
--link-hover: #FFC107;          /* Amber Yellow */
```

### Typography

- **Primary Font**: `Courier New`, `Courier`, `monospace` (retro terminal feel)
- **Secondary Font**: `Times New Roman`, `Times`, `serif` (classic web)
- **Headings**: Bold, uppercase, larger sizes with letter spacing

### Visual Elements

- **3D Beveled Borders**: `border: 3px outset` / `border: 3px inset` for retro button/panel effects
- **Simple Animations**: CSS keyframes for blinking text
- **High Contrast**: Dark text on light backgrounds for readability
- **Retro Boxes**: Panels with 3D borders and subtle shadows

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Joelmillr/Personal_Website.git
cd Personal_Website
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (for flight-display):
```bash
# Create flight-display/.env file
cd flight-display
cp env.example .env  # Edit with your YouTube video ID if needed
```

4. Start the development server:
```bash
npm start
```

5. Open your browser:
```
http://localhost:3000
```

## 📝 Configuration

### Flight Display Configuration

The flight test display requires configuration in `flight-display/.env`:

```env
YOUTUBE_VIDEO_ID=your_video_id_here
YOUTUBE_START_OFFSET=0.0
```

### MNIST Model

The MNIST digit recognition model should be placed in:
```
public/mnist_model/
├── model.json
└── model.weights.bin
```

## 🧪 Testing

The website has been tested for:

- ✅ Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- ✅ Responsive design (desktop, tablet, mobile)
- ✅ Accessibility (keyboard navigation, screen readers)
- ✅ Performance (optimized CSS/JS, fast load times)
- ✅ Functionality (all features working correctly)

## 📚 Documentation

For deployment and configuration, see:

- **flight-display/README.md**: Flight test display documentation

## 🎯 Key Features Explained

### MNIST Digit Recognition

Interactive canvas where users can draw digits (0-9) and get real-time predictions from a CNN model trained on the MNIST dataset. Uses TensorFlow.js for client-side inference.

### Flight Test Display

Comprehensive web-based flight test data visualization system featuring:
- Real-time signal processing
- Synchronized multi-modal data playback
- Interactive 3D visualization (Godot engine)
- Video-driven data synchronization
- Interactive flight path mapping
- Altitude and attitude charting

## 🔧 Development

### Code Style

- **HTML**: Semantic markup, accessibility-first
- **CSS**: BEM-inspired naming, CSS variables for theming
- **JavaScript**: ES6+, vanilla JS (no frameworks)

### Adding New Features

1. Follow the retro design system (see Design Philosophy section above)
2. Maintain accessibility standards
3. Test across browsers and devices
4. Update documentation as needed

## 📄 License

This project is open source and available under the MIT License.

## 👤 Author

**Joel Andrew Miller**
- Email: joelmiller0430@gmail.com
- LinkedIn: [joelmillr](https://www.linkedin.com/in/joelmillr/)
- ORCID: [0009-0004-5678-6601](https://orcid.org/0009-0004-5678-6601)

## 🙏 Acknowledgments

- Design inspiration from early web aesthetics (1990s-early 2000s)
- TensorFlow.js for machine learning capabilities
- Godot Engine for 3D visualization
- Chart.js for data visualization

---

**Checkout this website's [source code](https://github.com/Joelmillr/Personal_Website)!**
