// download_modules.mjs - ES Module version
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URLs for Three.js modules
const modules = [
    {
        url: 'https://cdn.jsdelivr.net/npm/three@0.154.0/build/three.module.js',
        filename: 'three.module.js'
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/three@0.154.0/examples/jsm/loaders/GLTFLoader.js',
        filename: 'GLTFLoader.js'
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/three@0.154.0/examples/jsm/utils/BufferGeometryUtils.js',
        filename: 'BufferGeometryUtils.js'
    }
];

// Download function
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading ${url} to ${destPath}...`);
        
        const file = fs.createWriteStream(destPath);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}, status code: ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${url} successfully!`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {}); // Delete the file on error
            reject(err);
        });
    });
}

// Create directories if they don't exist
const dirs = ['./lib', './lib/utils'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// Download all modules
Promise.all(
    modules.map(module => {
        let destPath;
        if (module.filename === 'BufferGeometryUtils.js') {
            destPath = path.join('./lib/utils', module.filename);
        } else {
            destPath = path.join('./lib', module.filename);
        }
        return downloadFile(module.url, destPath);
    })
)
.then(() => {
    console.log('All modules downloaded successfully!');
    
    // Fix internal reference in GLTFLoader.js
    const gltfLoaderPath = path.join('./lib', 'GLTFLoader.js');
    let content = fs.readFileSync(gltfLoaderPath, 'utf8');
    
    // Replace imports for BufferGeometryUtils
    content = content.replace(
        /from ['"]\.\.\/utils\/BufferGeometryUtils\.js['"]/g, 
        "from './utils/BufferGeometryUtils.js'"
    );
    
    fs.writeFileSync(gltfLoaderPath, content);
    console.log('Fixed internal paths in GLTFLoader.js');
})
.catch(error => {
    console.error('Error downloading modules:', error);
}); 