const AbstractScraper = require('./abstract_scraper');
const { URL } = require('url');
const Humanoid = require("humanoid-js");
const cheerio = require('cheerio');

class EmulatorGamesNetScraper extends AbstractScraper {
  check(gameUrl) {
    const parsedUrl = new URL(gameUrl);

    return parsedUrl.hostname.includes("emulatorgames.net");
  }

  scrape(gameUrl) {
    const humanoid = new Humanoid();
    // Make an HTTP GET request to the provided URL with the custom user agent
    return humanoid.get(gameUrl)
      .then((response) => {
        if (response.statusCode === 200) {
          const html = response.body;
          const $ = cheerio.load(html);

          // Extract the image URL under the class "site-post-img"
          const imageElement =  $('.site-post-img');
          let imageURL = imageElement.attr('src') || imageElement.attr('content');
          const gameTitle = $('h1[itemprop="name"]').text().trim();
          const consoleName = $('.breadcrumb-item:nth-child(3) span[itemprop="name"]').text().trim();

          // Extract the value of the hidden form input named "post_id"
          const postIdValue = $('input[name="post_id"]').attr('value');
          let downloadURL = $('form:has(button:contains("Save Game"))').attr('action');

          if (downloadURL && imageURL && postIdValue) {
            const parsedURL = new URL(gameUrl);
            const domainName = `${parsedURL.protocol}//${parsedURL.host}`;

            if (!downloadURL.includes('http')) {
              downloadURL = domainName + downloadURL;
            }

            return { gameTitle: gameTitle, postIdValue: postIdValue, downloadURL: downloadURL, imageURL: imageURL, consoleName: consoleName };
          } else {
            new Error(`Could not find the required information on the page. ${gameUrl}`);
          }
        } else {
          new Error(`Failed to retrieve the page. Status code: ${response.statusCode}`);
        }
      })
      .then((gameData) => {
        const downloadURL = "https://www.emulatorgames.net/prompt/";
        let headers = humanoid._getRequestHeaders(downloadURL);
        headers['Referer'] = gameData.downloadURL;
        return humanoid.post(downloadURL, {
            get_type: "post",
            get_id: gameData.postIdValue
          }, headers)
          .then((response) => {
            if (response.statusCode === 200 && response.body) {
              const parsedData = JSON.parse(response.body);

              if (parsedData[0]) {
                return { gameTitle: gameData.gameTitle, imageURL: gameData.imageURL, romURL: parsedData[0], consoleName: gameData.consoleName}
              }
              else {
                new Error(`Zip File URL not found on ${gameData.downloadURL}.`);
              }
            }
            else {
              new Error(`Failed to retrieve the page ${downloadURL}. Status code: ${response.statusCode}`);
            }
          })
      });  
  }
}

module.exports = EmulatorGamesNetScraper;