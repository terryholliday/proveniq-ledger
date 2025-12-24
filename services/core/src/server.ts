
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { assetRoutes } from './routes/assets';

const app = express();

app.use(cors());
app.use(express.json());

// Check Health
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'proveniq-core' });
});

// Routes
app.use('/core', assetRoutes);

export const startServer = () => {
    app.listen(config.port, () => {
        console.log(`[PROVENIQ CORE] Engine online at http://localhost:${config.port}`);
    });
};

if (require.main === module) {
    startServer();
}

export default app;
