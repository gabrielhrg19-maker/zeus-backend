const bcrypt = require('bcrypt');
const fs = require('fs');
const { execSync } = require('child_process');

function resetPassword() {
  // Generate bcrypt hash for '123'
  const hash = bcrypt.hashSync('123', 10);
  console.log('Hash gerado para a senha 123');

  // Create a temporary python script to execute the update
  const pythonScript = `
import sqlite3
import sys

db_path = './prisma/dev.db'
hash_val = sys.argv[1]
email = 'admin@zeusevolution.com.br'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE User SET password_hash = ? WHERE email = ?", (hash_val, email))
    conn.commit()
    print(f"Atualizado {cursor.rowcount} registro(s) no banco dev.db.")
except Exception as e:
    print(f"Erro: {e}")
finally:
    if conn:
        conn.close()
`;
  
  fs.writeFileSync('temp_update.py', pythonScript);
  
  try {
    const output = execSync(`python temp_update.py "${hash}"`).toString();
    console.log(output);
  } catch(e) {
    console.error('Erro ao executar o script:', e.message);
  } finally {
    fs.unlinkSync('temp_update.py');
  }
}

resetPassword();
