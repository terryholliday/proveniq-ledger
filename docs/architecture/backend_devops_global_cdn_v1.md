# Proveniq Ledger Global CDN & Edge Caching Strategy v1.0

**Document ID:** `backend_devops_global_cdn_v1`  
**Phase:** 5 - Global Scale & Ecosystem Optimization  
**Status:** APPROVED  
**Classification:** L2_INTERNAL  
**Last Updated:** 2024-12-11  

---

## 1. Executive Summary

This document defines the CDN and edge caching strategy for Proveniq Ledger to achieve sub-50ms static asset delivery and intelligent API response caching. The architecture leverages Cloud CDN with Firebase Hosting for the frontend SPA.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         End Users                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Cloud CDN / Firebase Hosting                  │
│                    (200+ Global Edge PoPs)                       │
├─────────────────────────────────────────────────────────────────┤
│  Static Assets (HTML, JS, CSS, Images) - Cache: 1 year          │
│  API Responses (GET /blocks, /proofs) - Cache: 60s              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Cache Miss
┌─────────────────────────────▼───────────────────────────────────┐
│                    Global Load Balancer                          │
│                    (Origin Shield)                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   us-east1              europe-west1         asia-southeast1
   (Origin)              (Origin)             (Origin)
```

---

## 3. Firebase Hosting Configuration

### 3.1 Hosting Setup

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "ledger-api",
          "region": "us-east1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

### 3.2 Multi-Site Deployment

| Environment | Domain | Firebase Project |
|-------------|--------|------------------|
| Production | app.proveniq.io | proveniq-ledger-prod |
| Staging | staging.proveniq.io | proveniq-ledger-staging |
| Preview | pr-*.proveniq.io | proveniq-ledger-staging |

---

## 4. Cache Policies

### 4.1 Static Assets

| Asset Type | Cache-Control | TTL | Invalidation |
|------------|---------------|-----|--------------|
| JS/CSS (hashed) | `public, max-age=31536000, immutable` | 1 year | Filename hash |
| Images | `public, max-age=31536000, immutable` | 1 year | Filename hash |
| Fonts | `public, max-age=31536000, immutable` | 1 year | Filename hash |
| index.html | `no-cache, no-store` | 0 | Every request |
| manifest.json | `public, max-age=86400` | 1 day | Deploy |

### 4.2 API Responses

| Endpoint | Cacheable | TTL | Vary |
|----------|-----------|-----|------|
| `GET /api/blocks` | ✅ | 60s | Authorization |
| `GET /api/blocks/:id` | ✅ | 60s | Authorization |
| `GET /api/proofs/:id` | ✅ | 300s | - |
| `GET /api/analytics/*` | ✅ | 300s | Authorization |
| `POST /api/*` | ❌ | - | - |
| `PUT /api/*` | ❌ | - | - |
| `DELETE /api/*` | ❌ | - | - |

### 4.3 Cache Headers (API)

```typescript
// Cacheable GET endpoints
res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
res.setHeader('CDN-Cache-Control', 'max-age=60');
res.setHeader('Vary', 'Authorization');

// Non-cacheable endpoints
res.setHeader('Cache-Control', 'private, no-store');
```

---

## 5. Edge Functions

### 5.1 Geo-Routing Function

```typescript
// Firebase Functions - Geo Router
export const geoRouter = functions.https.onRequest((req, res) => {
  const country = req.headers['x-country-code'] || 'US';
  const region = getRegionForCountry(country);
  
  // Set routing header for downstream
  res.setHeader('X-Origin-Region', region);
  
  // Proxy to nearest origin
  return proxy(req, res, { target: ORIGINS[region] });
});

function getRegionForCountry(country: string): string {
  const AMERICAS = ['US', 'CA', 'MX', 'BR', 'AR'];
  const EMEA = ['GB', 'DE', 'FR', 'NL', 'AE', 'ZA'];
  const APAC = ['JP', 'AU', 'SG', 'IN', 'KR'];
  
  if (AMERICAS.includes(country)) return 'us-east1';
  if (EMEA.includes(country)) return 'europe-west1';
  if (APAC.includes(country)) return 'asia-southeast1';
  return 'us-east1'; // Default
}
```

### 5.2 Cache Purge Function

```typescript
// Triggered on ledger mutations
export const purgeCacheOnMutation = functions.firestore
  .document('ledger_events/{eventId}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    
    // Purge related cache entries
    await purgeCloudCDN([
      `/api/blocks/${event.blockId}`,
      `/api/blocks`,
      `/api/proofs/${event.blockId}`
    ]);
  });
```

---

## 6. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Static TTFB** | < 50ms | P95 globally |
| **API TTFB (cached)** | < 100ms | P95 globally |
| **API TTFB (origin)** | < 300ms | P95 globally |
| **Cache Hit Ratio** | > 95% | Static assets |
| **Cache Hit Ratio** | > 70% | API responses |
| **Core Web Vitals LCP** | < 2.5s | P75 |
| **Core Web Vitals FID** | < 100ms | P75 |
| **Core Web Vitals CLS** | < 0.1 | P75 |

---

## 7. Monitoring & Alerts

### 7.1 CDN Metrics Dashboard

- Cache hit ratio by asset type
- Origin request rate
- Bandwidth by region
- Error rate (4xx, 5xx)
- Latency percentiles

### 7.2 Alert Policies

| Condition | Severity | Action |
|-----------|----------|--------|
| Cache hit ratio < 80% | Warning | Investigate cache policies |
| Cache hit ratio < 60% | Critical | Page on-call |
| Origin error rate > 1% | Critical | Page on-call |
| Latency P99 > 1s | Warning | Investigate origin |

---

## 8. Cost Optimization

### 8.1 Firebase Hosting (Blaze Plan)

| Resource | Free Tier | Overage |
|----------|-----------|---------|
| Storage | 10 GB | $0.026/GB |
| Transfer | 360 MB/day | $0.15/GB |
| Custom Domain SSL | ✅ Free | - |

### 8.2 Estimated Monthly Cost

| Traffic Level | Storage | Transfer | Cost |
|---------------|---------|----------|------|
| 10K MAU | 1 GB | 50 GB | ~$8 |
| 100K MAU | 5 GB | 500 GB | ~$75 |
| 1M MAU | 20 GB | 5 TB | ~$750 |

---

## 9. Deployment Pipeline

### 9.1 CI/CD Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: proveniq-ledger-prod
```

### 9.2 Preview Deployments

```yaml
# Preview on PR
- uses: FirebaseExtended/action-hosting-deploy@v0
  if: github.event_name == 'pull_request'
  with:
    repoToken: '${{ secrets.GITHUB_TOKEN }}'
    firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
    projectId: proveniq-ledger-staging
    # Creates unique preview URL
```

---

## 10. Approval

| Role | Status | Date |
|------|--------|------|
| Backend/DevOps | ✅ APPROVED | 2024-12-11 |
| Lead Architect | ⏳ PENDING | - |

---

*Generated by Proveniq Ledger DAG Runner - Phase 5*
