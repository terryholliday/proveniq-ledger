# Frontend/Mobile Specialist Phase 1 - Partner Portal & SDK Outline

**Document ID:** `frontend_mobile_specialist_phase_1_deliverables_v1`  
**Phase:** 1 - Governance & Zero-Trust Architecture  
**Status:** APPROVED  
**Classification:** L1_GENERAL  
**Last Updated:** 2024-12-10  

---

## 1. Objective

Create a high-level information architecture for the Partner Portal and SDK that partners will use to integrate with Proveniq Ledger. Ensure early UX decisions align with zero-trust security requirements.

---

## 2. Partner Portal Information Architecture

### 2.1 Portal Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROVENIQ PARTNER PORTAL                      │
│─────────────────────────────────────────────────────────────────│
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Dashboard  │  │  API Keys   │  │    Logs     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Test Data  │  │    Docs     │  │   Settings  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Page Breakdown

| Section | Purpose | Key Features |
|---------|---------|--------------|
| **Dashboard** | Overview of integration health | Verification counts, error rates, status |
| **API Keys** | Manage authentication credentials | Create, rotate, revoke keys |
| **Logs** | View API call history | Searchable logs, export |
| **Test Data** | Sandbox environment | Sample claims, test scenarios |
| **Docs** | Integration documentation | API reference, tutorials |
| **Settings** | Account configuration | Team members, webhooks, notifications |

---

## 3. UX Flows

### 3.1 API Key Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    API KEY MANAGEMENT FLOW                       │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │  Create  │───►│  Review  │───►│  Confirm │───►│  Display │ │
│  │   Key    │    │  Perms   │    │   MFA    │    │   Once   │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                  │
│  SECURITY REQUIREMENTS:                                         │
│  ✓ MFA required for key creation                               │
│  ✓ Key shown ONCE, then only prefix displayed                  │
│  ✓ Key never stored in browser localStorage                    │
│  ✓ Copy-to-clipboard with auto-clear after 60 seconds          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Rotation Flow

```
User clicks "Rotate Key"
        │
        ▼
┌─────────────────┐
│ Confirm rotation│  "This will invalidate the old key"
│    (Modal)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MFA Verify    │  TOTP or WebAuthn
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Grace Period    │  "Old key valid for 24 hours"
│   Selection     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Display New    │  One-time display
│     Key         │
└─────────────────┘
```

---

## 4. Security-First UX Guidelines

### 4.1 Secret Handling Rules

| Rule | Implementation |
|------|----------------|
| **Never store secrets in localStorage** | Use session-only memory |
| **Mask secrets after display** | Show only prefix: `sk_live_abc...` |
| **Auto-clear clipboard** | Clear after 60 seconds |
| **Require MFA for sensitive actions** | Key creation, rotation, deletion |
| **Session timeout** | 60 minutes inactive, 8 hours max |

### 4.2 Role-Based UI Elements

```typescript
// Component visibility by role
const ROLE_PERMISSIONS = {
  admin: {
    canCreateKeys: true,
    canDeleteKeys: true,
    canViewAllLogs: true,
    canManageTeam: true,
  },
  developer: {
    canCreateKeys: true,
    canDeleteKeys: false,  // Request only
    canViewAllLogs: true,
    canManageTeam: false,
  },
  viewer: {
    canCreateKeys: false,
    canDeleteKeys: false,
    canViewAllLogs: false,  // Own activity only
    canManageTeam: false,
  },
};
```

---

## 5. SDK Experience Outline

### 5.1 SDK Features (Phase 3+)

| Feature | Platform | Purpose |
|---------|----------|---------|
| **Document Capture** | Mobile | Capture and hash documents |
| **Verification Check** | Web/Mobile | Verify a claim's proof |
| **Event Subscription** | Web | Real-time updates via webhooks |
| **Proof Display** | Web/Mobile | Visual verification badge |

### 5.2 Mobile SDK Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE SDK FLOW                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    PARTNER'S APP                          │  │
│  │                                                           │  │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │  │
│  │   │   Capture   │───►│    Hash     │───►│   Submit    │ │  │
│  │   │   Photo     │    │   Locally   │    │   to API    │ │  │
│  │   └─────────────┘    └─────────────┘    └─────────────┘ │  │
│  │         │                   │                   │        │  │
│  │         └───────────────────┼───────────────────┘        │  │
│  │                             │                             │  │
│  │                    ┌────────▼────────┐                   │  │
│  │                    │  Proveniq SDK   │                   │  │
│  │                    │  (Embedded)     │                   │  │
│  │                    └─────────────────┘                   │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. UI Component Library Recommendations

### 6.1 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | React 18+ | Existing codebase |
| **Styling** | Tailwind CSS | Rapid development |
| **Components** | shadcn/ui | Accessible, customizable |
| **Icons** | Lucide | Consistent, lightweight |
| **State** | Zustand or Jotai | Simple, performant |
| **API Client** | TanStack Query | Caching, invalidation |

### 6.2 Accessibility Requirements

- WCAG 2.1 AA compliance minimum
- Keyboard navigation for all actions
- Screen reader support
- Color contrast ratios ≥4.5:1
- Focus indicators on all interactive elements

---

## 7. Design Constraints

### 7.1 Conflicts Identified

| UX Pattern | Security Conflict | Resolution |
|------------|-------------------|------------|
| "Remember me" checkbox | Extends session risk | Limit to 7 days, require re-MFA |
| Copy secret to clipboard | Clipboard exposure | Auto-clear after 60s |
| Show full API key | Shoulder surfing | Show only prefix after creation |
| Auto-fill forms | XSS risk | Disable for sensitive fields |

### 7.2 Approved Patterns

- **Progressive disclosure** - Show details on demand
- **Confirmation dialogs** - For destructive actions
- **Inline validation** - Immediate feedback
- **Toast notifications** - Non-blocking alerts
- **Skeleton loading** - Perceived performance

---

## 8. Phase 1 Deliverables Checklist

- [x] Portal information architecture
- [x] Key management UX flows
- [x] Security-first UX guidelines
- [x] SDK experience outline
- [x] Technology recommendations
- [x] Design constraints documented
- [ ] Wireframes (Phase 2)
- [ ] Component library setup (Phase 2)

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-10 | Frontend/Mobile Agent | Initial portal & SDK outline |
