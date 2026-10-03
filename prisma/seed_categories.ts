import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Lista completa de categorias ZEUS EVOLUTION 2026
 * Estruturada com Categoria Principal e Subcategorias
 */
const categoriesData = [
  // ========== GAROTA ZEUS ==========
  { name: 'Garota Zeus' },

  // ========== GAROTO ZEUS ==========
  { name: 'Garoto Zeus' },

  // ========== ESPECIAL ÚNICA ==========
  { name: 'Especial Única' },
  { name: 'Feminina', parentName: 'Especial Única' },
  { name: 'Masculina', parentName: 'Especial Única' },

  // ========== FIGURE ÚNICA ==========
  { name: 'Figure Única' },

  // ========== WOMEN'S PHYSIQUE ==========
  { name: "Women's Physique" },
  { name: "Até 60 kg", parentName: "Women's Physique", maxWeight: 60.0 },
  { name: "Acima de 60 kg", parentName: "Women's Physique", minWeight: 60.1 },

  // ========== BIQUÍNI ==========
  { name: 'Biquíni' },
  { name: 'Estreantes', parentName: 'Biquíni' },
  { name: 'Naturais', parentName: 'Biquíni' },
  { name: 'Teen 12 até 17 anos', parentName: 'Biquíni' },
  { name: 'Juvenil até 21 anos', parentName: 'Biquíni' },
  { name: 'Master Acima de 35', parentName: 'Biquíni' },
  { name: 'Até 1,58', parentName: 'Biquíni', maxHeight: 158.0 },
  { name: 'Até 1,63', parentName: 'Biquíni', maxHeight: 163.0 },
  { name: 'Até 1,68', parentName: 'Biquíni', maxHeight: 168.0 },
  { name: 'Acima de 1,68', parentName: 'Biquíni', minHeight: 168.1 },
  { name: 'Overall', parentName: 'Biquíni' },

  // ========== WELLNESS ==========
  { name: 'Wellness' },
  { name: 'Estreantes', parentName: 'Wellness' },
  { name: 'Naturais', parentName: 'Wellness' },
  { name: 'Teen 12 até 17 anos', parentName: 'Wellness' },
  { name: 'Juvenil até 21 anos', parentName: 'Wellness' },
  { name: 'Master de 35 até 40 anos', parentName: 'Wellness' },
  { name: 'Master de 40 até 50 anos', parentName: 'Wellness' },
  { name: 'Master Acima de 50 anos', parentName: 'Wellness' },
  { name: 'Até 1,58', parentName: 'Wellness', maxHeight: 158.0 },
  { name: 'Até 1,68', parentName: 'Wellness', maxHeight: 168.0 },
  { name: 'Acima de 1,68', parentName: 'Wellness', minHeight: 168.1 },
  { name: 'Overall', parentName: 'Wellness' },

  // ========== MEN'S PHYSIQUE ==========
  { name: "Men's Physique" },
  { name: 'Estreantes', parentName: "Men's Physique" },
  { name: 'Naturais', parentName: "Men's Physique" },
  { name: 'Teen 12 até 17 anos', parentName: "Men's Physique" },
  { name: 'Juvenil até 21 anos', parentName: "Men's Physique" },
  { name: 'Master Acima de 40', parentName: "Men's Physique" },
  { name: 'Até 1,75', parentName: "Men's Physique", maxHeight: 175.0 },
  { name: 'Até 1,80', parentName: "Men's Physique", maxHeight: 180.0 },
  { name: 'Acima de 1,80', parentName: "Men's Physique", minHeight: 180.1 },
  { name: 'Overall', parentName: "Men's Physique" },

  // ========== CLASSIC PHYSIQUE ==========
  { name: 'Classic Physique' },
  { name: 'Estreantes', parentName: 'Classic Physique' },
  { name: 'Naturais', parentName: 'Classic Physique' },
  { name: 'Teen 12 até 17 anos', parentName: 'Classic Physique' },
  { name: 'Juvenil até 21 anos', parentName: 'Classic Physique' },
  { name: 'Master Acima de 40', parentName: 'Classic Physique' },
  { name: 'A (Até 163,0 cm - 76 kg)', parentName: 'Classic Physique', maxHeight: 163.0, maxWeight: 76.0 },
  { name: 'A (163,1 a 165,0 cm - 78 kg)', parentName: 'Classic Physique', minHeight: 163.1, maxHeight: 165.0, maxWeight: 78.0 },
  { name: 'A (165,1 a 168,0 cm - 80 kg)', parentName: 'Classic Physique', minHeight: 165.1, maxHeight: 168.0, maxWeight: 80.0 },
  { name: 'A (168,1 a 170,0 cm - 83 kg)', parentName: 'Classic Physique', minHeight: 168.1, maxHeight: 170.0, maxWeight: 83.0 },
  { name: 'B (170,1 a 173,0 cm - 85 kg)', parentName: 'Classic Physique', minHeight: 170.1, maxHeight: 173.0, maxWeight: 85.0 },
  { name: 'B (173,1 a 175,0 cm - 88 kg)', parentName: 'Classic Physique', minHeight: 173.1, maxHeight: 175.0, maxWeight: 88.0 },
  { name: 'B (175,1 a 178,0 cm - 92 kg)', parentName: 'Classic Physique', minHeight: 175.1, maxHeight: 178.0, maxWeight: 92.0 },
  { name: 'C (178,1 a 180,0 cm - 95 kg)', parentName: 'Classic Physique', minHeight: 178.1, maxHeight: 180.0, maxWeight: 95.0 },
  { name: 'C (180,1 a 183,0 cm - 98 kg)', parentName: 'Classic Physique', minHeight: 180.1, maxHeight: 183.0, maxWeight: 98.0 },
  { name: 'C (183,1 a 185,0 cm - 102 kg)', parentName: 'Classic Physique', minHeight: 183.1, maxHeight: 185.0, maxWeight: 102.0 },
  { name: 'D (185,1 a 188,0 cm - 105 kg)', parentName: 'Classic Physique', minHeight: 185.1, maxHeight: 188.0, maxWeight: 105.0 },
  { name: 'D (188,1 a 191,0 cm - 108 kg)', parentName: 'Classic Physique', minHeight: 188.1, maxHeight: 191.0, maxWeight: 108.0 },
  { name: 'D (191,1 a 193,0 cm - 112 kg)', parentName: 'Classic Physique', minHeight: 191.1, maxHeight: 193.0, maxWeight: 112.0 },
  { name: 'D (193,1 a 196,0 cm - 115 kg)', parentName: 'Classic Physique', minHeight: 193.1, maxHeight: 196.0, maxWeight: 115.0 },
  { name: 'D (196,1 a 198,0 cm - 118 kg)', parentName: 'Classic Physique', minHeight: 196.1, maxHeight: 198.0, maxWeight: 118.0 },
  { name: 'D (198,1 a 201,0 cm - 121 kg)', parentName: 'Classic Physique', minHeight: 198.1, maxHeight: 201.0, maxWeight: 121.0 },
  { name: 'D (Acima de 201,0 cm - 124 kg)', parentName: 'Classic Physique', minHeight: 201.1, maxWeight: 124.0 },
  { name: 'Overall', parentName: 'Classic Physique' },

  // ========== BODYBUILDER ==========
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

async function main() {
  console.log('🗑️  Removendo todas as categorias globais antigas...');
  await prisma.globalCategory.deleteMany({});
  console.log('✅ Categorias antigas removidas.');

  console.log(`\n📋 Inserindo ${categoriesData.length} categorias novas...`);
  
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

  for (const cat of categoriesData) {
    await prisma.globalCategory.create({
      data: {
        name: cat.name,
        parentName: (cat as any).parentName ?? null,
        minWeight: (cat as any).minWeight ?? null,
        maxWeight: (cat as any).maxWeight ?? null,
        minHeight: (cat as any).minHeight ?? null,
        maxHeight: (cat as any).maxHeight ?? null,
        poses: getPosesForCategory(cat.name, (cat as any).parentName),
      },
    });
    console.log(`  ✅ ${cat.parentName ? `${cat.parentName} > ` : ''}${cat.name}`);
  }

  console.log(`\n🏁 Seed finalizado! ${categoriesData.length} categorias criadas com sucesso.`);
}

main()
  .catch(e => {
    console.error('❌ Erro no seed de categorias:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
