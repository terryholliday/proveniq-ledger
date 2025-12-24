
import { Router } from 'express';
import { resolveAssetProfile, getRawEvents } from '../aggregator/resolver';
import { ViewFilterEnum } from '@proveniq/contracts';

const router = Router();

// GET /core/asset/:asset_id
// Returns Universal Asset Profile
router.get('/asset/:asset_id', async (req, res) => {
    try {
        const { asset_id } = req.params;
        const view = req.query.view as string;

        // Validate view if present
        let viewFilter: ViewFilterEnum | undefined;
        if (view && Object.values(ViewFilterEnum).includes(view as ViewFilterEnum)) {
            viewFilter = view as ViewFilterEnum;
        }

        const profile = await resolveAssetProfile(asset_id, viewFilter);

        res.json(profile);
    } catch (error: any) {
        console.error('[CORE] Error resolving asset:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// GET /core/asset/:asset_id/events
// Returns Raw Event Stream (Debug/Audit)
router.get('/asset/:asset_id/events', async (req, res) => {
    try {
        const { asset_id } = req.params;
        const events = await getRawEvents(asset_id);
        res.json(events);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const assetRoutes = router;
