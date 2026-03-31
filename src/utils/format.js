export const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    italic: "\x1b[3m",
    underline: "\x1b[4m",
    
    // Foreground colors
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    
    // Bright colors
    gray: "\x1b[90m",
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    brightYellow: "\x1b[93m",
    brightBlue: "\x1b[94m",
    brightMagenta: "\x1b[95m",
    brightCyan: "\x1b[96m",
    brightWhite: "\x1b[97m"
};

/**
 * Tạo văn bản có màu cho Zalo (chỉ hỗ trợ trên PC và một số bản Mobile mới)
 * @param {string} text 
 * @param {string} color 
 * @returns {string}
 */
export function formatColor(text, color = "green") {
    const code = colors[color] || colors.green;
    return `${code}${text}${colors.reset}`;
}

export const c = colors;
