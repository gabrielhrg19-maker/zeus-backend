const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@zeusevolution.com.br';
  const password = 'adminpassword';
  
  console.log(`Atualizando senha do admin (${email}) para: ${password}...`);
  
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  if (!user) {
    console.log('Admin não encontrado por e-mail. Criando novo...');
    await prisma.user.create({
      data: {
        name: 'Administrador Zeus',
        email,
        cpf: '00000000000',
        phone: '00000000000',
        password_hash: hashedPassword,
        role: 'ADMIN'
      }
    });
    console.log('Admin criado com sucesso!');
  } else {
    await prisma.user.update({
      where: { email },
      data: {
        password_hash: hashedPassword,
        role: 'ADMIN'
      }
    });
    console.log('Senha do admin atualizada com sucesso!');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
