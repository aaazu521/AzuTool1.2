export const isColorLight = (hexColor: string): boolean => {
    if (!hexColor || hexColor.length < 4) return false;

    // Handle 3-digit hex shorthand
    if (hexColor.length === 4) {
        const rHex = hexColor.charAt(1);
        const gHex = hexColor.charAt(2);
        const bHex = hexColor.charAt(3);
        hexColor = `#${rHex}${rHex}${gHex}${gHex}${bHex}${bHex}`;
    }

    if (hexColor.length !== 7) return false; // Ensure it's a 6-digit hex

    const color = hexColor.substring(1); // remove #
    const rgb = parseInt(color, 16);   // convert rrggbb to decimal
    const r = (rgb >> 16) & 0xff;  // extract red
    const g = (rgb >>  8) & 0xff;  // extract green
    const b = (rgb >>  0) & 0xff;  // extract blue

    // Using the luma formula to determine brightness
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

    // A threshold of 128 is a common choice.
    // Colors with luma > 128 are considered "light".
    return luma > 128;
}