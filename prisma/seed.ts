import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@zeusevolution.com.br';
  const adminPassword = 'adminpassword';
  
  console.log('🚀 Iniciando script de Seed...');

  // 1. Criar Usuário Admin se não existir
  const existingAdmin = await prisma.user.findFirst({
    where: { OR: [{ email: adminEmail }, { role: 'ADMIN' }] }
  });

  if (!existingAdmin) {
    console.log('➕ Criando usuário administrador inicial...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.create({
      data: {
        name: 'Administrador Zeus',
        email: adminEmail,
        cpf: '000.000.000-00',
        phone: '00000000000',
        password_hash: hashedPassword,
        role: 'ADMIN',
      }
    });
    console.log(`✅ Admin criado: ${adminEmail} | senha: ${adminPassword}`);
  } else {
    console.log('ℹ️ Administrador já existe no banco de dados. Pulando criação de user.');
  }

  // 2. Garantir que as etapas globais existam (Templates)
  const existingGlobalStages = await prisma.globalStage.count();
  if (existingGlobalStages === 0) {
    console.log('➕ Criando templates de etapas globais...');
    await prisma.globalStage.createMany({
      data: [
        { name: 'Portaria', order: 1 },
        { name: 'Pintura', order: 2 },
        { name: 'Backstage', order: 3 },
        { name: 'Palco', order: 4 },
        { name: 'Finalizado', order: 5 },
      ]
    });
    console.log('✅ Etapas globais criadas.');
  }

  // 3. Garantir que as categorias globais existam (Templates)
  //    IMPORTANTE: só popula quando NÃO houver nenhuma categoria global.
  //    Antes, este bloco apagava e recriava tudo a cada restart/deploy,
  //    o que descartava as alterações feitas pelo admin no painel.
  const existingGlobalCategories = await prisma.globalCategory.count();

  const categoriesData = [
    { name: 'Garota Zeus' },
    { name: 'Garoto Zeus' },
    { name: 'Especial Única' },
    { name: 'Feminina', parentName: 'Especial Única' },
    { name: 'Masculina', parentName: 'Especial Única' },
    { name: 'Figure Única' },
    { name: "Women's Physique" },
    { name: "Até 60 kg", parentName: "Women's Physique", maxWeight: 60.0 },
    { name: "Acima de 60 kg", parentName: "Women's Physique", minWeight: 60.1 },
    { name: 'Overall', parentName: "Women's Physique" },

    { name: 'Biquíni' },
    { name: 'Estreantes', parentName: 'Biquíni' },
    { name: 'Naturais', parentName: 'Biquíni' },
    { name: 'Teen de 14 até 17 anos', parentName: 'Biquíni' },
    { name: 'Juvenil de 18 até 21 anos', parentName: 'Biquíni' },
    { name: 'Master de 35 até 40 anos', parentName: 'Biquíni' },
    { name: 'Master de 40 até 50 anos', parentName: 'Biquíni' },
    { name: 'Master Acima de 50 anos', parentName: 'Biquíni' },
    { name: 'Até 1,58', parentName: 'Biquíni', maxHeight: 158.0 },
    { name: 'Até 1,63', parentName: 'Biquíni', maxHeight: 163.0 },
    { name: 'Até 1,68', parentName: 'Biquíni', maxHeight: 168.0 },
    { name: 'Acima de 1,68', parentName: 'Biquíni', minHeight: 168.1 },
    { name: 'Overall', parentName: 'Biquíni' },

    { name: 'Wellness' },
    { name: 'Estreantes', parentName: 'Wellness' },
    { name: 'Naturais', parentName: 'Wellness' },
    { name: 'Teen de 14 até 17 anos', parentName: 'Wellness' },
    { name: 'Juvenil de 18 até 21 anos', parentName: 'Wellness' },
    { name: 'Master de 35 até 40 anos', parentName: 'Wellness' },
    { name: 'Master de 40 até 50 anos', parentName: 'Wellness' },
    { name: 'Master Acima de 50 anos', parentName: 'Wellness' },
    { name: 'Até 1,58', parentName: 'Wellness', maxHeight: 158.0 },
    { name: 'Até 1,63', parentName: 'Wellness', maxHeight: 163.0 },
    { name: 'Até 1,68', parentName: 'Wellness', maxHeight: 168.0 },
    { name: 'Acima de 1,68', parentName: 'Wellness', minHeight: 168.1 },
    { name: 'Overall', parentName: 'Wellness' },

    { name: "Men's Physique" },
    { name: 'Estreantes', parentName: "Men's Physique" },
    { name: 'Naturais', parentName: "Men's Physique" },
    { name: 'Teen de 14 até 17 anos', parentName: "Men's Physique" },
    { name: 'Juvenil de 18 até 21 anos', parentName: "Men's Physique" },
    { name: 'Master de 35 até 40 anos', parentName: "Men's Physique" },
    { name: 'Master de 40 até 50 anos', parentName: "Men's Physique" },
    { name: 'Master Acima de 50 anos', parentName: "Men's Physique" },
    { name: 'Até 1,75', parentName: "Men's Physique", maxHeight: 175.0 },
    { name: 'Até 1,80', parentName: "Men's Physique", maxHeight: 180.0 },
    { name: 'Acima de 1,80', parentName: "Men's Physique", minHeight: 180.1 },
    { name: 'Overall', parentName: "Men's Physique" },

    { name: 'Classic Physique' },
    { name: 'Estreantes', parentName: 'Classic Physique' },
    { name: 'Naturais', parentName: 'Classic Physique' },
    { name: 'Teen de 14 até 17 anos', parentName: 'Classic Physique' },
    { name: 'Juvenil de 18 até 21 anos', parentName: 'Classic Physique' },
    { name: 'Master de 35 até 40 anos', parentName: 'Classic Physique' },
    { name: 'Master de 40 até 50 anos', parentName: 'Classic Physique' },
    { name: 'Master Acima de 50 anos', parentName: 'Classic Physique' },
    { name: 'A (Até 163,0 cm - 76 kg)', parentName: 'Classic Physique', maxHeight: 163.0, maxWeight: 76.0 },
    { name: 'A (163,1 - 165,0 cm - 78 kg)', parentName: 'Classic Physique', minHeight: 163.1, maxHeight: 165.0, maxWeight: 78.0 },
    { name: 'A (165,1 - 168,0 cm - 80 kg)', parentName: 'Classic Physique', minHeight: 165.1, maxHeight: 168.0, maxWeight: 80.0 },
    { name: 'A (168,1 - 170,0 cm - 83 kg)', parentName: 'Classic Physique', minHeight: 168.1, maxHeight: 170.0, maxWeight: 83.0 },
    { name: 'B (170,1 - 173,0 cm - 85 kg)', parentName: 'Classic Physique', minHeight: 170.1, maxHeight: 173.0, maxWeight: 85.0 },
    { name: 'B (173,1 - 175,0 cm - 88 kg)', parentName: 'Classic Physique', minHeight: 173.1, maxHeight: 175.0, maxWeight: 88.0 },
    { name: 'B (175,1 - 178,0 cm - 92 kg)', parentName: 'Classic Physique', minHeight: 175.1, maxHeight: 178.0, maxWeight: 92.0 },
    { name: 'C (178,1 - 180,0 cm - 95 kg)', parentName: 'Classic Physique', minHeight: 178.1, maxHeight: 180.0, maxWeight: 95.0 },
    { name: 'C (180,1 - 183,0 cm - 98 kg)', parentName: 'Classic Physique', minHeight: 180.1, maxHeight: 183.0, maxWeight: 98.0 },
    { name: 'C (183,1 - 185,0 cm - 102 kg)', parentName: 'Classic Physique', minHeight: 183.1, maxHeight: 185.0, maxWeight: 102.0 },
    { name: 'D (185,1 - 188,0 cm - 105 kg)', parentName: 'Classic Physique', minHeight: 185.1, maxHeight: 188.0, maxWeight: 105.0 },
    { name: 'D (188,1 - 191,0 cm - 108 kg)', parentName: 'Classic Physique', minHeight: 188.1, maxHeight: 191.0, maxWeight: 108.0 },
    { name: 'D (191,1 - 193,0 cm - 112 kg)', parentName: 'Classic Physique', minHeight: 191.1, maxHeight: 193.0, maxWeight: 112.0 },
    { name: 'D (193,1 - 196,0 cm - 115 kg)', parentName: 'Classic Physique', minHeight: 193.1, maxHeight: 196.0, maxWeight: 115.0 },
    { name: 'D (196,1 - 198,0 cm - 118 kg)', parentName: 'Classic Physique', minHeight: 196.1, maxHeight: 198.0, maxWeight: 118.0 },
    { name: 'D (198,1 - 201,0 cm - 121 kg)', parentName: 'Classic Physique', minHeight: 198.1, maxHeight: 201.0, maxWeight: 121.0 },
    { name: 'D (Acima de 201,0 cm - 124 kg)', parentName: 'Classic Physique', minHeight: 201.1, maxWeight: 124.0 },
    { name: 'Overall', parentName: 'Classic Physique' },

    { name: 'Bodybuilder' },
    { name: 'Estreantes', parentName: 'Bodybuilder' },
    { name: 'Naturais', parentName: 'Bodybuilder' },
    { name: 'Teen 12 até 17 anos', parentName: 'Bodybuilder' },
    { name: 'Juvenil até 21 anos', parentName: 'Bodybuilder' },
    { name: 'Master de 35 até 40 anos', parentName: 'Bodybuilder' },
    { name: 'Master de 40 até 50 anos', parentName: 'Bodybuilder' },
    { name: 'Master Acima de 50 anos', parentName: 'Bodybuilder' },
    { name: 'Senior Até 65 kg', parentName: 'Bodybuilder', maxWeight: 65.0 },
    { name: 'Até 70 kg', parentName: 'Bodybuilder', maxWeight: 70.0 },
    { name: 'Até 75 kg', parentName: 'Bodybuilder', maxWeight: 75.0 },
    { name: 'Até 80 kg', parentName: 'Bodybuilder', maxWeight: 80.0 },
    { name: 'Até 85 kg', parentName: 'Bodybuilder', maxWeight: 85.0 },
    { name: 'Até 90 kg', parentName: 'Bodybuilder', maxWeight: 90.0 },
    { name: 'Acima de 90 kg', parentName: 'Bodybuilder', minWeight: 90.1 },
    { name: 'Overall', parentName: 'Bodybuilder' },
  ];

  const getPosesForCategory = (name: string, parentName?: string | null): string[] => {
    const rootCat = parentName || name;
    if (rootCat === 'Classic Physique') {
      return [
        "Duplo Bíceps de Frente",
        "Expansão de Tórax de Perfil",
        "Duplo Bíceps de Costas",
        "Abdominais e Coxas",
        "Pose Clássica Favorita"
      ];
    }
    if (rootCat === 'Bodybuilder') {
      return [
        "Duplo Bíceps de Frente",
        "Expansão de Dorsal de Frente",
        "Tórax de Perfil",
        "Duplo Bíceps de Costas",
        "Expansão de Dorsal de Costas",
        "Tríceps de Perfil",
        "Abdominais e Coxas",
        "Mais Musculoso"
      ];
    }
    if (rootCat === "Women's Physique") {
      return [
        "Duplo Bíceps de Frente",
        "Tórax de Perfil",
        "Duplo Bíceps de Costas",
        "Tríceps de Perfil",
        "Abdominais e Coxas"
      ];
    }
    return [
      "Frente",
      "Perfil Esquerdo",
      "Costas",
      "Perfil Direito"
    ];
  };

  const categoriesWithPoses = categoriesData.map(cat => ({
    ...cat,
    poses: getPosesForCategory(cat.name, cat.parentName)
  }));

  if (existingGlobalCategories === 0) {
    console.log('➕ Criando templates de categorias globais iniciais...');
    await prisma.globalCategory.createMany({
      data: categoriesWithPoses
    });
    console.log(`✅ ${categoriesData.length} categorias criadas.`);
  } else {
    console.log(`ℹ️ ${existingGlobalCategories} categorias globais já existem. Pulando criação (preservando alterações do admin).`);
  }

  console.log('🏁 Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
