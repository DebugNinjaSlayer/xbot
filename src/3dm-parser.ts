import axios from "axios";
import * as cheerio from "cheerio";

interface ParseResult {
  results: {
    mediaUrl: string;
    caption: string;
  }[];
  nextPage: string | null;
}

interface PageInfo {
  currentPage: number;
  totalPages: number;
  nextPageUrl: string | null;
}

function parsePageInfo($: cheerio.CheerioAPI): PageInfo {
  const pagination = $(".pagination");
  const currentPageLink = pagination.find("li.active a");
  const currentPage = currentPageLink.length
    ? parseInt(currentPageLink.attr("data-page") || "0")
    : 0;

  // Find the last page number
  const lastPageLink = pagination.find("li:not(.prev):not(.next) a").last();
  const totalPages = lastPageLink.length
    ? parseInt(lastPageLink.attr("data-page") || "0") + 1
    : 1;

  // Get next page URL if exists
  const nextPageLink = pagination.find("li.next a");
  const nextPageUrl = nextPageLink.length
    ? nextPageLink.attr("href") || null
    : null;

  return {
    currentPage,
    totalPages,
    nextPageUrl,
  };
}

async function parsePage(url: string): Promise<ParseResult> {
  const response = await axios.get(url);
  if (response.status !== 200) {
    throw new Error("Failed to fetch page");
  }
  const html = response.data;
  const $ = cheerio.load(html);

  const results: { mediaUrl: string; caption: string }[] = [];

  // Find all img elements within p tags
  $(".news_warp_center p").each((_, element) => {
    const $p = $(element);
    const $img = $p.find("img");

    if ($img.length > 0) {
      const mediaUrl = $img.attr("src");
      if (mediaUrl) {
        // Look for the next p tag that contains text (not just an img)
        let caption = "";
        const $nextP = $p.next("p");
        if ($nextP.length > 0 && $nextP.find("img").length === 0) {
          caption = $nextP.text().trim();
        }

        results.push({
          mediaUrl,
          caption,
        });
      }
    }
  });

  const pageInfo = parsePageInfo($);
  return {
    results,
    nextPage: pageInfo.nextPageUrl,
  };
}

export async function parse3dmUrl(url: string): Promise<ParseResult> {
  const allResults: { mediaUrl: string; caption: string }[] = [];
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

// Test function to run the parser
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
    console.log("\nParsing Results:");
    console.log("----------------");
    console.log(`Total items found: ${result.results.length}`);
    result.results.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log(`Image URL: ${item.mediaUrl}`);
      console.log(`Caption: ${item.caption || "(no caption)"}`);
    });
  } catch (error) {
    console.error("Error parsing URL:", error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testParser();
}
