// A simple utility to extract the average color from an image.
// This is a basic implementation and might not find the most "dominant" or
// vibrant color, but it's a good starting point without adding heavy libraries.

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => ('0' + c.toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getDominantColor(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Important for cross-domain images
        img.src = imageUrl;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            // Scale the image down to 1x1 to get the average color
            canvas.width = 1;
            canvas.height = 1;
            ctx.drawImage(img, 0, 0, 1, 1);

            try {
                const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                resolve(rgbToHex(r, g, b));
            } catch (e) {
                reject(new Error('Could not get image data. The image might be protected by CORS policy.'));
            }
        };

        img.onerror = (err) => {
            reject(new Error(`Failed to load image: ${err}`));
        };
    });
}