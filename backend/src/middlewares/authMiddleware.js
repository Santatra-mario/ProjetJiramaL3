const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        status: 'error',
        message: 'Token manquant.',
      });
    }

    const parts =
      authHeader.split(' ');

    if (
      parts.length !== 2 ||
      parts[0] !== 'Bearer' ||
      !parts[1]
    ) {
      return res.status(401).json({
        status: 'error',
        message:
          'Format du token invalide.',
      });
    }

    const token = parts[1];

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        status: 'error',
        message:
          'JWT_SECRET absent du fichier .env.',
      });
    }

    jwt.verify(
      token,
      process.env.JWT_SECRET,
      (error, decoded) => {
        if (error) {
          return res.status(403).json({
            status: 'error',
            message:
              'Token invalide ou expiré.',
          });
        }

        req.user = decoded;

        next();
      }
    );

  } catch (error) {
    console.error(
      'Erreur middleware JWT :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur lors de la vérification du token.',
    });
  }
}

function checkRole(...rolesAutorises) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message:
          'Utilisateur non authentifié.',
      });
    }

    const roleUtilisateur =
      String(req.user.role || '')
        .trim()
        .toUpperCase();

    const roles =
      rolesAutorises.map((role) =>
        String(role)
          .trim()
          .toUpperCase()
      );

    if (
      !roles.includes(roleUtilisateur)
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'Accès refusé pour ce rôle.',
      });
    }

    next();
  };
}

module.exports = {
  verifyToken,
  checkRole,
};