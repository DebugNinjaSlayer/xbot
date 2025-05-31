import axios from "axios";
import * as cheerio from "cheerio";
import { Element } from "domhandler";

// Types
interface MediaItem {
  mediaUrl: string;
  caption: string;
}

interface ParseResult {
  results: MediaItem[];
  nextPage: string | null;
}

interface PageInfo {
  currentPage: number;
  totalPages: number;
  nextPageUrl: string | null;
}

// Constants
const SELECTORS = {
  PAGINATION: ".pagination",
  ACTIVE_PAGE: "li.active a",
  PAGE_LINKS: "li:not(.prev):not(.next) a",
  NEXT_PAGE: "li.next a",
  CONTENT_CONTAINER: ".news_warp_center",
  IMAGE_CONTAINER: "p",
  IMAGE: "img",
  CAPTION: "p",
} as const;

// Utility functions
function extractPageNumber(element: Element, $: cheerio.CheerioAPI): number {
  return parseInt($(element).attr("data-page") || "0");
}

function extractAttribute(
  element: Element,
  $: cheerio.CheerioAPI,
  attr: string
): string | null {
  return $(element).attr(attr) || null;
}

// Parser functions
function parsePageInfo($: cheerio.CheerioAPI): PageInfo {
  const pagination = $(SELECTORS.PAGINATION);

  // Get current page
  const currentPageLink = pagination.find(SELECTORS.ACTIVE_PAGE);
  const currentPage = currentPageLink.length
    ? extractPageNumber(currentPageLink[0], $)
    : 0;

  // Get total pages
  const lastPageLink = pagination.find(SELECTORS.PAGE_LINKS).last();
  const totalPages = lastPageLink.length
    ? extractPageNumber(lastPageLink[0], $) + 1
    : 1;

  // Get next page URL
  const nextPageLink = pagination.find(SELECTORS.NEXT_PAGE);
  const nextPageUrl = nextPageLink.length
    ? extractAttribute(nextPageLink[0], $, "href")
    : null;

  return { currentPage, totalPages, nextPageUrl };
}

function extractMediaItems($: cheerio.CheerioAPI): MediaItem[] {
  const results: MediaItem[] = [];

  $(SELECTORS.CONTENT_CONTAINER)
    .find(SELECTORS.IMAGE_CONTAINER)
    .each((_, element) => {
      const $p = $(element);
      const $img = $p.find(SELECTORS.IMAGE);

      if ($img.length > 0) {
        const mediaUrl = extractAttribute($img[0], $, "src");
        if (mediaUrl) {
          const caption = extractCaption($p, $);
          results.push({ mediaUrl, caption });
        }
      }
    });

  return results;
}

function extractCaption(
  $currentP: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI
): string {
  const $nextP = $currentP.next(SELECTORS.CAPTION);
  if ($nextP.length > 0 && $nextP.find(SELECTORS.IMAGE).length === 0) {
    return $nextP.text().trim();
  }
  return "";
}

async function fetchPage(url: string): Promise<string> {
  const response = await axios.get(url);
  if (response.status !== 200) {
    throw new Error(`Failed to fetch page: ${url}`);
  }
  return response.data;
}

async function parsePage(url: string): Promise<ParseResult> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  return {
    results: extractMediaItems($),
    nextPage: parsePageInfo($).nextPageUrl,
  };
}

// Main parser function
export async function parse3dmUrl(url: string): Promise<ParseResult> {
  const allResults: MediaItem[] = [];
  let currentUrl: string | null = url;
  let pageCount = 0;

  while (currentUrl) {
    console.log(`Fetching page ${pageCount + 1}...`);
    const result = await parsePage(currentUrl);
    allResults.push(...result.results);
    currentUrl = result.nextPage;
    pageCount++;
  }

  console.log(`Completed fetching ${pageCount} pages`);
  return {
    results: allResults,
    nextPage: null,
  };
}

// CLI interface
async function testParser() {
  const url = process.argv[2];
  if (!url) {
    console.error("Please provide a URL as a command line argument");
    console.error(
      'Example: ts-node src/3dm-parser.ts "https://www.3dmgame.com/news/202505/3881231.html"'
    );
    process.exit(1);
  }

  try {
    const result = await parse3dmUrl(url);
    displayResults(result);
  } catch (error) {
    console.error("Error parsing URL:", error);
  }
}

function displayResults(result: ParseResult): void {
  console.log("\nParsing Results:");
  console.log("----------------");
  console.log(`Total items found: ${result.results.length}`);

  result.results.forEach((item, index) => {
    console.log(`\nItem ${index + 1}:`);
    console.log(`Image URL: ${item.mediaUrl}`);
    console.log(`Caption: ${item.caption || "(no caption)"}`);
  });
}

// Run the test if this file is executed directly
if (require.main === module) {
  testParser();
}
