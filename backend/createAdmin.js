require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('./src/config/db');

async function createAdmin() {
  const identifiant = 'admin';
  const email = 'admin@jirama.mg';
  const motDePasse = 'Admin@123';

  try {
    console.log('\n====================================');
    console.log('   RESET ADMIN JIRAMA');
    console.log('====================================\n');

    // Vérifier si admin existe
    const result = await pool.query(
      `
      SELECT id, identifiant, email, role, statut
      FROM users
      WHERE LOWER(TRIM(identifiant)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [identifiant]
    );

    // Nouveau hash
    const hash = await bcrypt.hash(motDePasse, 10);

    // --------------------------------------------------
    // ADMIN EXISTE
    // --------------------------------------------------
    if (result.rows.length > 0) {
      const user = result.rows[0];

      console.log('Compte trouvé :');
      console.table(user);

      const update = await pool.query(
        `
        UPDATE users
        SET
          nom = $1,
          prenom = $2,
          email = $3,
          mot_de_passe = $4,
          role = $5,
          statut = $6
        WHERE id = $7
        RETURNING
          id,
          nom,
          prenom,
          identifiant,
          email,
          role,
          statut
        `,
        [
          'Administrateur',
          'JIRAMA',
          email,
          hash,
          'ADMINISTRATEUR',
          'actif',
          user.id,
        ]
      );

      console.log('\n✓ ADMIN MIS À JOUR\n');
      console.table(update.rows[0]);
    }

    // --------------------------------------------------
    // ADMIN N'EXISTE PAS
    // --------------------------------------------------
    else {
      const insert = await pool.query(
        `
        INSERT INTO users
        (
          nom,
          prenom,
          identifiant,
          email,
          mot_de_passe,
          role,
          statut
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        RETURNING
          id,
          nom,
          prenom,
          identifiant,
          email,
          role,
          statut
        `,
        [
          'Administrateur',
          'JIRAMA',
          identifiant,
          email,
          hash,
          'ADMINISTRATEUR',
          'actif',
        ]
      );

      console.log('\n✓ ADMIN CRÉÉ\n');
      console.table(insert.rows[0]);
    }

    // --------------------------------------------------
    // TEST IMMÉDIAT DU HASH
    // --------------------------------------------------
    const verify = await pool.query(
      `
      SELECT
        id,
        identifiant,
        email,
        mot_de_passe,
        role,
        statut
      FROM users
      WHERE LOWER(TRIM(identifiant)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [identifiant]
    );

    if (verify.rows.length === 0) {
      throw new Error(
        'Impossible de retrouver le compte admin après création.'
      );
    }

    const admin = verify.rows[0];

    const passwordOk = await bcrypt.compare(
      motDePasse,
      admin.mot_de_passe
    );

    console.log('\n------------------------------------');
    console.log('TEST DU MOT DE PASSE');
    console.log('------------------------------------');
    console.log('Identifiant :', admin.identifiant);
    console.log('Email       :', admin.email);
    console.log('Role        :', admin.role);
    console.log('Statut      :', admin.statut);
    console.log('Hash bcrypt :', admin.mot_de_passe ? 'OUI' : 'NON');
    console.log('Mot de passe valide :', passwordOk);
    console.log('------------------------------------\n');

    if (!passwordOk) {
      throw new Error(
        'Le mot de passe Admin@123 ne correspond pas au hash enregistré.'
      );
    }

    console.log('====================================');
    console.log(' CONNEXION À UTILISER');
    console.log('====================================');
    console.log('Identifiant : admin');
    console.log('Mot de passe : Admin@123');
    console.log('====================================\n');

  } catch (error) {
    console.error('\nERREUR :', error.message);

    if (error.code) {
      console.error('Code PostgreSQL :', error.code);
    }
  } finally {
    await pool.end();
  }
}

createAdmin();