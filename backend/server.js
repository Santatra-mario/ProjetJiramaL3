require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// =========================================================
// DATABASE
// =========================================================
const pool = require('./src/config/db');

// =========================================================
// ROUTES
// =========================================================
const authRoutes =
  require('./src/routes/authRoutes');

const userRoutes =
  require('./src/routes/userRoutes');

const abonneRoutes =
  require('./src/routes/abonneRoutes');

const compteurRoutes =
  require('./src/routes/compteurRoutes');

const releveRoutes =
  require('./src/routes/releveRoutes');

const dashboardRoutes =
  require('./src/routes/dashboardRoutes');

const statistiquesRoutes =
  require('./src/routes/statistiquesRoutes');

const graphiquesRoutes =
  require('./src/routes/graphiquesRoutes');

const anomalieRoutes =
  require('./src/routes/anomalieRoutes');

const comparaisonRoutes =
  require('./src/routes/comparaisonRoutes');

const notificationRoutes =
  require('./src/routes/notificationRoutes');

const responsableRoutes =
  require('./src/routes/responsableRoutes');

const agentRoutes =
  require('./src/routes/agentRoutes');

// =========================================================
// APPLICATION EXPRESS
// IMPORTANT : app doit être créé AVANT app.use(...)
// =========================================================
const app = express();

// =========================================================
// CONFIGURATION
// =========================================================
const PORT =
  Number(process.env.PORT) || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  'http://localhost:5173';

// =========================================================
// VÉRIFICATION DE LA CONFIGURATION
// =========================================================
if (!process.env.JWT_SECRET) {
  console.error(
    'ERREUR : JWT_SECRET est absent du fichier .env'
  );
  process.exit(1);
}

if (!process.env.DB_NAME) {
  console.error(
    'ERREUR : DB_NAME est absent du fichier .env'
  );
  process.exit(1);
}

// =========================================================
// SÉCURITÉ
// =========================================================
app.use(
  helmet()
);

// =========================================================
// CORS
// =========================================================
app.use(
  cors({
    origin: FRONTEND_URL,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  })
);

// =========================================================
// JSON
// =========================================================
app.use(
  express.json({
    limit: '1mb',
  })
);

// =========================================================
// URL ENCODED
// =========================================================
app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb',
  })
);

// =========================================================
// ROUTES API
// =========================================================

// ---------------------------------------------------------
// AUTHENTIFICATION
// ---------------------------------------------------------
app.use(
  '/api/auth',
  authRoutes
);

// ---------------------------------------------------------
// UTILISATEURS
// ---------------------------------------------------------
app.use(
  '/api/users',
  userRoutes
);

// ---------------------------------------------------------
// ABONNÉS
// ---------------------------------------------------------
app.use(
  '/api/abonnes',
  abonneRoutes
);

// ---------------------------------------------------------
// COMPTEURS
// ---------------------------------------------------------
app.use(
  '/api/compteurs',
  compteurRoutes
);

// ---------------------------------------------------------
// RELEVÉS
// ---------------------------------------------------------
app.use(
  '/api/releves',
  releveRoutes
);

// ---------------------------------------------------------
// DASHBOARD ADMIN
// ---------------------------------------------------------
app.use(
  '/api/dashboard',
  dashboardRoutes
);

// ---------------------------------------------------------
// STATISTIQUES
// ---------------------------------------------------------
app.use(
  '/api/statistiques',
  statistiquesRoutes
);

// ---------------------------------------------------------
// GRAPHIQUES
// ---------------------------------------------------------
app.use(
  '/api/graphiques',
  graphiquesRoutes
);

// ---------------------------------------------------------
// ANOMALIES
// ---------------------------------------------------------
app.use(
  '/api/anomalies',
  anomalieRoutes
);

// ---------------------------------------------------------
// COMPARAISON
// ---------------------------------------------------------
app.use(
  '/api/comparaison',
  comparaisonRoutes
);

// ---------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------
app.use(
  '/api/notifications',
  notificationRoutes
);

// ---------------------------------------------------------
// RESPONSABLE
// ---------------------------------------------------------
app.use(
  '/api/responsable',
  responsableRoutes
);

// ---------------------------------------------------------
// AGENT
// ---------------------------------------------------------
app.use(
  '/api/agent',
  agentRoutes
);

// =========================================================
// HEALTH CHECK SERVEUR
// =========================================================
app.get(
  '/api/health',
  (req, res) => {
    return res.status(200).json({
      status: 'success',
      message:
        'Serveur backend JIRAMA opérationnel.',
      environment:
        process.env.NODE_ENV ||
        'development',
    });
  }
);

// =========================================================
// HEALTH CHECK POSTGRESQL
// =========================================================
app.get(
  '/api/health/db',
  async (req, res) => {
    try {
      const result =
        await pool.query(
          'SELECT NOW() AS date'
        );

      return res.status(200).json({
        status: 'success',
        database:
          'PostgreSQL connecté',
        database_name:
          process.env.DB_NAME,
        date:
          result.rows[0].date,
      });
    } catch (error) {
      console.error(
        'Erreur PostgreSQL :',
        error
      );

      return res.status(500).json({
        status: 'error',
        database:
          'PostgreSQL non connecté',
        message:
          'Impossible de se connecter à PostgreSQL.',
      });
    }
  }
);

// =========================================================
// API RACINE
// =========================================================
app.get(
  '/api',
  (req, res) => {
    return res.status(200).json({
      status: 'success',
      message:
        'API JIRAMA disponible.',

      routes: {
        auth:
          '/api/auth',

        users:
          '/api/users',

        abonnes:
          '/api/abonnes',

        compteurs:
          '/api/compteurs',

        releves:
          '/api/releves',

        dashboard:
          '/api/dashboard',

        statistiques:
          '/api/statistiques',

        graphiques:
          '/api/graphiques',

        anomalies:
          '/api/anomalies',

        comparaison:
          '/api/comparaison',

        notifications:
          '/api/notifications',

        responsable:
          '/api/responsable',

        agent:
          '/api/agent',

        health:
          '/api/health',

        database:
          '/api/health/db',
      },
    });
  }
);

// =========================================================
// ROUTE TEST COMPARAISON
// =========================================================
app.get(
  '/api/comparaison-test',
  (req, res) => {
    return res.status(200).json({
      status: 'success',
      message:
        'La route comparaison est disponible.',
    });
  }
);

// =========================================================
// ROUTE TEST AGENT
// =========================================================
app.get(
  '/api/agent-test',
  (req, res) => {
    return res.status(200).json({
      status: 'success',
      message:
        'La route Agent est disponible.',
      route:
        '/api/agent',
    });
  }
);

// =========================================================
// ROUTE TEST RESPONSABLE
// =========================================================
app.get(
  '/api/responsable-test',
  (req, res) => {
    return res.status(200).json({
      status: 'success',
      message:
        'La route Responsable est disponible.',
      route:
        '/api/responsable',
    });
  }
);

// =========================================================
// ROUTE 404
// =========================================================
app.use(
  (req, res) => {
    return res.status(404).json({
      status: 'error',
      message:
        `Route non trouvée : ${req.method} ${req.originalUrl}`,
    });
  }
);

// =========================================================
// GESTION GLOBALE DES ERREURS
// =========================================================
app.use(
  (err, req, res, next) => {
    console.error(
      'Erreur serveur :',
      err.stack || err
    );

    // JSON invalide
    if (
      err instanceof SyntaxError &&
      err.status === 400 &&
      err.type === 'entity.parse.failed'
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le JSON envoyé est invalide.',
      });
    }

    const statusCode =
      Number.isInteger(err.status) &&
      err.status >= 400 &&
      err.status < 600
        ? err.status
        : 500;

    return res
      .status(statusCode)
      .json({
        status: 'error',
        message:
          err.message ||
          'Erreur interne du serveur.',
      });
  }
);

// =========================================================
// DÉMARRAGE DU SERVEUR
// =========================================================
const server =
  app.listen(
    PORT,
    () => {
      console.log('');
      console.log(
        '=========================================='
      );

      console.log(
        '         BACKEND JIRAMA DÉMARRÉ'
      );

      console.log(
        '=========================================='
      );

      console.log(
        `Serveur : http://localhost:${PORT}`
      );

      console.log(
        `API : http://localhost:${PORT}/api`
      );

      console.log(
        `Health : http://localhost:${PORT}/api/health`
      );

      console.log(
        `Database : http://localhost:${PORT}/api/health/db`
      );

      console.log(
        `Users : http://localhost:${PORT}/api/users`
      );

      console.log(
        `Abonnés : http://localhost:${PORT}/api/abonnes`
      );

      console.log(
        `Compteurs : http://localhost:${PORT}/api/compteurs`
      );

      console.log(
        `Relevés : http://localhost:${PORT}/api/releves`
      );

      console.log(
        `Dashboard : http://localhost:${PORT}/api/dashboard`
      );

      console.log(
        `Statistiques : http://localhost:${PORT}/api/statistiques`
      );

      console.log(
        `Graphiques : http://localhost:${PORT}/api/graphiques`
      );

      console.log(
        `Anomalies : http://localhost:${PORT}/api/anomalies`
      );

      console.log(
        `Comparaison : http://localhost:${PORT}/api/comparaison`
      );

      console.log(
        `Notifications : http://localhost:${PORT}/api/notifications`
      );

      console.log(
        `Responsable : http://localhost:${PORT}/api/responsable`
      );

      console.log(
        `Agent : http://localhost:${PORT}/api/agent`
      );

      console.log(
        `Test Responsable : http://localhost:${PORT}/api/responsable-test`
      );

      console.log(
        `Test Agent : http://localhost:${PORT}/api/agent-test`
      );

      console.log(
        `Frontend autorisé : ${FRONTEND_URL}`
      );

      console.log(
        `Environnement : ${
          process.env.NODE_ENV ||
          'development'
        }`
      );

      console.log(
        '=========================================='
      );

      console.log('');
    }
  );

// =========================================================
// ARRÊT PROPRE
// =========================================================
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `\nSignal ${signal} reçu. Arrêt du serveur...`
  );

  server.close(
    async () => {
      try {
        await pool.end();

        console.log(
          'Serveur et PostgreSQL arrêtés proprement.'
        );

        process.exit(0);
      } catch (error) {
        console.error(
          'Erreur lors de la fermeture de PostgreSQL :',
          error
        );

        process.exit(1);
      }
    }
  );
}

// =========================================================
// SIGINT
// =========================================================
process.on(
  'SIGINT',
  () => {
    shutdown('SIGINT');
  }
);

// =========================================================
// SIGTERM
// =========================================================
process.on(
  'SIGTERM',
  () => {
    shutdown('SIGTERM');
  }
);