/**
 * Active Viewers Service
 * Tracks real-time active viewers for products using in-memory storage
 * Includes realistic simulation mode with natural viewer fluctuations
 */

const VIEWER_SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const SIMULATION_ENABLED = true; // Enable realistic viewer simulation
const SIMULATION_UPDATE_INTERVAL = 3000; // Update count every 3 seconds

const activeViewers = new Map(); // Map of productId -> Set of viewer sessions
const simulatedCounts = new Map(); // Map of productId -> { count, trend, lastUpdate }

/**
 * Generate a unique viewer session ID
 */
function generateViewerSessionId() {
  return `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize simulation for a product
 * Starts with random count between 8 and 15
 */
function initializeSimulation(productId) {
  if (!simulatedCounts.has(productId)) {
    simulatedCounts.set(productId, {
      count: Math.floor(Math.random() * 8) + 8, // 8-15 viewers
      trend: 1, // 1 = increasing, -1 = decreasing, 0 = neutral
      direction: 'up', // 'up', 'down', or 'neutral'
      changeCounter: 0,
      lastUpdate: Date.now(),
    });
  }
  return simulatedCounts.get(productId);
}

/**
 * Update simulation count with realistic fluctuations
 */
function updateSimulation(productId) {
  let sim = simulatedCounts.get(productId);
  if (!sim) {
    sim = initializeSimulation(productId);
  }

  const now = Date.now();
  const timeSinceLastUpdate = now - sim.lastUpdate;

  // Only update every 3 seconds (simulation interval)
  if (timeSinceLastUpdate < SIMULATION_UPDATE_INTERVAL) {
    return sim.count;
  }

  const currentCount = sim.count;
  const minViewers = 8;
  const maxViewers = 90;
  const decreaseChance = currentCount > 50 ? 0.15 : 0.05; // Higher chance to decrease when high
  const increaseChance = currentCount < 30 ? 0.4 : currentCount < 60 ? 0.25 : 0.08;

  let newCount = currentCount;

  // Determine if we should change direction
  if (Math.random() < decreaseChance && currentCount > minViewers) {
    // Randomly decrease by 1 or 2
    newCount = currentCount - (Math.random() < 0.6 ? 1 : 2);
    sim.direction = 'down';
  } else if (Math.random() < increaseChance && currentCount < maxViewers) {
    // Increase by 1, 2, or 3
    const increment = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 3;
    newCount = Math.min(currentCount + increment, maxViewers);
    sim.direction = 'up';
  } else {
    // Stay relatively stable with small random fluctuation
    if (currentCount > 40 && Math.random() < 0.1) {
      newCount = currentCount - 1; // Small decrease
      sim.direction = 'down';
    } else if (currentCount < 70 && Math.random() < 0.15) {
      newCount = currentCount + 1; // Small increase
      sim.direction = 'up';
    } else {
      sim.direction = 'neutral';
    }
  }

  // Ensure count stays within bounds
  newCount = Math.max(minViewers, Math.min(maxViewers, newCount));

  sim.count = newCount;
  sim.lastUpdate = now;
  sim.changeCounter++;

  // Occasionally create longer trends (stay in direction for a bit)
  if (sim.changeCounter % 5 === 0) {
    // Every 5 updates, decide to switch or continue trend
    if (Math.random() < 0.3) {
      sim.direction = sim.direction === 'up' ? 'down' : 'up';
    }
  }

  return newCount;
}

/**
 * Record an active viewer for a product
 * Returns the active viewer count and session ID
 */
function recordActiveViewer(productId, sessionId = null) {
  if (!productId) return { count: 0, sessionId: null };

  if (SIMULATION_ENABLED) {
    const simCount = updateSimulation(productId);
    return {
      count: simCount,
      sessionId: sessionId || generateViewerSessionId(),
    };
  }

  const viewerId = sessionId || generateViewerSessionId();

  if (!activeViewers.has(productId)) {
    activeViewers.set(productId, new Map());
  }

  const viewers = activeViewers.get(productId);
  viewers.set(viewerId, {
    timestamp: Date.now(),
    expiresAt: Date.now() + VIEWER_SESSION_TIMEOUT,
  });

  cleanupExpiredViewers(productId);

  return {
    count: viewers.size,
    sessionId: viewerId,
  };
}

/**
 * Get the current active viewer count for a product
 */
function getActiveViewerCount(productId) {
  if (!productId) return 0;

  if (SIMULATION_ENABLED) {
    return updateSimulation(productId);
  }

  if (!activeViewers.has(productId)) {
    return 0;
  }

  const viewers = activeViewers.get(productId);
  cleanupExpiredViewers(productId);
  return viewers.size;
}

/**
 * Keep a viewer session alive (called on page focus or periodic polling)
 */
function keepViewerAlive(productId, sessionId) {
  if (!productId || !sessionId) {
    return { count: 0 };
  }

  if (SIMULATION_ENABLED) {
    const simCount = updateSimulation(productId);
    return { count: simCount };
  }

  if (!activeViewers.has(productId)) {
    return { count: 0 };
  }

  const viewers = activeViewers.get(productId);
  if (viewers.has(sessionId)) {
    viewers.set(sessionId, {
      timestamp: Date.now(),
      expiresAt: Date.now() + VIEWER_SESSION_TIMEOUT,
    });
  }

  cleanupExpiredViewers(productId);
  return { count: viewers.size };
}

/**
 * Remove expired viewers for a product
 */
function cleanupExpiredViewers(productId) {
  if (!activeViewers.has(productId)) return;

  const viewers = activeViewers.get(productId);
  const now = Date.now();

  for (const [viewerId, data] of viewers.entries()) {
    if (data.expiresAt < now) {
      viewers.delete(viewerId);
    }
  }

  if (viewers.size === 0) {
    activeViewers.delete(productId);
  }
}

/**
 * Remove a viewer session (called when user leaves the product page)
 */
function removeViewer(productId, sessionId) {
  if (!productId || !sessionId) {
    return { count: 0 };
  }

  if (SIMULATION_ENABLED) {
    const simCount = updateSimulation(productId);
    return { count: simCount };
  }

  if (!activeViewers.has(productId)) {
    return { count: 0 };
  }

  const viewers = activeViewers.get(productId);
  viewers.delete(sessionId);

  if (viewers.size === 0) {
    activeViewers.delete(productId);
  }

  return { count: viewers.size };
}

/**
 * Cleanup all expired viewers across all products (can be called periodically)
 */
function cleanupAllExpiredViewers() {
  const now = Date.now();
  const productsToDelete = [];

  for (const [productId, viewers] of activeViewers.entries()) {
    for (const [viewerId, data] of viewers.entries()) {
      if (data.expiresAt < now) {
        viewers.delete(viewerId);
      }
    }

    if (viewers.size === 0) {
      productsToDelete.push(productId);
    }
  }

  productsToDelete.forEach((productId) => activeViewers.delete(productId));
}

// Run cleanup every minute
setInterval(cleanupAllExpiredViewers, 60 * 1000);

module.exports = {
  recordActiveViewer,
  getActiveViewerCount,
  keepViewerAlive,
  removeViewer,
  cleanupExpiredViewers,
  cleanupAllExpiredViewers,
};
