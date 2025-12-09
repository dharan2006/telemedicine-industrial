require('dotenv').config();

class TurnConfig {
  getIceServers() {
    // Free TURN server configuration from Metered.ca
    return [
      {
        urls: 'stun:stun.relay.metered.ca:80',
      },
      {
        urls: `turn:${process.env.TURN_SERVER_URL}`,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      },
      {
        urls: `turn:${process.env.TURN_SERVER_URL}?transport=tcp`,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      },
      {
        urls: 'turn:global.relay.metered.ca:443',
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      },
      {
        urls: 'turns:global.relay.metered.ca:443?transport=tcp',
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      },
    ];
  }

  // Alternative: Fetch from Metered API dynamically
  async getIceServersFromAPI() {
    try {
      const response = await fetch(
        `https://telemedicinepione.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`
      );
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch TURN credentials from API:', error);
      return this.getIceServers(); // Fallback to static config
    }
  }
}

module.exports = new TurnConfig();
