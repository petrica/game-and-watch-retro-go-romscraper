# Game and Watch Retro Go ROM Scraper

Node.js script for downloading the ROM and the artwork in a suitable format for game-and-watch-retro-go firmware for the following websites:

* romsemulation.com
* emulatorgames.net

## Min Requirements

* Node.js - v18

## How to use

Install the NPM packages

```
npm install
```

Copy the URL of the game you would like to download:

```
node romscraper.js https://www.emulatorgames.net/roms/nintendo/super-mario-bros/
```

This will automatically download the ROM and the artwork under `roms/nes` folder.

## Supported Emulators

For now only:

* Nintendo
* Sega Genesis

Are configured. However, by manually adjusting the `consoleMapper` variable, you can configure it
to download games for other emulators available on romsemulation.com.

Feel free to submit PRs for improving the overall script and the supported emulators list.
