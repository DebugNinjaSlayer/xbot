import axios from "axios";
import * as cheerio from "cheerio";

interface ParseResult {
  results: {
    mediaUrl: string;
    caption: string;
  }[];
  nextPage: string | null;
}

export async function parse3dmUrl(url: string): Promise<ParseResult> {
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
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

  const nextPage = null;
  return {
    results,
    nextPage,
  };
}

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
    console.log("Parsing Results:");
    console.log("----------------");
    result.results.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log(`Image URL: ${item.mediaUrl}`);
      console.log(`Caption: ${item.caption || "(no caption)"}`);
    });
  } catch (error) {
    console.error("Error parsing URL:", error);
  }
}

if (require.main === module) {
  testParser();
}
