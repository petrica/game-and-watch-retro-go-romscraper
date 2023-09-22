const axios = require('axios');
const process = require('process');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const RomsEmulationComScraper = require('./scrapers/romsemulationcom_scraper');
const EmulatorGamesNetScraper = require('./scrapers/emulatorgamesnet_scraper');

// Custom user agent string
const consoleMapper = {
  Nintendo: 'nes',
  'Sega Genesis': 'md'
}

const scrapers = [
  new RomsEmulationComScraper(),
  new EmulatorGamesNetScraper()
]

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

// Check if a URL is provided as a command-line argument
if (process.argv.length !== 3) {
  console.log('Usage: node romscraper.js <URL>');
} else {
  const url = process.argv[2];
  let foundScraper = false;

  scrapers.forEach(scraper => {
    if (scraper.check(url)) {
      foundScraper = true;

      scraper.scrape(url)
      .then((gameData) => {
        console.log(`Game Title: ${gameData.gameTitle}`);
        console.log(`Console: ${gameData.consoleName}`);
        console.log(`ROM URL: ${gameData.romURL}`);
        console.log(`Image URL: ${gameData.imageURL}`);

        if (consoleMapper.hasOwnProperty(gameData.consoleName)) {
          const destinationDirectory = path.join("roms",consoleMapper[gameData.consoleName]);
          if (!fs.existsSync(destinationDirectory)) {
            fs.mkdirSync(destinationDirectory, { recursive: true });
          }
  
          processImage(gameData.imageURL, gameData.gameTitle, destinationDirectory);
  
          downloadExtractCopyZip(gameData.romURL, gameData.gameTitle, destinationDirectory)
        }
        else {
          console.log(`Console not supported: ${gameData.console}`);
        }
      })
      .catch((error) => {
        console.error('An error occurred:', error);
      });
    }
  });

  if (!foundScraper) {
    console.log(`Could not find any valid scraper to parse ${url}`);
  }
}
