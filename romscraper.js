const axios = require('axios');
const cheerio = require('cheerio');
const process = require('process');
const urlModule = require('url');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

// Custom user agent string
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';
const consoleMapper = {
  Nintendo: 'nes',
  'Sega Genesis': 'md'
}

async function downloadImage(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        if (response.status === 200) {
        return response.data;
        }
    } catch (error) {
        throw new Error('Failed to download the image.');
    }
}
  
// Resize and save the image as a transparent PNG
async function resizeAndSaveImage(imageData, fileName, destinationDirectory) {
    const emptyImage = await sharp({
        create: {
          width: 128,
          height: 96,
          channels: 4, // 4 channels for RGBA (including transparency)
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        }
      })
      .toFormat('png')
      .toBuffer();
    const resizedImageBuffer = await sharp(imageData)
        .resize({ width: 128, height: 96, fit: 'inside', position: 'center', background: { r: 0, g: 0, b: 0, alpha: 0 }})
        .toFormat('png')
        .toBuffer();
    const image = await sharp(emptyImage)
        .composite([
          { input: resizedImageBuffer, gravity: 'center' } // Position the resized image in the center
        ])
        .toFormat('png')
        .toBuffer();

    const imagePath = path.join(destinationDirectory, fileName + '.png');
    // Save the resized image as a PNG file
    await sharp(image).toFile(imagePath);
    console.log(`Image resized and saved as ${imagePath}`);
}
  
// Main function to download, resize, and save the image
async function processImage(imageUrl, fileName, destinationDirectory) {
    const imageData = await downloadImage(imageUrl);
    await resizeAndSaveImage(imageData, fileName, destinationDirectory);
}

async function downloadExtractCopyZip(url, gameTitle, destinationPath) {
  const outputPath = "temp.zip";
  try {
    // Download the ZIP file
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    if (response.status === 200) {
      // Save the downloaded ZIP file to outputPath
      fs.writeFileSync(outputPath, response.data);

      // Extract the ZIP file
      const zip = new AdmZip(outputPath);
      const zipEntries = zip.getEntries();

      // Check if there are any entries in the ZIP file
      if (zipEntries.length > 0) {
        // Get the first entry
        const firstEntry = zipEntries[0];

        // Extract the first entry to the destinationPath
        const extension = path.extname(firstEntry.entryName);
        const destinationFilePath = path.join(destinationPath, `${gameTitle}${extension}`);
        firstEntry.getDataAsync((buffer) => {
          fs.writeFileSync(destinationFilePath, buffer);
          console.log(`File extracted and copied to ${destinationFilePath}`);
        });

        // Remove the downloaded ZIP file
        fs.unlinkSync(outputPath);
      } else {
        console.error('No files found in the ZIP archive.');
      }
    } else {
      console.error(`Failed to download the ZIP file. Status code: ${response.status}`);
    }
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  }
}

async function downloadRom(downloadURL, gameTitle, destinationDirectory) {
  axios.get(downloadURL, {
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
          console.log(`ROM URL: ${zipFileURL}`);

          downloadExtractCopyZip(zipFileURL, gameTitle, destinationDirectory)
        }
        else {
          console.log('Zip File URL not found.');
        }
      }
      else {
        console.log(`Failed to retrieve the page. Status code: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('An error occurred:', error);
    });
}

// Check if a URL is provided as a command-line argument
if (process.argv.length !== 3) {
  console.log('Usage: node web-scraper.js <URL>');
} else {
  const url = process.argv[2];

  // Make an HTTP GET request to the provided URL with the custom user agent
  axios.get(url, {
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

        // Get the domain name from the input URL
        const parsedURL = urlModule.parse(url);
        const domainName = `${parsedURL.protocol}//${parsedURL.host}`;

        // Prepend the domain name to the image and download URLs if they are relative
        if (!imageURL.includes('http')) {
            imageURL = domainName + imageURL;
          }
          if (!downloadURL.includes('http')) {
            downloadURL = domainName + downloadURL;
          }

        if (imageURL && downloadURL) {
          console.log(`Game Title: ${gameTitle}`);
          console.log(`Console: ${consoleName}`);
          console.log(`Image URL: ${imageURL}`);
          console.log(`Download URL: ${downloadURL}`);

          return { title: gameTitle, downloadURL: downloadURL, imageURL: imageURL, console: consoleName};
        } else {
          console.log('Could not find the required information on the page.');
        }
      } else {
        console.log(`Failed to retrieve the page. Status code: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('An error occurred:', error);
    })
    .then((data) => {
      if (consoleMapper.hasOwnProperty(data.console)) {
        const destinationDirectory = path.join("roms",consoleMapper[data.console]);
        if (!fs.existsSync(destinationDirectory)) {
          fs.mkdirSync(destinationDirectory, { recursive: true });
        }

        processImage(data.imageURL, data.title, destinationDirectory);

        downloadRom(data.downloadURL, data.title, destinationDirectory);
      }
      else {
        console.log(`Console not supported: ${data.console}`);
      }
    });    
}
