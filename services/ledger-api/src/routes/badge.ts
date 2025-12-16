/**
 * Verification Badge Routes
 * 
 * Embeddable widget endpoints for partners to show Proveniq verification
 * GET /badge/:itemId - Get badge data for an item
 * GET /badge/:itemId/embed.js - JavaScript embed code
 * GET /badge/:itemId/embed.svg - SVG badge image
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ledgerStore } from '../store/ledgerStore.js';

export const badgeRouter = Router();

/**
 * Badge data structure
 */
interface BadgeData {
  itemId: string;
  verified: boolean;
  verificationLevel: 'GOLD' | 'SILVER' | 'BRONZE' | 'UNVERIFIED';
  provenanceScore: number;
  eventCount: number;
  registrationDate: string | null;
  lastActivity: string | null;
  custodyState: string | null;
  photoCount: number;
  badgeUrl: string;
  embedUrl: string;
}

/**
 * Calculate verification level based on provenance
 */
function calculateVerificationLevel(events: any[]): { level: BadgeData['verificationLevel']; score: number } {
  if (events.length === 0) {
    return { level: 'UNVERIFIED', score: 0 };
  }

  let score = 0;

  // Registration age
  const regEvent = events.find(e => e.eventType.includes('registered'));
  if (regEvent) {
    const ageMs = Date.now() - new Date(regEvent.timestamp).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > 365) score += 25;
    else if (ageDays > 90) score += 15;
    else if (ageDays > 30) score += 10;
    else score += 5;
  }

  // Event count
  if (events.length >= 10) score += 25;
  else if (events.length >= 5) score += 15;
  else if (events.length >= 2) score += 10;
  else score += 5;

  // Photo documentation
  const photoEvents = events.filter(e => e.eventType.includes('photo'));
  if (photoEvents.length >= 5) score += 25;
  else if (photoEvents.length >= 2) score += 15;
  else if (photoEvents.length >= 1) score += 10;

  // Verification events
  const verificationEvents = events.filter(e => e.eventType.includes('verification'));
  if (verificationEvents.length >= 2) score += 25;
  else if (verificationEvents.length >= 1) score += 15;

  // Determine level
  let level: BadgeData['verificationLevel'];
  if (score >= 80) level = 'GOLD';
  else if (score >= 50) level = 'SILVER';
  else if (score >= 20) level = 'BRONZE';
  else level = 'UNVERIFIED';

  return { level, score };
}

/**
 * GET /badge/:itemId
 * Get verification badge data for an item
 */
badgeRouter.get('/:itemId', (req: Request, res: Response, _next: NextFunction) => {
  const { itemId } = req.params;
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3002}`;

  const events = ledgerStore.getItemEvents(itemId);
  const custody = ledgerStore.getCustodyState(itemId);
  
  const { level, score } = calculateVerificationLevel(events);
  
  const regEvent = events.find(e => e.eventType.includes('registered'));
  const lastEvent = events[events.length - 1];
  const photoCount = events.filter(e => e.eventType.includes('photo')).length;

  const badgeData: BadgeData = {
    itemId,
    verified: events.length > 0,
    verificationLevel: level,
    provenanceScore: score,
    eventCount: events.length,
    registrationDate: regEvent?.timestamp || null,
    lastActivity: lastEvent?.timestamp || null,
    custodyState: custody?.currentState || null,
    photoCount,
    badgeUrl: `${baseUrl}/badge/${itemId}/embed.svg`,
    embedUrl: `${baseUrl}/badge/${itemId}/embed.js`,
  };

  res.json({
    success: true,
    data: badgeData,
  });
});

/**
 * GET /badge/:itemId/embed.svg
 * Get SVG badge for embedding
 */
badgeRouter.get('/:itemId/embed.svg', (req: Request, res: Response, _next: NextFunction) => {
  const { itemId } = req.params;
  
  const events = ledgerStore.getItemEvents(itemId);
  const { level, score } = calculateVerificationLevel(events);

  // Badge colors by level
  const colors = {
    GOLD: { bg: '#F59E0B', text: '#78350F', icon: '#FCD34D' },
    SILVER: { bg: '#9CA3AF', text: '#1F2937', icon: '#D1D5DB' },
    BRONZE: { bg: '#D97706', text: '#7C2D12', icon: '#FCD34D' },
    UNVERIFIED: { bg: '#6B7280', text: '#F3F4F6', icon: '#9CA3AF' },
  };

  const color = colors[level];
  const checkmark = level !== 'UNVERIFIED' 
    ? `<path d="M9 12l2 2 4-4" stroke="${color.icon}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" stroke="${color.icon}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="180" height="48" viewBox="0 0 180 48" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-${itemId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color.bg};stop-opacity:0.8" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="180" height="48" rx="8" fill="url(#bg-${itemId})"/>
  
  <!-- Shield Icon -->
  <g transform="translate(8, 8)">
    <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" 
          fill="${color.icon}" opacity="0.3"/>
    <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" 
          stroke="${color.icon}" stroke-width="1.5" fill="none"/>
    ${checkmark}
  </g>
  
  <!-- Text -->
  <text x="44" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="${color.text}">
    PROVENIQ VERIFIED
  </text>
  <text x="44" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="${color.text}" opacity="0.8">
    ${level} • Score: ${score}/100
  </text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
  res.send(svg);
});

/**
 * GET /badge/:itemId/embed.js
 * Get JavaScript embed code
 */
badgeRouter.get('/:itemId/embed.js', (req: Request, res: Response, _next: NextFunction) => {
  const { itemId } = req.params;
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3002}`;

  const js = `
(function() {
  // Proveniq Verification Badge Embed
  // Item ID: ${itemId}
  
  var containerId = 'proveniq-badge-${itemId}';
  var container = document.getElementById(containerId);
  
  if (!container) {
    console.error('Proveniq Badge: Container not found. Add <div id="' + containerId + '"></div> to your page.');
    return;
  }
  
  // Fetch badge data
  fetch('${baseUrl}/badge/${itemId}')
    .then(function(response) { return response.json(); })
    .then(function(result) {
      if (!result.success) {
        container.innerHTML = '<span style="color: #EF4444;">Verification unavailable</span>';
        return;
      }
      
      var data = result.data;
      var levelColors = {
        GOLD: { bg: '#F59E0B', border: '#D97706' },
        SILVER: { bg: '#9CA3AF', border: '#6B7280' },
        BRONZE: { bg: '#D97706', border: '#B45309' },
        UNVERIFIED: { bg: '#6B7280', border: '#4B5563' }
      };
      var color = levelColors[data.verificationLevel];
      
      container.innerHTML = \`
        <a href="https://proveniq.com/verify/\${data.itemId}" target="_blank" rel="noopener" 
           style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; 
                  background: \${color.bg}; border: 2px solid \${color.border}; border-radius: 8px;
                  text-decoration: none; font-family: system-ui, -apple-system, sans-serif;">
          <img src="${baseUrl}/badge/${itemId}/embed.svg" alt="Proveniq Verified" 
               style="height: 32px; width: auto;" />
        </a>
      \`;
    })
    .catch(function(error) {
      console.error('Proveniq Badge Error:', error);
      container.innerHTML = '<span style="color: #EF4444;">Verification unavailable</span>';
    });
})();
`;

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(js);
});

/**
 * GET /badge/:itemId/html
 * Get HTML embed snippet
 */
badgeRouter.get('/:itemId/html', (req: Request, res: Response, _next: NextFunction) => {
  const { itemId } = req.params;
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3002}`;

  const html = `<!-- Proveniq Verification Badge -->
<div id="proveniq-badge-${itemId}"></div>
<script src="${baseUrl}/badge/${itemId}/embed.js" async></script>
<!-- End Proveniq Badge -->`;

  res.json({
    success: true,
    data: {
      itemId,
      embedCode: html,
      svgUrl: `${baseUrl}/badge/${itemId}/embed.svg`,
      jsUrl: `${baseUrl}/badge/${itemId}/embed.js`,
      instructions: [
        '1. Copy the embed code above',
        '2. Paste it where you want the badge to appear on your page',
        '3. The badge will automatically load and display verification status',
      ],
    },
  });
});
