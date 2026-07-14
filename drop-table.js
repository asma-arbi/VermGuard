const mysql = require('mysql2/promise');

async function dropTable() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root',
      database: 'soc'
    });
    
    console.log('Connecté à MySQL...');
    await connection.execute('DROP TABLE IF EXISTS `user`');
    console.log('Ancienne table `user` supprimée avec succès !');
    
    await connection.end();
  } catch (error) {
    console.error('Erreur lors de la suppression :', error);
  }
}

dropTable();
