
# Web File Access

A collaborative file sharing and viewing application with peer-to-peer capabilities. Live demo available at [https://bluestyles--lumi-peer-share.netlify.app/](https://bluestyles--lumi-peer-share.netlify.app/)

## Features

- Real-time collaborative editing
- Peer-to-peer file sharing
- Markdown support
- PDF viewing and generation
- Graph visualization
- Chat functionality
- PWA (Progressive Web App) support
- QR code sharing

## Prerequisites

- Node.js (Latest LTS version recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/kai4avaya/blockchain_files.git
cd blockchain_files
git checkout bluestyles
```

2. Install dependencies:
```bash
npm install
```

## Development

To run the development server:
```bash
npm run dev
```
This will start the Vite development server, typically at `http://localhost:5173`

## Building for Production

1. Clean the dist folder and build the project:
```bash
npm run build
```

2. Preview the production build locally:
```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run clean` - Clean dist directory
- `npm run copy-assets` - Copy icons and workers to dist
- `npm run preview-build` - Build and preview in one command
- `npm run generate-icons` - Generate application icons

## Project Structure

The project uses several key technologies:

- **Vite** - Build tool and development server
- **CodeMirror** - Text editor component
- **Three.js** - 3D graphics
- **Y.js** - Real-time collaboration
- **PeerJS** - Peer-to-peer connections
- **Socket.io** - Real-time communication
- **Various ML libraries** - For text analysis and processing

## PWA Support

The application includes PWA support with:
- Automatic updates
- Asset caching
- Offline functionality
- Custom service worker configurations

## Performance Optimizations

The build process includes:
- Code splitting and chunking
- Tree shaking
- Asset optimization
- WASM support
- Minification and compression

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC

---

For more information, visit the [live demo](https://bluestyles--lumi-peer-share.netlify.app/) or check out the [GitHub repository](https://github.com/kai4avaya/blockchain_files/tree/bluestyles).


