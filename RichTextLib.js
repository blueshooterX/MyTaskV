/**
 * MyTask
 * https://github.com/blueshooterX/MyTask
 * 
 * Copyright (c) 2026 blueshooterX
 * Licensed under the MIT License.
 */

/**
 * RichText Conversion Library
 * 
 * Provides utility functions to convert between Google Sheets RichTextValue
 * and HTML string. This library is independent of specific application logic.
 */

/**
 * RichTextValue -> HTML (for reading)
 * @param {GoogleAppsScript.Spreadsheet.RichTextValue} richTextValue 
 * @return {string} HTML string
 */
function richTextToHtml(rtv) {
    if (!rtv) return "";
    if (typeof rtv === 'string') return rtv.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n|\r|\n/g, "<br>");

    const text = rtv.getText();
    const runs = rtv.getRuns();

    if (!runs || runs.length === 0) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n|\r|\n/g, "<br>");
    }

    let html = "";
    runs.forEach(run => {
        let runText = run.getText();
        if (!runText) return;

        // HTML Escape
        runText = runText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const style = run.getTextStyle();
        let taggedText = runText;

        if (style.isBold()) taggedText = `<b>${taggedText}</b>`;
        if (style.isItalic()) taggedText = `<i>${taggedText}</i>`;
        if (style.isStrikethrough()) taggedText = `<s>${taggedText}</s>`;
        if (style.isUnderline()) taggedText = `<u>${taggedText}</u>`;

        const color = style.getForegroundColor();
        if (color && color !== '#000000') {
            taggedText = `<span style="color:${color}">${taggedText}</span>`;
        }

        html += taggedText;
    });

    return html.replace(/\r\n|\r|\n/g, "<br>");
}

/**
 * HTML -> RichTextValue (for saving)
 * @param {string} html HTML content
 * @return {GoogleAppsScript.Spreadsheet.RichTextValue}
 */
function htmlToRichText(html) {
    if (!html) return SpreadsheetApp.newRichTextValue().setText("").build();

    const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

    /**
     * Convert HTML to plain text for Sheets
     * Convert newlines tags to \n
     */
    const toPlainText = (h) => {
        if (!h) return "";
        let s = h.replace(/<br\s*\/?>/gi, "\n")
            .replace(/<(?:div|p|li)[^>]*>/gi, "\n")
            .replace(/<[^>]+>/g, "");
        return decode(s).replace(/^\n/, "");
    };

    const fullPlainText = toPlainText(html);
    const builder = SpreadsheetApp.newRichTextValue().setText(fullPlainText);
    const charStyles = Array.from({ length: fullPlainText.length }, () => ({}));

    // Parse HTML tags and accumulate styles
    const stack = [];
    const tagRegex = /<(\/?[a-z0-9]+)(?:\s+([^>]*?))?>/gi;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
        const tagName = match[1].toLowerCase();
        const attrs = match[2] || "";
        const plainIndex = toPlainText(html.substring(0, match.index)).length;

        if (tagName.startsWith('/')) {
            const name = tagName.substring(1);
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].name === name) {
                    const openTag = stack.splice(i, 1)[0];
                    for (let j = openTag.start; j < plainIndex; j++) {
                        if (j < charStyles.length) {
                            Object.assign(charStyles[j], openTag.style);
                        }
                    }
                    break;
                }
            }
        } else {
            if (tagName === 'br') continue;

            const style = {};
            const styleMatch = attrs.match(/style\s*=\s*["']([\s\S]*?)["']/i);
            if (styleMatch) {
                const s = styleMatch[1];
                const colorMatch = s.match(/color:\s*(rgb\s*\([^)]+\)|#[a-f0-9]+|[a-z]+)/i);
                if (colorMatch) style.color = parseToHex(colorMatch[1]);
                if (/font-weight:\s*(bold|700|800|900)/i.test(s)) style.bold = true;
                if (/font-style:\s*italic/i.test(s)) style.italic = true;
                if (/text-decoration:\s*[^"';]*line-through/i.test(s)) style.strikethrough = true;
                if (/text-decoration:\s*[^"';]*underline/i.test(s)) style.underline = true;
            }
            const cMatch = attrs.match(/color\s*=\s*["']([^"']+)["']/i);
            if (cMatch && !style.color) style.color = parseToHex(cMatch[1]);

            if (tagName === 'b' || tagName === 'strong') style.bold = true;
            if (tagName === 'i' || tagName === 'em') style.italic = true;
            if (tagName === 'u') style.underline = true;
            if (tagName === 's' || tagName === 'strike' || tagName === 'del') style.strikethrough = true;

            // Font tag color support (legacy but common in editors)
            if (tagName === 'font') {
                const colorAttr = attrs.match(/color\s*=\s*["']?([^"'\s>]+)["']?/i);
                if (colorAttr) style.color = parseToHex(colorAttr[1]);
            }

            stack.push({ name: tagName, start: plainIndex, style: style });
        }
    }

    // Apply accumulated styles to runs
    if (fullPlainText.length > 0) {
        let runStart = 0;
        let lastStyleStr = JSON.stringify(charStyles[0]);

        for (let i = 1; i <= fullPlainText.length; i++) {
            const currentStyle = i < fullPlainText.length ? charStyles[i] : null;
            const currentStyleStr = JSON.stringify(currentStyle);

            if (currentStyleStr !== lastStyleStr) {
                const styleObj = JSON.parse(lastStyleStr);
                const textStyle = SpreadsheetApp.newTextStyle();
                let hasStyle = false;

                if (styleObj.color) { textStyle.setForegroundColor(styleObj.color); hasStyle = true; }
                if (styleObj.bold) { textStyle.setBold(true); hasStyle = true; }
                if (styleObj.italic) { textStyle.setItalic(true); hasStyle = true; }
                if (styleObj.strikethrough) { textStyle.setStrikethrough(true); hasStyle = true; }
                if (styleObj.underline) { textStyle.setUnderline(true); hasStyle = true; }

                if (hasStyle) builder.setTextStyle(runStart, i, textStyle.build());

                runStart = i;
                lastStyleStr = currentStyleStr;
            }
        }
    }

    return builder.build();
}

/**
 * Helper to normalize color strings
 * @param {string} color 
 * @return {string|null} Hex color string
 */
function parseToHex(color) {
    if (!color) return null;
    let c = color.trim().toLowerCase().replace(/[;].*$/, "");
    if (c.startsWith('#')) {
        if (c.length === 4) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
        return (c.length === 7 || c.length === 9) ? c.substring(0, 7) : null;
    }
    const rgbMatch = c.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    const basicColors = {
        'red': '#ff0000', 'blue': '#0000ff', 'green': '#188038', 'black': '#000000',
        'white': '#ffffff', 'gray': '#5f6368', 'purple': '#800080', 'orange': '#c26401', 'pink': '#d01884'
    };
    return basicColors[c] || null;
}
