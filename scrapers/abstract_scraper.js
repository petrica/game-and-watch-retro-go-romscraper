class AbstractScraper {
    constructor() {
      if (this.constructor == AbstractScraper) {
        throw new Error("Abstract classes can't be instantiated.");
      }
    }

    check(gameUrl) {
      throw new Error("Method 'scrape()' must be implemented.");
    }
  
    scrape(gameUrl) {
      throw new Error("Method 'scrape()' must be implemented.");
    }
  }

  module.exports = AbstractScraper;