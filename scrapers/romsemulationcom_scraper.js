const AbstractScraper = require('./abstract_scraper');
const { URL } = require('url');
const axios = require('axios');
const cheerio = require('cheerio');

const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

class RomsEmulationComScraper extends AbstractScraper {
  check(gameUrl) {
    const parsedUrl = new URL(gameUrl);

    return parsedUrl.hostname.includes("romsemulation.com");
  }

  scrape(gameUrl) {
    // Make an HTTP GET request to the provided URL with the custom user agent
    return axios.get(gameUrl, {
        headers: {
          'User-Agent': userAgent,
        },
      })
      .then((response) => {
        if (response.status === 200) {
          const html = response.data;
          const $ = cheerio.load(html);

          // Extract the image URL under the class "site-post-img"
          const imageElement = $('[itemprop="image"]');
          let imageURL = imageElement.attr('src') || imageElement.attr('content');
          const gameTitle = $('.box-game-name:contains("File name:") .game-info__text').text().trim();
          const consoleName = $('.box-game-name:contains("Console:") .game-info__text').text().trim();

          // Extract the value of the hidden form input named "post_id"
          const buttonElement = $('.button-download');
          const onclickValue = buttonElement.attr('onclick');
          let downloadURL = onclickValue.replace("window.location='", '').replace("'", '');

          if (imageURL && downloadURL) {
            // Get the domain name from the input URL
            const parsedURL = new URL(gameUrl);
            const domainName = `${parsedURL.protocol}//${parsedURL.host}`;

            // Prepend the domain name to the image and download URLs if they are relative
            if (!imageURL.includes('http')) {
              imageURL = domainName + imageURL;
            }
            if (!downloadURL.includes('http')) {
              downloadURL = domainName + downloadURL;
            }

            return { gameTitle: gameTitle, downloadURL: downloadURL, imageURL: imageURL, consoleName: consoleName };
          } else {
            new Error(`Could not find the required information on the page. ${gameUrl}`);
          }
        } else {
          new Error(`Failed to retrieve the page. Status code: ${response.status}`);
        }
      })
      .then((gameData) => {
        return axios.get(gameData.downloadURL, {
            headers: {
              'User-Agent': userAgent,
            },
          })
          .then((response) => {
            if (response.status === 200) {
              const urlPattern = /get_file\(['"]([^'"]+)['"]\)/;
              const html = response.data;
      
              // Find the first match in the script content
              const match = html.match(urlPattern);
      
              if (match && match[1]) {
                const zipFileURL = match[1];
                return { gameTitle: gameData.gameTitle, imageURL: gameData.imageURL, romURL: zipFileURL, consoleName: gameData.consoleName}
              }
              else {
                new Error(`Zip File URL not found on ${gameData.downloadURL}.`);
              }
            }
            else {
              new Error(`Failed to retrieve the page ${gameData.downloadURL}. Status code: ${response.status}`);
            }
          })
      });
  }
}

module.exports = RomsEmulationComScraper;