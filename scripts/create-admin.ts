import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@zeusevolution.com.br';
  const password = 'adminpassword'; // Mude esta senha!
  const name = 'Administrador Zeus';
  const cpf = '000.000.000-00';
  const phone = '00000000000';

  const password_hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      password_hash
    },
    create: {
      email,
      name,
      cpf,
      phone,
      password_hash,
      role: 'ADMIN'
    }
  });

  console.log('✅ Usuário Admin criado/atualizado com sucesso!');
  console.log('📧 Email:', user.email);
  console.log('🔑 Senha:', password);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
