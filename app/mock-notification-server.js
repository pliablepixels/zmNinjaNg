/**
 * Mock ZoneMinder Event Notification Server
 *
 * Simulates the zmeventnotificationNg WebSocket server for testing
 * Run with: node mock-notification-server.js
 */

import { WebSocketServer } from 'ws';

const PORT = 9000;
const SERVER_VERSION = '6.1.29';

// Mock monitor data with dummy images
const MONITORS = [
  { id: 1, name: 'Front Door', image: 'https://picsum.photos/seed/frontdoor/640/480' },
  { id: 2, name: 'Backyard', image: 'https://picsum.photos/seed/backyard/640/480' },
  { id: 3, name: 'Garage', image: 'https://picsum.photos/seed/garage/640/480' },
  { id: 4, name: 'Living Room', image: 'https://picsum.photos/seed/livingroom/640/480' },
  { id: 5, name: 'Driveway', image: 'https://picsum.photos/seed/driveway/640/480' },
];

// Mock alarm causes
const ALARM_CAUSES = [
  '[a] Motion detected',
  '[a] Person detected',
  '[a] Vehicle detected',
  'Motion: Backyard',
  'Motion: Front entrance',
  'Object detection: Person',
  'Zone: Motion in Zone 1',
];

// Track connected clients
const clients = new Map();

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`\n🚀 Mock ZM Event Notification Server started on ws://localhost:${PORT}\n`);
console.log('Configuration:');
console.log('  - Authentication: Any username/password accepted');
console.log('  - Auto-send events: Every 10 seconds');
console.log('  - Monitors:', MONITORS.map(m => m.name).join(', '));
console.log('\nWaiting for connections...\n');

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substring(7);

  console.log(`[${new Date().toLocaleTimeString()}] ✅ Client connected: ${clientId}`);

  clients.set(clientId, {
    ws,
    authenticated: false,
    eventInterval: null,
  });

  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(clientId, message);
    } catch (error) {
      console.error(`[${clientId}] ❌ Error parsing message:`, error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client?.eventInterval) {
      clearInterval(client.eventInterval);
    }
    clients.delete(clientId);
    console.log(`[${new Date().toLocaleTimeString()}] ❌ Client disconnected: ${clientId}`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[${clientId}] ⚠️  WebSocket error:`, error.message);
  });
});

/**
 * Handle incoming messages from client
 */
function handleMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  console.log(`[${new Date().toLocaleTimeString()}] 📨 [${clientId}] Received:`, JSON.stringify(message));

  switch (message.event) {
    case 'auth':
      handleAuth(clientId, message);
      break;

    case 'push':
      handlePush(clientId, message);
      break;

    case 'control':
      handleControl(clientId, message);
      break;

    default:
      sendResponse(clientId, {
        event: message.event,
        type: '',
        status: 'Fail',
        reason: 'NOTSUPPORTED',
      });
  }
}

/**
 * Handle authentication request
 */
function handleAuth(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  const { user, password } = message.data || {};

  console.log(`[${new Date().toLocaleTimeString()}] 🔐 [${clientId}] Auth attempt - User: ${user}`);

  // Accept any credentials for mock server
  if (user && password) {
    client.authenticated = true;

    sendResponse(clientId, {
      event: 'auth',
      type: '',
      status: 'Success',
      version: SERVER_VERSION,
    });

    console.log(`[${new Date().toLocaleTimeString()}] ✅ [${clientId}] Authentication successful`);

    // Start sending periodic events after authentication
    startEventStream(clientId);
  } else {
    sendResponse(clientId, {
      event: 'auth',
      type: '',
      status: 'Fail',
      reason: 'BADAUTH',
    });

    console.log(`[${new Date().toLocaleTimeString()}] ❌ [${clientId}] Authentication failed - missing credentials`);
  }
}

/**
 * Handle push token registration
 */
function handlePush(clientId, message) {
  const { type, token, platform } = message.data || {};

  if (type === 'token') {
    console.log(`[${new Date().toLocaleTimeString()}] 📱 [${clientId}] Push token registered - Platform: ${platform}`);

    sendResponse(clientId, {
      event: 'push',
      type: 'token',
      status: 'Success',
    });
  } else if (type === 'badge') {
    const { badge } = message.data || {};
    console.log(`[${new Date().toLocaleTimeString()}] 🔔 [${clientId}] Badge count updated: ${badge}`);

    sendResponse(clientId, {
      event: 'push',
      type: 'badge',
      status: 'Success',
    });
  }
}

/**
 * Handle control commands
 */
function handleControl(clientId, message) {
  const { type } = message.data || {};

  if (type === 'version') {
    sendResponse(clientId, {
      event: 'control',
      type: 'version',
      status: 'Success',
      version: SERVER_VERSION,
    });
    console.log(`[${new Date().toLocaleTimeString()}] ℹ️  [${clientId}] Version request`);
  } else if (type === 'filter') {
    const { monlist, intlist } = message.data || {};
    console.log(`[${new Date().toLocaleTimeString()}] 🎯 [${clientId}] Monitor filter updated - Monitors: ${monlist}, Intervals: ${intlist}`);

    sendResponse(clientId, {
      event: 'control',
      type: 'filter',
      status: 'Success',
    });
  }
}

/**
 * Start sending periodic alarm events
 */
function startEventStream(clientId) {
  const client = clients.get(clientId);
  if (!client || !client.authenticated) return;

  console.log(`[${new Date().toLocaleTimeString()}] 🎬 [${clientId}] Starting event stream (every 10 seconds)`);

  // Send first event immediately
  sendAlarmEvent(clientId);

  // Then send events every 10 seconds
  client.eventInterval = setInterval(() => {
    sendAlarmEvent(clientId);
  }, 10000);
}

/**
 * Send a fake alarm event
 */
function sendAlarmEvent(clientId) {
  const client = clients.get(clientId);
  if (!client || !client.authenticated) return;

  // Pick random monitor
  const monitor = MONITORS[Math.floor(Math.random() * MONITORS.length)];

  // Pick random cause
  const cause = ALARM_CAUSES[Math.floor(Math.random() * ALARM_CAUSES.length)];

  // Generate fake event ID
  const eventId = Math.floor(100000 + Math.random() * 900000);

  const alarmEvent = {
    event: 'alarm',
    type: '',
    status: 'Success',
    events: [{
      MonitorId: monitor.id,
      MonitorName: monitor.name,
      EventId: eventId,
      Cause: cause,
      Name: monitor.name,
      DetectionJson: [],
      ImageUrl: monitor.image,
    }]
  };

  sendResponse(clientId, alarmEvent);

  console.log(`[${new Date().toLocaleTimeString()}] 🚨 [${clientId}] Sent alarm event - Monitor: ${monitor.name}, Event: ${eventId}, Cause: ${cause}, Image: ✅`);
}

/**
 * Send response to client
 */
function sendResponse(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  try {
    client.ws.send(JSON.stringify(data));
  } catch (error) {
    console.error(`[${clientId}] ❌ Error sending message:`, error);
  }
}

// Manual trigger for testing
console.log('\n💡 Tips:');
console.log('  - Configure app to connect to ws://localhost:9000');
console.log('  - Use any username/password to authenticate');
console.log('  - Events will auto-send every 10 seconds');
console.log('  - Press Ctrl+C to stop server\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down mock server...');
  wss.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
