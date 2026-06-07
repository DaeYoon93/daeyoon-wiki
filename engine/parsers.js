// engine/parsers.js — Office File Parsers
// Converts .xlsx/.xls, .docx, .pptx to markdown strings for the pipeline

const path = require('path');

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.docx', '.pptx'];

/**
 * Parse an Office file and return its content as a markdown string.
 * @param {string} filePath - Absolute path to the Office file
 * @returns {Promise<string>} Markdown content
 */
async function parseOfficeFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath, ext);

    switch (ext) {
        case '.xlsx':
        case '.xls':
            return parseExcel(filePath, filename);
        case '.docx':
            return parseWord(filePath, filename);
        case '.pptx':
            return parsePowerPoint(filePath, filename);
        default:
            throw new Error(`Unsupported Office format: ${ext}`);
    }
}

/**
 * Excel → Markdown
 * Each sheet becomes an H2 section with a markdown table.
 */
function parseExcel(filePath, filename) {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);

    let markdown = `# ${filename}\n\n`;

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (data.length === 0) continue;

        markdown += `## ${sheetName}\n\n`;

        const headers = data[0];
        if (!headers || headers.length === 0) continue;

        // Header row
        markdown += '| ' + headers.map(h => String(h)).join(' | ') + ' |\n';
        markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

        // Data rows — skip fully empty rows
        for (const row of data.slice(1)) {
            const cells = headers.map((_, i) => String(row[i] ?? ''));
            if (cells.some(c => c.trim() !== '')) {
                markdown += '| ' + cells.join(' | ') + ' |\n';
            }
        }

        markdown += '\n';
    }

    return markdown;
}

/**
 * Word (.docx) → Markdown
 * Extracts raw text via mammoth, preserving paragraph breaks.
 */
async function parseWord(filePath, filename) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });

    const paragraphs = result.value
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    let markdown = `# ${filename}\n\n`;

    // Heuristic: if a short line (< 80 chars) precedes a blank, treat it as a heading
    for (let i = 0; i < paragraphs.length; i++) {
        const line = paragraphs[i];
        const next = paragraphs[i + 1];
        if (line.length < 80 && (!next || next.length > line.length * 1.5)) {
            markdown += `## ${line}\n\n`;
        } else {
            markdown += `${line}\n\n`;
        }
    }

    return markdown;
}

/**
 * PowerPoint (.pptx) → Markdown
 * Unzips the PPTX (which is a ZIP), parses slide XML to extract text.
 */
function parsePowerPoint(filePath, filename) {
    const AdmZip = require('adm-zip');

    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    // Collect and sort slide XML files numerically
    const slideEntries = entries
        .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
        .sort((a, b) => {
            const n = e => parseInt(e.entryName.match(/(\d+)\.xml$/)[1]);
            return n(a) - n(b);
        });

    let markdown = `# ${filename}\n\n`;

    for (let i = 0; i < slideEntries.length; i++) {
        const xml = slideEntries[i].getData().toString('utf-8');
        const texts = extractXmlText(xml);

        if (texts.length === 0) continue;

        markdown += `## 슬라이드 ${i + 1}\n\n`;

        // First text element is typically the slide title
        markdown += `**${texts[0]}**\n\n`;
        for (const text of texts.slice(1)) {
            markdown += `- ${text}\n`;
        }
        markdown += '\n';
    }

    return markdown;
}

/**
 * Extract all text nodes from OOXML via <a:t> tags.
 * Groups consecutive text runs into logical lines.
 */
function extractXmlText(xml) {
    const lines = [];
    // Match paragraph blocks <a:p>...</a:p> and collect text within each
    const paraRegex = /<a:p[ >][\s\S]*?<\/a:p>/g;
    let paraMatch;

    while ((paraMatch = paraRegex.exec(xml)) !== null) {
        const para = paraMatch[0];
        const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
        let textMatch;
        let line = '';

        while ((textMatch = textRegex.exec(para)) !== null) {
            line += textMatch[1];
        }

        const trimmed = line.trim();
        if (trimmed) lines.push(trimmed);
    }

    return lines;
}

module.exports = { parseOfficeFile, SUPPORTED_EXTENSIONS };
